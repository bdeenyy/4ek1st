import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const contacts = await db.contact.findMany({
      include: {
        bot: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
      orderBy: {
        registeredAt: "desc",
      },
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, notes } = body;

    const contact = await db.contact.update({
      where: { id },
      data: {
        status,
        notes,
        approvedAt: status === "APPROVED" ? new Date() : undefined,
      },
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}
