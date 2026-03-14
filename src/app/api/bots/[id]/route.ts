import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBot, createBot } from "@/bot";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isActive, name, description, city, telegramManagerId } = body;

    const updateData: Record<string, unknown> = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (name !== undefined && name !== "") updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (city !== undefined && city !== "") updateData.city = city;
    if (telegramManagerId !== undefined) updateData.telegramManagerId = telegramManagerId || null;

    const updatedBot = await db.bot.update({
      where: { id },
      data: updateData,
    });

    // Синхронизируем имя/описание с Telegram API (ошибки не критичны)
    if (name || description !== undefined) {
      try {
        const tgBot = getBot(id) ?? createBot(updatedBot.token, id);
        if (name) {
          await tgBot.telegram.setMyName(name).catch((e: unknown) =>
            console.warn("[Bot PATCH] setMyName failed:", e)
          );
        }
        if (description !== undefined) {
          await tgBot.telegram.setMyDescription(description ?? "").catch((e: unknown) =>
            console.warn("[Bot PATCH] setMyDescription failed:", e)
          );
        }
      } catch (e) {
        console.warn("[Bot PATCH] Telegram sync skipped:", e);
      }
    }

    return NextResponse.json(updatedBot);
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

    const ordersCount = await db.order.count({ where: { botId: id } });
    const contactsCount = await db.contact.count({ where: { botId: id } });

    if (ordersCount > 0 || contactsCount > 0) {
      return NextResponse.json(
        {
          error: "Невозможно удалить бота",
          details: `У бота есть связанные записи: ${ordersCount} заказов, ${contactsCount} контактов. Сначала удалите их или переназначьте на другого бота.`,
        },
        { status: 400 }
      );
    }

    try {
      const activeBot = getBot(id);
      if (activeBot) {
        await activeBot.telegram.deleteWebhook();
      } else {
        const botData = await db.bot.findUnique({ where: { id } });
        if (botData) {
          await fetch(`https://api.telegram.org/bot${botData.token}/deleteWebhook`);
        }
      }
    } catch (e) {
      console.warn("Failed to delete webhook from Telegram, continuing deletion...", e);
    }

    await db.bot.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting bot:", error);
    return NextResponse.json({ error: "Failed to delete bot" }, { status: 500 });
  }
}
