import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/payments/[id] - Get payment by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            telegramId: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Get related orders if orderIds exists
    let orders: { id: string; title: string; workDate: Date; pricePerPerson: number }[] = [];
    if (payment.orderIds) {
      const orderIds = JSON.parse(payment.orderIds) as string[];
      orders = await db.order.findMany({
        where: {
          id: { in: orderIds },
        },
        select: {
          id: true,
          title: true,
          workDate: true,
          pricePerPerson: true,
        },
      });
    }

    return NextResponse.json({ ...payment, orders });
  } catch (error) {
    console.error("Error fetching payment:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment" },
      { status: 500 }
    );
  }
}

// PUT /api/payments/[id] - Update payment (mark as paid, cancel, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, paidAt } = body;

    const updateData: Record<string, unknown> = {};
    
    if (status && ["PENDING", "PAID", "CANCELLED"].includes(status)) {
      updateData.status = status;
    }
    
    if (status === "PAID") {
      updateData.paidAt = paidAt ? new Date(paidAt) : new Date();
    }

    const payment = await db.payment.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Error updating payment:", error);
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 }
    );
  }
}

// DELETE /api/payments/[id] - Delete payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await db.payment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting payment:", error);
    return NextResponse.json(
      { error: "Failed to delete payment" },
      { status: 500 }
    );
  }
}