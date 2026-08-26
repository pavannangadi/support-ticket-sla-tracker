import type { SLAState } from '../api/types';

const stateConfig: Record<SLAState, { label: string; emoji: string; className: string }> = {
  ON_TRACK: { label: 'On Track', emoji: '🟢', className: 'sla-on-track' },
  AT_RISK: { label: 'At Risk', emoji: '🟠', className: 'sla-at-risk' },
  BREACHED: { label: 'Breached', emoji: '🔴', className: 'sla-breached' },
};

interface SLABadgeProps {
  state: SLAState;
  remainingMinutes?: number;
}

export function SLABadge({ state, remainingMinutes }: SLABadgeProps) {
  const config = stateConfig[state];

  let detail = '';
  if (state !== 'BREACHED' && remainingMinutes !== undefined) {
    if (remainingMinutes >= 60) {
      const hours = Math.floor(remainingMinutes / 60);
      const mins = remainingMinutes % 60;
      detail = `${hours}h ${mins}m remaining`;
    } else {
      detail = `${remainingMinutes}m remaining`;
    }
  }

  return (
    <span className={`sla-badge ${config.className}`}>
      {config.emoji} {config.label}
      {detail && ` — ${detail}`}
    </span>
  );
}