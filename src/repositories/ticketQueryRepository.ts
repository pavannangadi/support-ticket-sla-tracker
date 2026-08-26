import { prisma } from '../db/client';
import type { Priority, TicketStatus } from '../generated/prisma';

export interface TicketFilters {
  status?: TicketStatus;
  priority?: Priority;
  assigneeId?: string;
}

export interface PaginatedTicketsInput extends TicketFilters {
  take: number;
  cursor?: string;
}

const fullInclude = {
  reporter: true,
  assignee: true,
  comments: { include: { author: true } },
} as const;

export const ticketQueryRepository = {
  async findPaginated(input: PaginatedTicketsInput) {
    const where = {
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId,
    };

    const tickets = await prisma.ticket.findMany({
      where,
      include: fullInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.take + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });

    const hasNextPage = tickets.length > input.take;
    const nodes = hasNextPage ? tickets.slice(0, input.take) : tickets;
    const endCursor = nodes.length > 0 ? nodes[nodes.length - 1]?.id ?? null : null;

    return { nodes, hasNextPage, endCursor };
  },
};