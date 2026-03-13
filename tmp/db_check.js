const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const counts = {
    orders: await prisma.order.count(),
    publishedOrders: await prisma.order.count({ where: { status: 'PUBLISHED' } }),
    inProgressOrders: await prisma.order.count({ where: { status: 'IN_PROGRESS' } }),
    completedOrders: await prisma.order.count({ where: { status: 'COMPLETED' } }),
    employees: await prisma.employee.count(),
    workingEmployees: await prisma.employee.count({ where: { status: 'WORKING' } }),
    contacts: await prisma.contact.count(),
    bots: await prisma.bot.count(),
    responses: await prisma.orderResponse.count(),
    financialRecords: await prisma.financialRecord.count(),
  };

  console.log('Database Counts:', JSON.stringify(counts, null, 2));

  if (counts.responses > 0) {
    const recentResponses = await prisma.orderResponse.findMany({
      take: 5,
      include: {
        employee: true,
        order: true,
      },
      orderBy: { respondedAt: 'desc' },
    });
    console.log('Recent Responses:', JSON.stringify(recentResponses, null, 2));
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
