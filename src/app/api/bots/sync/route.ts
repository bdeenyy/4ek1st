import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const bots = await db.bot.findMany();
    const results = [];

    for (const bot of bots) {
      const contactCount = await db.contact.count({
        where: { botId: bot.id },
      });

      const updatedBot = await db.bot.update({
        where: { id: bot.id },
        data: { subscriberCount: contactCount },
      });

      results.push({
        id: bot.id,
        name: bot.name,
        oldCount: bot.subscriberCount,
        newCount: contactCount,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Sync completed",
      results,
    });
  } catch (error) {
    console.error("Error syncing bots:", error);
    return NextResponse.json(
      { success: false, error: "Failed to sync bots" },
      { status: 500 }
    );
  }
}
