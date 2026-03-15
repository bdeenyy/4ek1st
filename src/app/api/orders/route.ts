import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const botId = searchParams.get("botId") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    
    // Build where clause for filtering
    const where: Record<string, unknown> = {};
    
    // Full-text search by title, description, client name, address
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { clientName: { contains: search, mode: "insensitive" } },
        { clientPhone: { contains: search } },
        { street: { contains: search, mode: "insensitive" } },
        { district: { contains: search, mode: "insensitive" } },
        { workType: { contains: search, mode: "insensitive" } },
      ];
    }
    
    // Filter by status
    if (status && status !== "all") {
      where.status = status;
    }
    
    // Filter by bot
    if (botId && botId !== "all") {
      where.botId = botId;
    }
    
    // Filter by date range
    if (dateFrom || dateTo) {
      where.workDate = {};
      if (dateFrom) {
        where.workDate = { ...where.workDate as object, gte: new Date(dateFrom) };
      }
      if (dateTo) {
        where.workDate = { ...where.workDate as object, lte: new Date(dateTo) };
      }
    }
    
    const orders = await db.order.findMany({
      where,
      include: {
        bot: true,
        responses: {
          include: {
            employee: {
              include: {
                tags: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      clientName,
      clientPhone,
      district,
      street,
      houseNumber,
      officeNumber,
      workDate,
      workTime,
      workType,
      requiredPeople,
      pricePerPerson,
      clientPrice,
      checklists,
      publishType,
      botId,
      creatorId,
      templateId,
    } = body;

    const order = await db.order.create({
      data: {
        title,
        description,
        clientName,
        clientPhone,
        district,
        street,
        houseNumber,
        officeNumber,
        workDate: new Date(workDate),
        workTime,
        workType,
        requiredPeople: parseInt(requiredPeople),
        pricePerPerson: parseFloat(pricePerPerson),
        clientPrice: clientPrice ? parseFloat(clientPrice) : 0,
        checklists: checklists ? JSON.stringify(checklists) : null,
        publishType: publishType || "IMMEDIATE",
        status: "DRAFT",
        paymentStatus: "NOT_PAID",
        botId,
        creatorId,
        templateId: templateId || null,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
