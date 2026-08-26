import { describe, it, expect, afterAll } from 'bun:test';
import { prisma } from '../../src/db/client';
import { userRepository } from '../../src/repositories/userRepository';
import { ticketRepository } from '../../src/repositories/ticketRepository';
import { commentRepository } from '../../src/repositories/commentRepository';
import { holidayRepository } from '../../src/repositories/holidayRepository';
import { isFirstResponse } from '../../src/services/ticket/firstResponse';
import { calculateSLA } from '../../src/services/sla/calculateSLA';
import { hashPassword } from '../../src/services/auth/password';

const TEST_MARKER = 'INTEGRATION_TEST_TICKET';

async function getOrCreateTestUser(email: string, name: string, role: 'REPORTER' | 'AGENT') {
  const existing = await userRepository.findByEmail(email);
  if (existing) return existing;

  const password = await hashPassword('integration-test-password');
  return userRepository.create({ name, email, password, role });
}

describe('Integration: ticket creation, comments, and SLA persistence', () => {
  const createdTicketIds: string[] = [];

  afterAll(async () => {
    // Clean up test data so re-runs stay idempotent and don't pollute the DB.
    await prisma.comment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    await prisma.$disconnect();
  });

  it('persists a ticket, records first response from the agent (not the reporter), and computes correct SLA info', async () => {
    const reporter = await getOrCreateTestUser(
      'integration-reporter@example.com',
      'Integration Reporter',
      'REPORTER'
    );
    const agent = await getOrCreateTestUser(
      'integration-agent@example.com',
      'Integration Agent',
      'AGENT'
    );

    // 1. Create a real ticket in Postgres.
    const ticket = await ticketRepository.create({
      title: TEST_MARKER,
      description: 'Verifying persistence layer end-to-end.',
      priority: 'HIGH',
      reporterId: reporter.id,
    });
    createdTicketIds.push(ticket.id);

    expect(ticket.id).toBeTruthy();
    expect(ticket.status).toBe('OPEN');
    expect(ticket.firstResponseAt).toBeNull();

    // 2. Reporter comments on their own ticket — should NOT set firstResponseAt.
    const reporterComment = await commentRepository.create({
      ticketId: ticket.id,
      authorId: reporter.id,
      content: 'Any update?',
    });
    expect(reporterComment.author.id).toBe(reporter.id);

    const shouldRecordForReporter = isFirstResponse({
      reporterId: ticket.reporterId,
      authorId: reporter.id,
      firstResponseAt: ticket.firstResponseAt,
    });
    expect(shouldRecordForReporter).toBe(false);

    const ticketAfterReporterComment = await ticketRepository.findById(ticket.id);
    expect(ticketAfterReporterComment?.firstResponseAt).toBeNull();

    // 3. Agent comments — SHOULD set firstResponseAt.
    const agentComment = await commentRepository.create({
      ticketId: ticket.id,
      authorId: agent.id,
      content: 'Looking into this now.',
    });

    const shouldRecordForAgent = isFirstResponse({
      reporterId: ticket.reporterId,
      authorId: agent.id,
      firstResponseAt: ticketAfterReporterComment?.firstResponseAt ?? null,
    });
    expect(shouldRecordForAgent).toBe(true);

    await ticketRepository.setFirstResponseAt(ticket.id, agentComment.createdAt);

    // 4. Verify firstResponseAt is actually persisted in Postgres, not just in memory.
    const ticketAfterAgentComment = await ticketRepository.findById(ticket.id);
    expect(ticketAfterAgentComment?.firstResponseAt).not.toBeNull();
    expect(ticketAfterAgentComment?.firstResponseAt?.getTime()).toBe(agentComment.createdAt.getTime());

    // 5. Verify persisted SLA information computes correctly from real DB data.
    const holidays = await holidayRepository.findAll();
    const holidayDates = holidays.map((h) => h.date);

    const sla = calculateSLA({
      priority: ticketAfterAgentComment!.priority,
      createdAt: ticketAfterAgentComment!.createdAt,
      firstResponseAt: ticketAfterAgentComment!.firstResponseAt,
      resolvedAt: ticketAfterAgentComment!.resolvedAt,
      holidayDates,
    });

    // First response was fast (immediate, in test time), so it should be frozen ON_TRACK.
    expect(sla.firstResponseState).toBe('ON_TRACK');
    // Resolution clock is still live since the ticket isn't resolved yet.
    expect(sla.resolutionState).not.toBe('BREACHED');
    expect(sla.resolutionDueAt.getTime()).toBeGreaterThan(sla.firstResponseDueAt.getTime());

    // 6. Verify the full comment thread persisted correctly, in order.
    const allComments = await commentRepository.findByTicketId(ticket.id);
    expect(allComments).toHaveLength(2);
    expect(allComments[0]?.authorId).toBe(reporter.id);
    expect(allComments[1]?.authorId).toBe(agent.id);
  });
});