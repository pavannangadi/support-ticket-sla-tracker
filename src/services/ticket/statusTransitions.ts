import type { TicketStatus } from '../../generated/prisma';
import { createAppError } from '../../graphql/errors';

const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED', 'OPEN'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
};

export function assertValidTransition(from: TicketStatus, to: TicketStatus): void {
  if (from === to) {
    throw createAppError(
      'INVALID_STATUS_TRANSITION',
      `Ticket is already in status ${from}.`
    );
  }

  const allowed = allowedTransitions[from];
  if (!allowed.includes(to)) {
    throw createAppError(
      'INVALID_STATUS_TRANSITION',
      `Ticket cannot transition from ${from} to ${to}.`
    );
  }
}