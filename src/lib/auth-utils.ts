import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";

// Role hierarchy for permission checks
const roleHierarchy: Record<string, number> = {
  ADMIN: 100,
  MANAGER: 50,
};

// Check if user has required role
export function hasRole(userRole: string, requiredRole: string): boolean {
  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

// Get current session with type safety
export async function getCurrentSession() {
  const session = await getServerSession();
  return session as {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
  } | null;
}

// Require authentication for API route
export async function requireAuth(request: NextRequest) {
  const session = await getCurrentSession();
  
  if (!session?.user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      ),
    };
  }
  
  return {
    authorized: true,
    user: session.user,
    response: null,
  };
}

// Require specific role for API route
export async function requireRole(request: NextRequest, requiredRole: string) {
  const authResult = await requireAuth(request);
  
  if (!authResult.authorized || !authResult.user) {
    return authResult;
  }
  
  if (!hasRole(authResult.user.role, requiredRole)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Недостаточно прав" },
        { status: 403 }
      ),
    };
  }
  
  return {
    authorized: true,
    user: authResult.user,
    response: null,
  };
}

// Action types for logging
export type ActionType =
  | "CREATE_ORDER"
  | "UPDATE_ORDER"
  | "DELETE_ORDER"
  | "PUBLISH_ORDER"
  | "CREATE_EMPLOYEE"
  | "UPDATE_EMPLOYEE"
  | "DELETE_EMPLOYEE"
  | "CREATE_PAYMENT"
  | "UPDATE_PAYMENT"
  | "CREATE_FINANCE_RECORD"
  | "LOGIN"
  | "LOGOUT"
  | "API_ACCESS";

// Log user action
export async function logAction(
  userId: string,
  action: ActionType,
  details: Record<string, unknown>
) {
  try {
    // For now, just console log - can be extended to database logging
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${userId} | Action: ${action} | Details:`, details);
    
    // Could be extended to store in database:
    // await db.auditLog.create({
    //   data: {
    //     userId,
    //     action,
    //     details: JSON.stringify(details),
    //     ipAddress: details.ipAddress as string,
    //     userAgent: details.userAgent as string,
    //   },
    // });
  } catch (error) {
    console.error("Failed to log action:", error);
  }
}

// Get client info from request
export function getClientInfo(request: NextRequest) {
  return {
    ipAddress: request.headers.get("x-forwarded-for") || 
               request.headers.get("x-real-ip") || 
               "unknown",
    userAgent: request.headers.get("user-agent") || "unknown",
  };
}

// Check if user owns a bot (for manager-level access)
export async function checkBotOwnership(userId: string, botId: string): Promise<boolean> {
  const bot = await db.bot.findUnique({
    where: { id: botId },
    select: { ownerId: true },
  });
  
  return bot?.ownerId === userId;
}

// Check if user can access bot data
export async function canAccessBot(userId: string, userRole: string, botId: string): Promise<boolean> {
  // Admins can access all bots
  if (userRole === "ADMIN") {
    return true;
  }
  
  // Managers can only access their own bots
  return checkBotOwnership(userId, botId);
}