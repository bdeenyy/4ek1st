import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const tagId = searchParams.get("tagId") || "";
    
    // Build where clause for filtering
    const where: Record<string, unknown> = {};
    
    // Search by name or phone
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { middleName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { phone2: { contains: search } },
        { telegramId: { contains: search } },
      ];
    }
    
    // Filter by status
    if (status && status !== "all") {
      where.status = status;
    }
    
    // Filter by tag
    if (tagId) {
      where.tags = {
        some: { id: tagId }
      };
    }
    
    const employees = await db.employee.findMany({
      where,
      include: {
        tags: true,
        workHistory: {
          take: 10,
          orderBy: { workDate: "desc" },
        },
        _count: {
          select: { workHistory: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      middleName,
      phone,
      phone2,
      telegramId,
      tags,
      notes,
    } = body;

    const employee = await db.employee.create({
      data: {
        firstName,
        lastName,
        middleName,
        phone,
        phone2,
        telegramId,
        notes,
        tags: tags
          ? {
              connect: tags.map((id: string) => ({ id })),
            }
          : undefined,
      },
      include: {
        tags: true,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("Error creating employee:", error);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 }
    );
  }
}
