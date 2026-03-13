import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBot } from "@/bot";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isActive } = body;

    const bot = await db.bot.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json(bot);
  } catch (error) {
    console.error("Error updating bot:", error);
    return NextResponse.json(
      { error: "Failed to update bot" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Проверяем есть ли связанные заказы
    const ordersCount = await db.order.count({
      where: { botId: id },
    });
    
    const contactsCount = await db.contact.count({
      where: { botId: id },
    });
    
    if (ordersCount > 0 || contactsCount > 0) {
      return NextResponse.json(
        { 
          error: "Невозможно удалить бота", 
          details: `У бота есть связанные записи: ${ordersCount} заказов, ${contactsCount} контактов. Сначала удалите их или переназначьте на другого бота.` 
        },
        { status: 400 }
      );
    }
    
    // Попытка удалить вебхук из Telegram перед удалением из БД
    try {
      const activeBot = getBot(id);
      if (activeBot) {
        await activeBot.telegram.deleteWebhook();
      } else {
        const botData = await db.bot.findUnique({ where: { id } });
        if (botData) {
          // Вызываем API Telegram напрямую, если бот не загружен в память
          await fetch(`https://api.telegram.org/bot${botData.token}/deleteWebhook`);
        }
      }
    } catch (e) {
      console.warn("Failed to delete webhook from Telegram, continuing deletion...", e);
    }

    // Удаляем бота из БД
    await db.bot.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting bot:", error);
    return NextResponse.json(
      { error: "Failed to delete bot" },
      { status: 500 }
    );
  }
}
