import type { Priority, TicketStatus, Ticket as PrismaTicket } from '../../generated/prisma';
import { ticketQueryRepository } from '../../repositories/ticketQueryRepository';
import { holidayRepository } from '../../repositories/holidayRepository';
import { computeDashboard } from '../../services/ticket/dashboard';
import { calculateSLA, type SLAClockState } from '../../services/sla/calculateSLA';

interface TicketsArgs {
  status?: TicketStatus;
  priority?: Priority;
  assigneeId?: string;
  slaState?: SLAClockState;
  take?: number;
  cursor?: string;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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

export const ticketQueryResolvers = {
  Query: {
    tickets: async (_parent: unknown, args: TicketsArgs) => {
      const take = Math.min(args.take ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

      if (!args.slaState) {
        const result = await ticketQueryRepository.findPaginated({
          status: args.status,
          priority: args.priority,
          assigneeId: args.assigneeId,
          take,
          cursor: args.cursor,
        });

        return {
          nodes: result.nodes,
          pageInfo: {
            hasNextPage: result.hasNextPage,
            endCursor: result.endCursor,
          },
        };
      }

      // slaState filtering happens in-application since it's a computed value,
      // not a stored column. We fetch a broader batch, filter, then paginate
      // the filtered set manually.
      const holidays = await holidayRepository.findAll();
      const holidayDates = holidays.map((h) => h.date);

      const broadResult = await ticketQueryRepository.findPaginated({
        status: args.status,
        priority: args.priority,
        assigneeId: args.assigneeId,
        take: 1000,
      });

      const filtered = broadResult.nodes.filter(
        (ticket) => overallSLAState(ticket, holidayDates) === args.slaState
      );

      let startIndex = 0;
      if (args.cursor) {
        const cursorIndex = filtered.findIndex((t) => t.id === args.cursor);
        startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
      }

      const page = filtered.slice(startIndex, startIndex + take);
      const hasNextPage = startIndex + take < filtered.length;
      const endCursor = page.length > 0 ? page[page.length - 1]?.id ?? null : null;

      return {
        nodes: page,
        pageInfo: { hasNextPage, endCursor },
      };
    },

    dashboard: () => {
      return computeDashboard();
    },
  },
};