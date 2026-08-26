import { prisma } from '../db/client';

export interface CreateCommentInput {
  ticketId: string;
  authorId: string;
  content: string;
}

export const commentRepository = {
  async create(input: CreateCommentInput) {
    const comment = await prisma.comment.create({ data: input });
    return prisma.comment.findUniqueOrThrow({
      where: { id: comment.id },
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
