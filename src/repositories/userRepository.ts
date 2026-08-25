import { prisma } from '../db/client';
import type { UserRole } from '../generated/prisma';

export const userRepository = {
  findMany(role?: UserRole) {
    return prisma.user.findMany({
      where: role ? { role } : undefined,
      orderBy: { createdAt: 'asc' },
    });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
};
