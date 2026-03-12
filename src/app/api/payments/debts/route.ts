import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/payments/debts - Calculate employee debts for payments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    // Get all completed order responses where employee was assigned
    const completedResponses = await db.orderResponse.findMany({
      where: {
        status: "COMPLETED",
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        order: {
          select: {
            id: true,
            title: true,
            workDate: true,
            pricePerPerson: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    // Get all payments to calculate what's already paid
    const payments = await db.payment.findMany({
      where: {
        status: "PAID",
        ...(employeeId ? { employeeId } : {}),
      },
    });

    // Group by employee
    const employeeDebts: Record<string, {
      employee: {
        id: string;
        firstName: string;
        lastName: string;
        phone: string;
      };
      totalEarned: number;
      totalPaid: number;
      debt: number;
      orders: Array<{
        id: string;
        title: string;
        workDate: Date;
        amount: number;
      }>;
    }> = {};

    // Calculate earned amounts
    for (const response of completedResponses) {
      const empId = response.employeeId;
      
      if (!employeeDebts[empId]) {
        employeeDebts[empId] = {
          employee: response.employee,
          totalEarned: 0,
          totalPaid: 0,
          debt: 0,
          orders: [],
        };
      }

      const amount = response.order.pricePerPerson;
      employeeDebts[empId].totalEarned += amount;
      employeeDebts[empId].orders.push({
        id: response.order.id,
        title: response.order.title,
        workDate: response.order.workDate,
        amount,
      });
    }

    // Calculate paid amounts
    for (const payment of payments) {
      const empId = payment.employeeId;
      if (employeeDebts[empId]) {
        employeeDebts[empId].totalPaid += payment.amount;
      }
    }

    // Calculate debts
    const debts = Object.values(employeeDebts).map((data) => ({
      ...data,
      debt: data.totalEarned - data.totalPaid,
    })).filter((d) => d.debt > 0);

    // Sort by debt amount descending
    debts.sort((a, b) => b.debt - a.debt);

    const totalDebt = debts.reduce((sum, d) => sum + d.debt, 0);

    return NextResponse.json({
      debts,
      summary: {
        totalDebt,
        employeesCount: debts.length,
      },
    });
  } catch (error) {
    console.error("Error calculating debts:", error);
    return NextResponse.json(
      { error: "Failed to calculate debts" },
      { status: 500 }
    );
  }
}