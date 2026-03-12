import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const orderId = searchParams.get("orderId");
    const employeeId = searchParams.get("employeeId");
    const type = searchParams.get("type");

    // Build date filter
    let dateFilter: Record<string, Date> = {};
    const now = new Date();
    
    if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (period !== "all") {
      switch (period) {
        case "day":
          dateFilter = {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lte: now,
          };
          break;
        case "week":
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          dateFilter = {
            gte: weekStart,
            lte: now,
          };
          break;
        case "month":
          dateFilter = {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lte: now,
          };
          break;
        case "quarter":
          const quarter = Math.floor(now.getMonth() / 3);
          dateFilter = {
            gte: new Date(now.getFullYear(), quarter * 3, 1),
            lte: now,
          };
          break;
        case "year":
          dateFilter = {
            gte: new Date(now.getFullYear(), 0, 1),
            lte: now,
          };
          break;
      }
    }

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }
    
    if (orderId) {
      where.orderId = orderId;
    }
    
    if (employeeId) {
      where.employeeId = employeeId;
    }
    
    if (type && (type === "INCOME" || type === "EXPENSE")) {
      where.type = type;
    }

    const records = await db.financialRecord.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            title: true,
            clientName: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate summary statistics
    const totalIncome = records
      .filter((r) => r.type === "INCOME")
      .reduce((sum, r) => sum + r.amount, 0);

    const totalExpenses = records
      .filter((r) => r.type === "EXPENSE")
      .reduce((sum, r) => sum + r.amount, 0);

    const profit = totalIncome - totalExpenses;

    // Calculate daily stats for charts
    const dailyStats: Record<string, { income: number; expense: number }> = {};
    
    records.forEach((record) => {
      const dateKey = new Date(record.createdAt).toISOString().split("T")[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { income: 0, expense: 0 };
      }
      if (record.type === "INCOME") {
        dailyStats[dateKey].income += record.amount;
      } else {
        dailyStats[dateKey].expense += record.amount;
      }
    });

    const chartData = Object.entries(dailyStats)
      .map(([date, stats]) => ({
        date,
        income: stats.income,
        expense: stats.expense,
        profit: stats.income - stats.expense,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      records,
      summary: {
        totalIncome,
        totalExpenses,
        profit,
        margin: totalIncome > 0 ? (profit / totalIncome) * 100 : 0,
        recordCount: records.length,
      },
      chartData,
    });
  } catch (error) {
    console.error("Error fetching finances:", error);
    return NextResponse.json(
      { error: "Failed to fetch finances" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, amount, description, orderId, employeeId } = body;

    const record = await db.financialRecord.create({
      data: {
        type,
        amount: parseFloat(amount),
        description,
        orderId,
        employeeId,
      },
      include: {
        order: {
          select: {
            id: true,
            title: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Error creating financial record:", error);
    return NextResponse.json(
      { error: "Failed to create financial record" },
      { status: 500 }
    );
  }
}
