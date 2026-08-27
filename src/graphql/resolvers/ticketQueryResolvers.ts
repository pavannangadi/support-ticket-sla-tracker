import type { Priority, TicketStatus, Ticket as PrismaTicket } from '../../generated/prisma';
import { ticketQueryRepository } from '../../repositories/ticketQueryRepository';
import { holidayRepository } from '../../repositories/holidayRepository';
import { computeDashboard } from '../../services/ticket/dashboard';
import { calculateSLA, type SLAClockState } from '../../services/sla/calculateSLA';

type SortField = 'CREATED_AT' | 'PRIORITY';
type SortOrder = 'ASC' | 'DESC';

interface TicketsArgs {
  status?: TicketStatus;
  priority?: Priority;
  assigneeId?: string;
  slaState?: SLAClockState;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  take?: number;
  cursor?: string;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const PRIORITY_WEIGHT: Record<Priority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
};

function overallSLAState(ticket: PrismaTicket, holidayDates: Date[]): SLAClockState {
  const sla = calculateSLA({
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    firstResponseAt: ticket.firstResponseAt,
    resolvedAt: ticket.resolvedAt,
    holidayDates,
  });

  if (sla.firstResponseState === 'BREACHED' || sla.resolutionState === 'BREACHED') {
    return 'BREACHED';
  }
  if (sla.firstResponseState === 'AT_RISK' || sla.resolutionState === 'AT_RISK') {
    return 'AT_RISK';
  }
  return 'ON_TRACK';
}

function paginateInMemory<T extends { id: string }>(
  items: T[],
  take: number,
  cursor?: string
) {
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = items.findIndex((item) => item.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const page = items.slice(startIndex, startIndex + take);
  const hasNextPage = startIndex + take < items.length;
  const endCursor = page.length > 0 ? page[page.length - 1]?.id ?? null : null;

  return { nodes: page, pageInfo: { hasNextPage, endCursor } };
}

export const ticketQueryResolvers = {
  Query: {
    tickets: async (_parent: unknown, args: TicketsArgs) => {
      const take = Math.min(args.take ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
      const needsInMemoryHandling = Boolean(args.slaState) || args.sortBy === 'PRIORITY';

      if (!needsInMemoryHandling) {
        const result = await ticketQueryRepository.findPaginated({
          status: args.status,
          priority: args.priority,
          assigneeId: args.assigneeId,
          take,
          cursor: args.cursor,
          sortOrder: args.sortOrder === 'ASC' ? 'asc' : 'desc',
        });

        return {
          nodes: result.nodes,
          pageInfo: { hasNextPage: result.hasNextPage, endCursor: result.endCursor },
        };
      }

      // Either SLA-state filtering or priority sorting is requested — both are
      // computed/derived rather than direct SQL operations, so we fetch the
      // DB-filterable set, process in application code, then paginate manually.
      const holidays = await holidayRepository.findAll();
      const holidayDates = holidays.map((h) => h.date);

      let tickets = await ticketQueryRepository.findManyUnpaginated({
        status: args.status,
        priority: args.priority,
        assigneeId: args.assigneeId,
      });

      if (args.slaState) {
        tickets = tickets.filter((t) => overallSLAState(t, holidayDates) === args.slaState);
      }

      if (args.sortBy === 'PRIORITY') {
        const direction = args.sortOrder === 'ASC' ? 1 : -1;
        tickets = [...tickets].sort(
          (a, b) => (PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]) * direction
        );
      } else {
        const direction = args.sortOrder === 'ASC' ? 1 : -1;
        tickets = [...tickets].sort(
          (a, b) => (a.createdAt.getTime() - b.createdAt.getTime()) * direction
        );
      }

      return paginateInMemory(tickets, take, args.cursor);
    },

    dashboard: () => {
      return computeDashboard();
    },
  },
};