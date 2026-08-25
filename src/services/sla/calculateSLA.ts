import type { Priority } from '../../generated/prisma';
import { addBusinessHours, businessMinutesBetween, defaultBusinessHoursConfig, type BusinessHoursConfig } from './businessHours';
import { slaPolicies } from './policies';

export type SLAClockState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED';

export interface SLAClockResult {
  dueAt: Date;
  state: SLAClockState;
  remainingMinutes: number;
}

const AT_RISK_THRESHOLD = 0.75;

/**
 * Computes the state and remaining time for a single SLA clock (either
 * first-response or resolution), anchored at `evaluationTime`.
 *
 * `evaluationTime` is either "now" (for a live, still-ticking clock) or the
 * actual completion timestamp (for a frozen, already-completed clock) —
 * the math is identical either way, only the anchor point differs.
 */
function evaluateClock(
  createdAt: Date,
  dueAt: Date,
  budgetHours: number,
  evaluationTime: Date,
  holidayDates: Date[],
  config: BusinessHoursConfig
): { state: SLAClockState; remainingMinutes: number } {
  const remainingMinutes = businessMinutesBetween(evaluationTime, dueAt, holidayDates, config);

  if (evaluationTime >= dueAt) {
    return { state: 'BREACHED', remainingMinutes: 0 };
  }

  const elapsedMinutes = businessMinutesBetween(createdAt, evaluationTime, holidayDates, config);
  const budgetMinutes = budgetHours * 60;
  const percentConsumed = budgetMinutes === 0 ? 1 : elapsedMinutes / budgetMinutes;

  const state: SLAClockState = percentConsumed > AT_RISK_THRESHOLD ? 'AT_RISK' : 'ON_TRACK';

  return { state, remainingMinutes: Math.max(0, remainingMinutes) };
}

export interface CalculateSLAInput {
  priority: Priority;
  createdAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  holidayDates: Date[];
  now?: Date;
  config?: BusinessHoursConfig;
}

export interface SLAResult {
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
  firstResponseState: SLAClockState;
  resolutionState: SLAClockState;
  firstResponseRemainingMinutes: number;
  resolutionRemainingMinutes: number;
}

export function calculateSLA(input: CalculateSLAInput): SLAResult {
  const config = input.config ?? defaultBusinessHoursConfig;
  const now = input.now ?? new Date();
  const policy = slaPolicies[input.priority];

  const firstResponseDueAt = addBusinessHours(
    input.createdAt,
    policy.firstResponseHours,
    input.holidayDates,
    config
  );

  const resolutionDueAt = addBusinessHours(
    input.createdAt,
    policy.resolutionHours,
    input.holidayDates,
    config
  );

  const firstResponseEvaluationTime = input.firstResponseAt ?? now;
  const firstResponseClock = evaluateClock(
    input.createdAt,
    firstResponseDueAt,
    policy.firstResponseHours,
    firstResponseEvaluationTime,
    input.holidayDates,
    config
  );

  const resolutionEvaluationTime = input.resolvedAt ?? now;
  const resolutionClock = evaluateClock(
    input.createdAt,
    resolutionDueAt,
    policy.resolutionHours,
    resolutionEvaluationTime,
    input.holidayDates,
    config
  );

  return {
    firstResponseDueAt,
    resolutionDueAt,
    firstResponseState: firstResponseClock.state,
    resolutionState: resolutionClock.state,
    firstResponseRemainingMinutes: firstResponseClock.remainingMinutes,
    resolutionRemainingMinutes: resolutionClock.remainingMinutes,
  };
}