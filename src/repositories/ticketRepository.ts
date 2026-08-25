import { prisma } from '../db/client';
import type { Priority, TicketStatus } from '../generated/prisma';

export interface CreateTicketInput {
  title: string;
  description: string;
  priority: Priority;
  reporterId: string;
}

export const ticketRepository = {
  findById(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      include: { reporter: true, assignee: true, comments: { include: { author: true } } },
    });
  },

  create(input: CreateTicketInput) {
    return prisma.ticket.create({
      data: input,
      include: { reporter: true, assignee: true, comments: true },
    });
  },

  assign(ticketId: string, assigneeId: string) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data: { assigneeId },
      include: { reporter: true, assignee: true, comments: true },
    });
  },

  updateStatus(ticketId: string, status: TicketStatus) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data: { status },
      include: { reporter: true, assignee: true, comments: true },
    });
  },

  markResolved(ticketId: string) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
      include: { reporter: true, assignee: true, comments: true },
    });
  },

  setFirstResponseAt(ticketId: string, timestamp: Date) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data: { firstResponseAt: timestamp },
    });
  },
};