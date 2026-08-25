import { prisma } from '../db/client';
import type { UserRole } from '../generated/prisma';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

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

  create(input: CreateUserInput) {
    return prisma.user.create({ data: input });
  },
};
