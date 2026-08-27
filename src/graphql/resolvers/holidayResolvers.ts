import { holidayRepository } from '../../repositories/holidayRepository';

export const holidayResolvers = {
  Holiday: {
    date: (parent: { date: Date }) => parent.date.toISOString().split('T')[0],
  },

  Query: {
    holidays: () => {
      return holidayRepository.findAll();
    },
  },
};
