import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitOrderUpdate } from "@/lib/socket-helper";

// POST /api/orders/[id]/responses/[responseId]/rate
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const { id, responseId } = await params;
    const body = await request.json();
    const { rating } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Invalid rating value" },
        { status: 400 }
      );
    }

    const responseInfo = await db.orderResponse.findUnique({
      where: { id: responseId, orderId: id },
      include: { employee: true }
    });

    if (!responseInfo) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    if (responseInfo.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Response must be completed to rate" },
        { status: 400 }
      );
    }

    if (responseInfo.rating) {
      return NextResponse.json(
        { error: "Worker is already rated for this order" },
        { status: 400 }
      );
    }

    // Assign rating in transaction to update employee's average rating if necessary
    const now = new Date();
    await db.$transaction(async (tx) => {
      // 1. Update order response
      await tx.orderResponse.update({
        where: { id: responseId },
        data: {
          rating,
          ratedAt: now,
        },
      });

      // 2. Recalculate employee average rating
      // Simplified: Just update employee rating directly, assuming we had a previous rating
      // For now, let's get all ratings to calculate average.
      const allResponses = await tx.orderResponse.findMany({
        where: { employeeId: responseInfo.employeeId, rating: { not: null } },
        select: { rating: true }
      });
      
      const totalRatings = allResponses.reduce((sum, r) => sum + (r.rating || 0), rating);
      const newAverage = parseFloat((totalRatings / (allResponses.length + 1)).toFixed(2));

      await tx.employee.update({
        where: { id: responseInfo.employeeId },
        data: { rating: newAverage },
      });
    });

    emitOrderUpdate(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rating response:", error);
    return NextResponse.json(
      { error: "Failed to rate response" },
      { status: 500 }
    );
  }
}
