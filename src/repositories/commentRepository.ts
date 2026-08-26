import { prisma } from '../db/client';

export interface CreateCommentInput {
  ticketId: string;
  authorId: string;
  content: string;
}

export const commentRepository = {
  create(input: CreateCommentInput) {
    return prisma.comment.create({
      data: input,
      include: { author: true },
    });
  },

  findByTicketId(ticketId: string) {
    return prisma.comment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: { author: true },
    });
  },
};
