import type { YogaInitialContext } from 'graphql-yoga';
import { verifyToken, type AuthTokenPayload } from '../services/auth/jwt';

export interface GraphQLContext {
  currentUser: AuthTokenPayload | null;
}

export function createContext(initialContext: YogaInitialContext): GraphQLContext {
  const authHeader = initialContext.request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const currentUser = token ? verifyToken(token) : null;

  return { currentUser };
}
