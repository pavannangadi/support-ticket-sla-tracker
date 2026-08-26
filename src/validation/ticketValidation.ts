import { createAppError } from '../graphql/errors';

const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function validateCreateTicketInput(input: {
  title: string;
  description: string;
  priority: string;
}): void {
  if (!input.title.trim()) {
    throw createAppError('VALIDATION_ERROR', 'Ticket title cannot be empty.');
  }
  if (!input.description.trim()) {
    throw createAppError('VALIDATION_ERROR', 'Ticket description cannot be empty.');
  }
  if (!VALID_PRIORITIES.includes(input.priority)) {
    throw createAppError('INVALID_PRIORITY', `Invalid priority: ${input.priority}.`);
  }
}