
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  console.log('--- Verifying Subscriber Count Consistency ---');
  
  const bots = await prisma.bot.findMany({
    include: {
      _count: {
        select: { contacts: true }
      }
    }
  });

  let allConsistent = true;
  for (const bot of bots) {
    const actualCount = bot._count.contacts;
    const reportedCount = bot.subscriberCount;
    
    console.log(`Bot: ${bot.name} (${bot.city})`);
    console.log(`  Reported subscriberCount in DB: ${reportedCount}`);
    console.log(`  Actual total contacts in DB: ${actualCount}`);
    
    if (actualCount !== reportedCount) {
      console.log(`  [!] INCONSISTENCY DETECTED`);
      allConsistent = false;
    } else {
      console.log(`  [✓] Consistent`);
    }
  }

  if (allConsistent) {
    console.log('\nResult: All bots have consistent subscriber counts.');
  } else {
    console.log('\nResult: Some inconsistencies found. Syncing counts...');
    for (const bot of bots) {
      if (bot.subscriberCount !== bot._count.contacts) {
        await prisma.bot.update({
          where: { id: bot.id },
          data: { subscriberCount: bot._count.contacts }
        });
        console.log(`  Updated ${bot.name} to ${bot._count.contacts}`);
      }
    }
    console.log('Sync complete.');
  }
}

verify()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
