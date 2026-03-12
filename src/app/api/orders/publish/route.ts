import { NextRequest, NextResponse } from "next/server";
import { publishOrder } from "@/bot/broadcast";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;
    
    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }
    
    const result = await publishOrder(orderId);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        sentCount: result.sentCount,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } else {
      return NextResponse.json(
        { error: "Failed to publish order", details: result.errors },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error publishing order:", error);
    return NextResponse.json(
      { error: "Failed to publish order" },
      { status: 500 }
    );
  }
}