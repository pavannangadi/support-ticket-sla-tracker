import { createAppError } from '../graphql/errors';

export function validateCommentInput(input: { content: string }): void {
  if (!input.content.trim()) {
    throw createAppError('INVALID_COMMENT', 'Comment content cannot be empty.');
  }
}
