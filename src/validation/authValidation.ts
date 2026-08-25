import { createAppError } from '../graphql/errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterInput(input: {
  name: string;
  email: string;
  password: string;
}): void {
  if (!input.name.trim()) {
    throw createAppError('VALIDATION_ERROR', 'Name cannot be empty.');
  }
  if (!EMAIL_REGEX.test(input.email)) {
    throw createAppError('VALIDATION_ERROR', 'A valid email address is required.');
  }
  if (input.password.length < 8) {
    throw createAppError('VALIDATION_ERROR', 'Password must be at least 8 characters.');
  }
}
