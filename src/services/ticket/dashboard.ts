import { prisma } from '../../db/client';
import { calculateSLA } from '../sla/calculateSLA';
import { holidayRepository } from '../../repositories/holidayRepository';

export interface DashboardStats {
  openTickets: number;
  inProgressTickets: number;
  atRiskTickets: number;
  breachedTickets: number;
}

export async function computeDashboard(): Promise<DashboardStats> {
  const [openTickets, inProgressTickets, activeTickets] = await Promise.all([
    prisma.ticket.count({ where: { status: 'OPEN' } }),
    prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.ticket.findMany({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
  ]);

  const holidays = await holidayRepository.findAll();
  const holidayDates = holidays.map((h) => h.date);

  let atRiskTickets = 0;
  let breachedTickets = 0;

  for (const ticket of activeTickets) {
    const sla = calculateSLA({
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      firstResponseAt: ticket.firstResponseAt,
      resolvedAt: ticket.resolvedAt,
      holidayDates,
    });

    const isAtRisk = sla.firstResponseState === 'AT_RISK' || sla.resolutionState === 'AT_RISK';
    const isBreached = sla.firstResponseState === 'BREACHED' || sla.resolutionState === 'BREACHED';

    if (isBreached) {
      breachedTickets++;
    } else if (isAtRisk) {
      atRiskTickets++;
    }
  }

  return { openTickets, inProgressTickets, atRiskTickets, breachedTickets };
}