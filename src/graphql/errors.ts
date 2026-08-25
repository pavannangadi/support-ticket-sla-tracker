import { GraphQLError } from 'graphql';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'TICKET_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_STATUS_TRANSITION'
  | 'INVALID_PRIORITY'
  | 'INVALID_COMMENT'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS';

export function createAppError(code: ErrorCode, message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code },
  });
}
