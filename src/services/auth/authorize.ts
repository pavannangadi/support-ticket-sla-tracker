import type { UserRole } from '../../generated/prisma';
import { createAppError } from '../../graphql/errors';
import type { GraphQLContext } from '../../graphql/context';
import type { AuthTokenPayload } from './jwt';

export function requireAuth(context: GraphQLContext): AuthTokenPayload {
  if (!context.currentUser) {
    throw createAppError('UNAUTHORIZED', 'You must be logged in to perform this action.');
  }
  return context.currentUser;
}

export function requireRole(context: GraphQLContext, role: UserRole): AuthTokenPayload {
  const user = requireAuth(context);
  if (user.role !== role) {
    throw createAppError('FORBIDDEN', `This action requires the ${role} role.`);
  }
  return user;
}
