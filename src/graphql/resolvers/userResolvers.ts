import { userRepository } from '../../repositories/userRepository';
import type { UserRole } from '../../generated/prisma';

export const userResolvers = {
  Query: {
    users: (_parent: unknown, args: { role?: UserRole }) => {
      return userRepository.findMany(args.role);
    },
  },
};
