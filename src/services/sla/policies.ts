import type { Priority } from '../../generated/prisma';

export interface SLAPolicy {
  firstResponseHours: number;
  resolutionHours: number;
}

export const slaPolicies: Record<Priority, SLAPolicy> = {
  URGENT: { firstResponseHours: 1, resolutionHours: 4 },
  HIGH: { firstResponseHours: 4, resolutionHours: 24 },
  MEDIUM: { firstResponseHours: 8, resolutionHours: 48 },
  LOW: { firstResponseHours: 24, resolutionHours: 72 },
};
