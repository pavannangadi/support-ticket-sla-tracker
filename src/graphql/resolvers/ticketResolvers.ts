import type { Priority, TicketStatus, Ticket as PrismaTicket } from '../../generated/prisma';
import { ticketRepository } from '../../repositories/ticketRepository';
import { userRepository } from '../../repositories/userRepository';
import { holidayRepository } from '../../repositories/holidayRepository';
import { validateCreateTicketInput } from '../../validation/ticketValidation';
import { assertValidTransition } from '../../services/ticket/statusTransitions';
import { calculateSLA } from '../../services/sla/calculateSLA';
import { requireAuth, requireRole } from '../../services/auth/authorize';
import { createAppError } from '../errors';
import type { GraphQLContext } from '../context';

interface CreateTicketArgs {
  title: string;
  description: string;
  priority: Priority;
}

interface AssignTicketArgs {
  ticketId: string;
  assigneeId: string;
}

interface ChangeStatusArgs {
  ticketId: string;
  status: TicketStatus;
}

interface ResolveTicketArgs {
  ticketId: string;
}

async function findTicketOrThrow(id: string) {
  const ticket = await ticketRepository.findById(id);
  if (!ticket) {
    throw createAppError('TICKET_NOT_FOUND', `Ticket with id ${id} was not found.`);
  }
  return ticket;
}

export const ticketResolvers = {
  Ticket: {
    createdAt: (parent: PrismaTicket) => parent.createdAt.toISOString(),
    firstResponseAt: (parent: PrismaTicket) => parent.firstResponseAt?.toISOString() ?? null,
    resolvedAt: (parent: PrismaTicket) => parent.resolvedAt?.toISOString() ?? null,

    sla: async (parent: PrismaTicket) => {
      const holidays = await holidayRepository.findAll();
      const holidayDates = holidays.map((h) => h.date);

      const result = calculateSLA({
        priority: parent.priority,
        createdAt: parent.createdAt,
        firstResponseAt: parent.firstResponseAt,
        resolvedAt: parent.resolvedAt,
        holidayDates,
      });

      return {
        firstResponseDueAt: result.firstResponseDueAt.toISOString(),
        resolutionDueAt: result.resolutionDueAt.toISOString(),
        firstResponseState: result.firstResponseState,
        resolutionState: result.resolutionState,
        firstResponseRemainingMinutes: Math.round(result.firstResponseRemainingMinutes),
        resolutionRemainingMinutes: Math.round(result.resolutionRemainingMinutes),
      };
    },
  },

  Query: {
    ticket: (_parent: unknown, args: { id: string }) => {
      return ticketRepository.findById(args.id);
    },
  },

  Mutation: {
    createTicket: async (_parent: unknown, args: CreateTicketArgs, context: GraphQLContext) => {
      const user = requireAuth(context);
      validateCreateTicketInput(args);

      return ticketRepository.create({
        title: args.title,
        description: args.description,
        priority: args.priority,
        reporterId: user.userId,
      });
    },

    assignTicket: async (_parent: unknown, args: AssignTicketArgs, context: GraphQLContext) => {
      requireRole(context, 'AGENT');

      await findTicketOrThrow(args.ticketId);

      const assignee = await userRepository.findById(args.assigneeId);
      if (!assignee) {
        throw createAppError('USER_NOT_FOUND', `User with id ${args.assigneeId} was not found.`);
      }

      return ticketRepository.assign(args.ticketId, args.assigneeId);
    },

    changeTicketStatus: async (_parent: unknown, args: ChangeStatusArgs, context: GraphQLContext) => {
      requireRole(context, 'AGENT');

      const ticket = await findTicketOrThrow(args.ticketId);
      assertValidTransition(ticket.status, args.status);

      return ticketRepository.updateStatus(args.ticketId, args.status);
    },

    resolveTicket: async (_parent: unknown, args: ResolveTicketArgs, context: GraphQLContext) => {
      requireRole(context, 'AGENT');

      const ticket = await findTicketOrThrow(args.ticketId);
      assertValidTransition(ticket.status, 'RESOLVED');

      return ticketRepository.markResolved(args.ticketId);
    },
  },
};