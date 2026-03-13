import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const contacts = await db.contact.findMany({
      include: {
        bot: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
      orderBy: {
        registeredAt: "desc",
      },
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, notes } = body;

    // Получаем текущий контакт для определения изменений
    const currentContact = await db.contact.findUnique({
      where: { id },
      select: { status: true, botId: true }
    });

    if (!currentContact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const contact = await db.contact.update({
      where: { id },
      data: {
        status,
        notes,
        approvedAt: status === "APPROVED" ? new Date() : undefined,
      },
    });

    // Обновляем счётчик подписчиков бота
    // Пересчитываем количество одобренных контактов
    if (currentContact.status !== status) {
      const approvedCount = await db.contact.count({
        where: {
          botId: contact.botId,
          status: "APPROVED"
        }
      });

      await db.bot.update({
        where: { id: contact.botId },
        data: { subscriberCount: approvedCount }
      });
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}
