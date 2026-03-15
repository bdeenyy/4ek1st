import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitOrderUpdate } from "@/lib/socket-helper";
import { closeOrderBroadcast } from "@/bot/broadcast";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const { id, responseId } = await params;
    const body = await request.json();
    
    const updateData: Record<string, unknown> = {};
    
    if (body.status) {
      updateData.status = body.status;
      
      // Если назначаем сотрудника, записываем дату назначения
      if (body.status === "ASSIGNED") {
        updateData.assignedAt = new Date();
      }
    }
    
    const response = await db.orderResponse.update({
      where: { 
        id: responseId,
        orderId: id 
      },
      data: updateData,
      include: {
        employee: true,
        order: {
          include: { bot: true }
        }
      },
    });

    // Импортируем сервис уведомлений
    const { 
      notifyEmployeeAssigned, 
      notifyEmployeeRejected,
      notifyManagerAboutResponse 
    } = await import("@/lib/notifications");

    // Если сотрудник назначен, отправляем уведомление
    if (body.status === "ASSIGNED") {
      try {
        await notifyEmployeeAssigned(id, response.employeeId);
      } catch (notifyError) {
        console.error("Failed to send assignment notification:", notifyError);
      }

      // Проверяем, заполнены ли все места — если да, закрываем рассылку
      const order = response.order;
      const assignedCount = await db.orderResponse.count({
        where: {
          orderId: id,
          status: { in: ['ASSIGNED', 'CHECKED_IN', 'COMPLETED'] }
        }
      });
      if (assignedCount >= order.requiredPeople) {
        closeOrderBroadcast(id, 'FILLED').catch(console.error);
      }
    }

    // Если отклик отклонён, отправляем уведомление
    if (body.status === "REJECTED") {
      try {
        await notifyEmployeeRejected(id, response.employeeId);
      } catch (notifyError) {
        console.error("Failed to send rejection notification:", notifyError);
      }
    }

    emitOrderUpdate(id);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating response:", error);
    return NextResponse.json(
      { error: "Failed to update response" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const { id, responseId } = await params;
    
    await db.orderResponse.delete({
      where: { 
        id: responseId,
        orderId: id 
      },
    });

    emitOrderUpdate(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting response:", error);
    return NextResponse.json(
      { error: "Failed to delete response" },
      { status: 500 }
    );
  }
}