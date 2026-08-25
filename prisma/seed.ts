import { prisma } from '../src/db/client';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  const reporter = await prisma.user.upsert({
    where: { email: 'reporter@example.com' },
    update: {},
    create: {
      name: 'Riya Reporter',
      email: 'reporter@example.com',
      password: passwordHash,
      role: 'REPORTER',
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@example.com' },
    update: {},
    create: {
      name: 'Amit Agent',
      email: 'agent@example.com',
      password: passwordHash,
      role: 'AGENT',
    },
  });

  console.log('Users created:', { reporter: reporter.email, agent: agent.email });

  const holiday = await prisma.holiday.upsert({
    where: { date: new Date('2026-08-15') },
    update: {},
    create: {
      date: new Date('2026-08-15'),
      name: 'Independence Day',
    },
  });

  console.log('Holiday created:', holiday.name);

  const urgentTicket = await prisma.ticket.create({
    data: {
      title: 'Payment failed on checkout',
      description: 'User reports payment gateway timeout during checkout.',
      priority: 'URGENT',
      status: 'OPEN',
      reporterId: reporter.id,
    },
  });

  const highTicket = await prisma.ticket.create({
    data: {
      title: 'Login issue on mobile app',
      description: 'Users cannot log in using the mobile app on Android.',
      priority: 'HIGH',
      status: 'OPEN',
      reporterId: reporter.id,
    },
  });

  const mediumTicket = await prisma.ticket.create({
    data: {
      title: 'Dashboard chart rendering slowly',
      description: 'Dashboard takes several seconds to render charts.',
      priority: 'MEDIUM',
      status: 'OPEN',
      reporterId: reporter.id,
    },
  });

  const lowTicket = await prisma.ticket.create({
    data: {
      title: 'Minor UI alignment issue',
      description: 'Button is slightly misaligned on settings page.',
      priority: 'LOW',
      status: 'OPEN',
      reporterId: reporter.id,
    },
  });

  console.log('Tickets created:', [
    urgentTicket.title,
    highTicket.title,
    mediumTicket.title,
    lowTicket.title,
  ]);

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });