import { describe, it, expect } from 'bun:test';
import { isFirstResponse } from '../../src/services/ticket/firstResponse';

describe('isFirstResponse', () => {
  it('is true when a non-reporter comments and no response recorded yet', () => {
    const result = isFirstResponse({
      reporterId: 'reporter-1',
      authorId: 'agent-1',
      firstResponseAt: null,
    });
    expect(result).toBe(true);
  });

  it('is false when the reporter comments on their own ticket', () => {
    const result = isFirstResponse({
      reporterId: 'reporter-1',
      authorId: 'reporter-1',
      firstResponseAt: null,
    });
    expect(result).toBe(false);
  });

  it('is false when a first response was already recorded', () => {
    const result = isFirstResponse({
      reporterId: 'reporter-1',
      authorId: 'agent-1',
      firstResponseAt: new Date('2026-01-01T10:00:00Z'),
    });
    expect(result).toBe(false);
  });

  it('is false for a subsequent non-reporter comment after the first response', () => {
    // Simulates: agent already responded once, now agent comments again
    const result = isFirstResponse({
      reporterId: 'reporter-1',
      authorId: 'agent-1',
      firstResponseAt: new Date('2026-01-01T10:00:00Z'),
    });
    expect(result).toBe(false);
  });
});