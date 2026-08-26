import { prisma } from '../db/client';

export const holidayRepository = {
  findAll() {
    return prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  },
};
