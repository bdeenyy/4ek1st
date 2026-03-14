import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        tags: true,
        workHistory: {
          orderBy: { workDate: "desc" },
          take: 50,
        },
        orderResponses: {
          include: {
            order: {
              select: {
                id: true,
                title: true,
                workDate: true,
                workTime: true,
                status: true,
                pricePerPerson: true,
              },
            },
          },
          orderBy: { respondedAt: "desc" },
          take: 20,
        },
        financialRecords: {
          where: { type: "EXPENSE" },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee" },
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
    
    if (body.firstName) updateData.firstName = body.firstName;
    if (body.lastName) updateData.lastName = body.lastName;
    if (body.middleName !== undefined) updateData.middleName = body.middleName;
    if (body.phone) updateData.phone = body.phone;
    if (body.phone2 !== undefined) updateData.phone2 = body.phone2;
    if (body.telegramId !== undefined) updateData.telegramId = body.telegramId;
    if (body.status) updateData.status = body.status;
    if (body.rating !== undefined) updateData.rating = body.rating;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Обновляем теги если переданы
    if (body.tagIds) {
      const employee = await db.employee.update({
        where: { id },
        data: {
          ...updateData,
          tags: {
            set: body.tagIds.map((tagId: string) => ({ id: tagId })),
          },
        },
        include: { tags: true },
      });
      return NextResponse.json(employee);
    }

    const employee = await db.employee.update({
      where: { id },
      data: updateData,
      include: { tags: true },
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.error("Error updating employee:", error);
    return NextResponse.json(
      { error: "Failed to update employee" },
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
    
    // Удаляем связи с тегами (таблица создана с кавычками — "_EmployeeTags", PG case-sensitive)
    await db.$executeRaw`DELETE FROM "_EmployeeTags" WHERE "A" = ${id}`;

    // Удаляем историю баланса
    await db.balanceHistory.deleteMany({
      where: { employeeId: id },
    });

    // Удаляем отклики
    await db.orderResponse.deleteMany({
      where: { employeeId: id },
    });

    // Удаляем финансовые записи
    await db.financialRecord.deleteMany({
      where: { employeeId: id },
    });

    // Удаляем историю работ
    await db.workHistory.deleteMany({
      where: { employeeId: id },
    });
    
    // Удаляем сотрудника
    await db.employee.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 }
    );
  }
}