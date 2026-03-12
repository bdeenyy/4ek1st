"use server";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/payments - Get all payments with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const employeeId = searchParams.get("employeeId");
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");

    const where: Record<string, unknown> = {};

    if (status && ["PENDING", "PAID", "CANCELLED"].includes(status)) {
      where.status = status;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (periodStart && periodEnd) {
      where.periodStart = {
        gte: new Date(periodStart),
      };
      where.periodEnd = {
        lte: new Date(periodEnd),
      };
    }

    const payments = await db.payment.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate summary
    const totalPending = payments
      .filter((p) => p.status === "PENDING")
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPaid = payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({
      payments,
      summary: {
        totalPending,
        totalPaid,
        count: payments.length,
      },
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

// POST /api/payments - Create new payment
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, amount, periodStart, periodEnd, description, orderIds } = body;

    const payment = await db.payment.create({
      data: {
        employeeId,
        amount: parseFloat(amount),
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        description,
        orderIds: orderIds ? JSON.stringify(orderIds) : null,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Error creating payment:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}