import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitOrderUpdate } from "@/lib/socket-helper";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const order = await db.order.findUnique({
      where: { id },
      include: {
        bot: { select: { id: true, name: true, city: true } },
        creator: { select: { id: true, name: true, email: true } },
        responses: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                rating: true,
                telegramId: true,
              },
            },
          },
          orderBy: { respondedAt: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const updateData: Record<string, unknown> = {};
    
    if (body.status) updateData.status = body.status;
    if (body.paymentStatus) updateData.paymentStatus = body.paymentStatus;
    if (body.title) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.clientName) updateData.clientName = body.clientName;
    if (body.clientPhone) updateData.clientPhone = body.clientPhone;
    if (body.district !== undefined) updateData.district = body.district;
    if (body.street) updateData.street = body.street;
    if (body.houseNumber) updateData.houseNumber = body.houseNumber;
    if (body.officeNumber !== undefined) updateData.officeNumber = body.officeNumber;
    if (body.workDate) updateData.workDate = new Date(body.workDate);
    if (body.workTime) updateData.workTime = body.workTime;
    if (body.workType) updateData.workType = body.workType;
    if (body.requiredPeople) updateData.requiredPeople = body.requiredPeople;
    if (body.pricePerPerson) updateData.pricePerPerson = body.pricePerPerson;
    if (body.checklists !== undefined) updateData.checklists = body.checklists;

    const order = await db.order.update({
      where: { id },
      data: updateData,
    });
    
    emitOrderUpdate(id);

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Уведомляем всех откликнувшихся об отмене
    const { notifyOrderCancelled } = await import("@/lib/notifications");
    await notifyOrderCancelled(id, "Заказ удален");

    // Удаляем связанные отклики
    await db.orderResponse.deleteMany({
      where: { orderId: id },
    });
    
    // Удаляем финансовые записи
    await db.financialRecord.deleteMany({
      where: { orderId: id },
    });
    
    // Удаляем заказ
    await db.order.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    );
  }
}