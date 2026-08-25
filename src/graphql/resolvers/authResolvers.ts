import type { UserRole } from '../../generated/prisma';
import { userRepository } from '../../repositories/userRepository';
import { hashPassword, verifyPassword } from '../../services/auth/password';
import { signToken } from '../../services/auth/jwt';
import { validateRegisterInput } from '../../validation/authValidation';
import { createAppError } from '../errors';

interface RegisterArgs {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

interface LoginArgs {
  email: string;
  password: string;
}

export const authResolvers = {
  Mutation: {
    register: async (_parent: unknown, args: RegisterArgs) => {
      validateRegisterInput(args);

      const existing = await userRepository.findByEmail(args.email);
      if (existing) {
        throw createAppError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
      }

      const passwordHash = await hashPassword(args.password);
      const user = await userRepository.create({
        name: args.name,
        email: args.email,
        password: passwordHash,
        role: args.role,
      });

      const token = signToken({ userId: user.id, role: user.role });
      return { token, user };
    },

    login: async (_parent: unknown, args: LoginArgs) => {
      const user = await userRepository.findByEmail(args.email);
      if (!user) {
        throw createAppError('INVALID_CREDENTIALS', 'Invalid email or password.');
      }

      const passwordValid = await verifyPassword(args.password, user.password);
      if (!passwordValid) {
        throw createAppError('INVALID_CREDENTIALS', 'Invalid email or password.');
      }

      const token = signToken({ userId: user.id, role: user.role });
      return { token, user };
    },
  },
};