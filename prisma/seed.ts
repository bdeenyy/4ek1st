import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  // Хешируем пароль
  const hashedPassword = await bcrypt.hash("password", 10);
  
  // Создаем пользователя-администратора
  const admin = await db.user.create({
    data: {
      email: "admin@personal24.ru",
      name: "Администратор",
      password: hashedPassword,
      role: "ADMIN",
    },
  });
  
  // Создаем пользователя-менеджера
  const manager = await db.user.create({
    data: {
      email: "manager@personal24.ru",
      name: "Менеджер Москва",
      password: hashedPassword,
      role: "MANAGER",
    },
  });

  // Создаем теги для сотрудников
  const tagLoader = await db.employeeTag.create({
    data: { name: "Грузчик", color: "#3B82F6", type: "SKILL" },
  });
  
  const tagBuilder = await db.employeeTag.create({
    data: { name: "Строительные работы", color: "#10B981", type: "SKILL" },
  });
  
  const tagCleaner = await db.employeeTag.create({
    data: { name: "Уборка", color: "#F59E0B", type: "SKILL" },
  });
  
  const tagBlacklist = await db.employeeTag.create({
    data: { name: "Черный список", color: "#EF4444", type: "STATUS" },
  });

  // Создаем ботов
  const botMoscow = await db.bot.create({
    data: {
      name: "Персонал24 Москва",
      token: "bot_token_moscow_123",
      city: "Москва",
      description: "Бот для найма персонала в Москве",
      subscriberCount: 1234,
      ownerId: admin.id,
    },
  });

  const botSPb = await db.bot.create({
    data: {
      name: "Персонал24 СПб",
      token: "bot_token_spb_456",
      city: "Санкт-Петербург",
      description: "Бот для найма персонала в Санкт-Петербурге",
      subscriberCount: 892,
      ownerId: admin.id,
    },
  });

  const botEkb = await db.bot.create({
    data: {
      name: "Персонал24 Екатеринбург",
      token: "bot_token_ekb_789",
      city: "Екатеринбург",
      description: "Бот для найма персонала в Екатеринбурге",
      subscriberCount: 567,
      ownerId: admin.id,
    },
  });

  // Создаем сотрудников
  const employees = await Promise.all([
    db.employee.create({
      data: {
        firstName: "Алексей",
        lastName: "Сидоров",
        middleName: "Петрович",
        phone: "+7 (999) 111-22-33",
        telegramId: "telegram_1",
        rating: 4.8,
        status: "AVAILABLE",
        tags: { connect: [{ id: tagLoader.id }] },
      },
    }),
    db.employee.create({
      data: {
        firstName: "Дмитрий",
        lastName: "Козлов",
        middleName: "Иванович",
        phone: "+7 (999) 222-33-44",
        telegramId: "telegram_2",
        rating: 4.5,
        status: "WORKING",
        tags: { connect: [{ id: tagLoader.id }, { id: tagBuilder.id }] },
      },
    }),
    db.employee.create({
      data: {
        firstName: "Николай",
        lastName: "Морозов",
        middleName: "Сергеевич",
        phone: "+7 (999) 333-44-55",
        telegramId: "telegram_3",
        rating: 4.9,
        status: "AVAILABLE",
        tags: { connect: [{ id: tagBuilder.id }] },
      },
    }),
    db.employee.create({
      data: {
        firstName: "Иван",
        lastName: "Петров",
        middleName: "Александрович",
        phone: "+7 (999) 444-55-66",
        telegramId: "telegram_4",
        rating: 3.2,
        status: "BANNED",
        tags: { connect: [{ id: tagBlacklist.id }] },
      },
    }),
    db.employee.create({
      data: {
        firstName: "Сергей",
        lastName: "Волков",
        middleName: "Николаевич",
        phone: "+7 (999) 555-66-77",
        phone2: "+7 (999) 555-66-88",
        telegramId: "telegram_5",
        rating: 4.7,
        status: "AVAILABLE",
        tags: { connect: [{ id: tagLoader.id }, { id: tagCleaner.id }] },
      },
    }),
  ]);

  // Создаем шаблон заказа
  const template = await db.orderTemplate.create({
    data: {
      name: "Стандартный погрузка",
      description: "Шаблон для стандартных погрузочных работ",
      workType: "Погрузочные работы",
      requiredPeople: 2,
      checklists: JSON.stringify(["Трезвость", "Спецодежда", "Перчатки"]),
    },
  });

  // Создаем заказы
  const orders = await Promise.all([
    db.order.create({
      data: {
        title: "Погрузка мебели",
        description: "Погрузка офисной мебели при переезде",
        clientName: "Иванов Петр Сергеевич",
        clientPhone: "+7 (999) 123-45-67",
        district: "Центральный",
        street: "ул. Ленина",
        houseNumber: "45",
        officeNumber: "301",
        workDate: new Date("2024-01-15"),
        workTime: "09:00",
        workType: "Погрузочные работы",
        requiredPeople: 4,
        pricePerPerson: 2500,
        status: "IN_PROGRESS",
        paymentStatus: "PARTIAL",
        botId: botMoscow.id,
        creatorId: admin.id,
        checklists: JSON.stringify(["Трезвость", "Спецодежда"]),
      },
    }),
    db.order.create({
      data: {
        title: "Строительные работы",
        description: "Помощь на стройплощадке",
        clientName: "СМК Строй",
        clientPhone: "+7 (999) 234-56-78",
        district: "Северный",
        street: "пр. Мира",
        houseNumber: "120",
        workDate: new Date("2024-01-15"),
        workTime: "10:00",
        workType: "Строительные работы",
        requiredPeople: 8,
        pricePerPerson: 3000,
        status: "PUBLISHED",
        paymentStatus: "NOT_PAID",
        botId: botMoscow.id,
        creatorId: admin.id,
      },
    }),
    db.order.create({
      data: {
        title: "Разгрузка товара",
        description: "Разгрузка фуры со склад",
        clientName: "ООО Логистика",
        clientPhone: "+7 (999) 345-67-89",
        district: "Промзона",
        street: "ул. Промышленная",
        houseNumber: "8",
        workDate: new Date("2024-01-14"),
        workTime: "08:00",
        workType: "Разгрузка",
        requiredPeople: 6,
        pricePerPerson: 2200,
        status: "COMPLETED",
        paymentStatus: "PAID",
        botId: botSPb.id,
        creatorId: admin.id,
      },
    }),
    db.order.create({
      data: {
        title: "Уборка территории",
        description: "Уборка придомовой территории",
        clientName: "Петрова Анна Ивановна",
        clientPhone: "+7 (999) 456-78-90",
        district: "Западный",
        street: "ул. Советская",
        houseNumber: "15",
        workDate: new Date("2024-01-15"),
        workTime: "14:00",
        workType: "Уборка",
        requiredPeople: 2,
        pricePerPerson: 2000,
        status: "IN_PROGRESS",
        paymentStatus: "PAID",
        botId: botEkb.id,
        creatorId: admin.id,
      },
    }),
    db.order.create({
      data: {
        title: "Инвентаризация",
        description: "Проведение инвентаризации на складе",
        clientName: "Склад №5",
        clientPhone: "+7 (999) 567-89-01",
        district: "Восточный",
        street: "ул. Складская",
        houseNumber: "1",
        workDate: new Date("2024-01-16"),
        workTime: "09:00",
        workType: "Инвентаризация",
        requiredPeople: 10,
        pricePerPerson: 1800,
        status: "PUBLISHED",
        paymentStatus: "NOT_PAID",
        botId: botMoscow.id,
        creatorId: admin.id,
        templateId: template.id,
      },
    }),
  ]);

  // Создаем финансовые записи
  await Promise.all([
    db.financialRecord.create({
      data: {
        type: "INCOME",
        amount: 52800,
        description: "Оплата за заказ ORD-1236",
        orderId: orders[2].id,
      },
    }),
    db.financialRecord.create({
      data: {
        type: "INCOME",
        amount: 10000,
        description: "Частичная оплата за заказ",
        orderId: orders[0].id,
      },
    }),
    db.financialRecord.create({
      data: {
        type: "EXPENSE",
        amount: 13200,
        description: "Выплата 6 сотрудникам",
        orderId: orders[2].id,
        employeeId: employees[0].id,
      },
    }),
    db.financialRecord.create({
      data: {
        type: "INCOME",
        amount: 4000,
        description: "Оплата за уборку",
        orderId: orders[3].id,
      },
    }),
  ]);

  // Создаем контакты
  await Promise.all([
    db.contact.create({
      data: {
        telegramId: "tg_contact_1",
        firstName: "Александр",
        lastName: "Новиков",
        username: "alex_novikov",
        phone: "+7 (999) 666-77-88",
        status: "APPROVED",
        botId: botMoscow.id,
      },
    }),
    db.contact.create({
      data: {
        telegramId: "tg_contact_2",
        firstName: "Михаил",
        lastName: "Кузнецов",
        username: "mike_kuz",
        status: "NEW",
        botId: botMoscow.id,
      },
    }),
    db.contact.create({
      data: {
        telegramId: "tg_contact_3",
        firstName: "Андрей",
        lastName: "Соколов",
        username: "andr_sokol",
        phone: "+7 (999) 888-99-00",
        status: "BANNED",
        botId: botSPb.id,
        notes: "Нарушение правил",
      },
    }),
  ]);

  console.log("Seed completed successfully!");
  console.log({
    users: 2,
    bots: 3,
    employees: employees.length,
    orders: orders.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });