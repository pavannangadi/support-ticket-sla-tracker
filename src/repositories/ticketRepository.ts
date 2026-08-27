import { prisma } from '../db/client';
import type { Priority, TicketStatus } from '../generated/prisma';

export interface CreateTicketInput {
  title: string;
  description: string;
  priority: Priority;
  reporterId: string;
}

const fullInclude = {
  reporter: true,
  assignee: true,
  comments: { include: { author: true } },
} as const;

export const ticketRepository = {
  findById(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      include: fullInclude,
    });
  },

  async create(input: CreateTicketInput) {
    const ticket = await prisma.ticket.create({ data: input });
    return prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: fullInclude,
    });
  },

  async assign(ticketId: string, assigneeId: string) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { assigneeId },
    });
    return prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: fullInclude,
    });
  },

  /**
   * Plain status update — used for transitions that don't affect the
   * resolvedAt timestamp (e.g. OPEN -> IN_PROGRESS, RESOLVED -> CLOSED).
   */
  async updateStatus(ticketId: string, status: TicketStatus) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
    });
    return prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: fullInclude,
    });
  },

  /**
   * Transition INTO RESOLVED. Always stamps resolvedAt, regardless of
   * whether this was triggered by resolveTicket or changeTicketStatus,
   * so the resolution SLA clock always freezes correctly.
   */
  async markResolved(ticketId: string) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    return prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: fullInclude,
    });
  },

  /**
   * Transition back to OPEN from RESOLVED/CLOSED. Clears resolvedAt since
   * reopening means the ticket wasn't truly resolved — the resolution
   * clock should resume live rather than stay frozen at a stale snapshot.
   */
  async reopen(ticketId: string) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'OPEN', resolvedAt: null },
    });
    return prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: fullInclude,
    });
  },

  setFirstResponseAt(ticketId: string, timestamp: Date) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data: { firstResponseAt: timestamp },
    });
  },
};