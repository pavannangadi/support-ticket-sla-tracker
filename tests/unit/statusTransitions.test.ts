import { describe, it, expect } from 'bun:test';
import { assertValidTransition } from '../../src/services/ticket/statusTransitions';

describe('assertValidTransition', () => {
  it('allows OPEN -> IN_PROGRESS', () => {
    expect(() => assertValidTransition('OPEN', 'IN_PROGRESS')).not.toThrow();
  });

  it('allows IN_PROGRESS -> RESOLVED', () => {
    expect(() => assertValidTransition('IN_PROGRESS', 'RESOLVED')).not.toThrow();
  });

  it('allows RESOLVED -> CLOSED', () => {
    expect(() => assertValidTransition('RESOLVED', 'CLOSED')).not.toThrow();
  });

  it('allows CLOSED -> OPEN (explicit reopen)', () => {
    expect(() => assertValidTransition('CLOSED', 'OPEN')).not.toThrow();
  });

  it('rejects CLOSED -> IN_PROGRESS directly', () => {
    expect(() => assertValidTransition('CLOSED', 'IN_PROGRESS')).toThrow();
  });

  it('rejects RESOLVED -> IN_PROGRESS directly', () => {
    expect(() => assertValidTransition('RESOLVED', 'IN_PROGRESS')).toThrow();
  });

  it('rejects OPEN -> RESOLVED (skipping IN_PROGRESS)', () => {
    expect(() => assertValidTransition('OPEN', 'RESOLVED')).toThrow();
  });

  it('rejects a no-op transition to the same status', () => {
    expect(() => assertValidTransition('OPEN', 'OPEN')).toThrow();
  });
});