import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Get counts
    const [
      totalOrders,
      activeOrders,
      completedOrders,
      totalEmployees,
      availableEmployees,
      workingEmployees,
      totalBots,
      financialRecords,
      recentOrders,
      bots,
    ] = await Promise.all([
      db.order.count(),
      db.order.count({ where: { status: { in: ["PUBLISHED", "IN_PROGRESS"] } } }),
      db.order.count({ where: { status: "COMPLETED" } }),
      db.employee.count(),
      db.employee.count({ where: { status: "AVAILABLE" } }),
      db.employee.count({ where: { status: "WORKING" } }),
      db.bot.count(),
      db.financialRecord.findMany(),
      db.order.findMany({
        take: 10,
        include: {
          bot: true,
          responses: {
            include: {
              employee: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.bot.findMany({
        select: {
          id: true,
          name: true,
          city: true,
          subscriberCount: true,
          isActive: true,
        },
      }),
    ]);

    // Calculate financial summary
    const totalIncome = financialRecords
      .filter((r) => r.type === "INCOME")
      .reduce((sum, r) => sum + r.amount, 0);

    const totalExpenses = financialRecords
      .filter((r) => r.type === "EXPENSE")
      .reduce((sum, r) => sum + r.amount, 0);

    const profit = totalIncome - totalExpenses;

    // Count orders by payment status
    const unpaidOrders = await db.order.count({
      where: { paymentStatus: "NOT_PAID" },
    });

    const partialPaidOrders = await db.order.count({
      where: { paymentStatus: "PARTIAL" },
    });

    // Get recent responses
    const recentResponses = await db.orderResponse.findMany({
      take: 5,
      include: {
        employee: {
          include: { tags: true },
        },
        order: {
          select: { id: true, title: true },
        },
      },
      orderBy: { respondedAt: "desc" },
    });

    return NextResponse.json({
      stats: {
        totalOrders,
        activeOrders,
        completedOrders,
        totalEmployees,
        availableEmployees,
        workingEmployees,
        totalBots,
      },
      financials: {
        totalIncome,
        totalExpenses,
        profit,
        margin: totalIncome > 0 ? (profit / totalIncome) * 100 : 0,
      },
      paymentStats: {
        unpaid: unpaidOrders,
        partial: partialPaidOrders,
      },
      recentOrders,
      recentResponses,
      bots,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
