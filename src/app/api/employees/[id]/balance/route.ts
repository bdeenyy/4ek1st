/**
 * API для управления балансом сотрудника (бонусы / штрафы)
 * POST /api/employees/[id]/balance — начисление или списание
 * GET  /api/employees/[id]/balance — история операций
 */

import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { BalanceOperationType } from '@prisma/client';


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const history = await prisma.balanceHistory.findMany({
      where: { employeeId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { balance: true },
    });

    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    return NextResponse.json({ balance: employee.balance, history });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { amount, type, description } = body as {
      amount: number;
      type: BalanceOperationType;
      description?: string;
    };

    if (!amount || !type) {
      return NextResponse.json({ error: 'amount and type are required' }, { status: 400 });
    }

    if (!Object.values(BalanceOperationType).includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // Штраф должен быть отрицательным, бонус — положительным
    const delta = type === BalanceOperationType.PENALTY ? -Math.abs(amount) : Math.abs(amount);

    const [employee] = await prisma.$transaction([
      prisma.employee.update({
        where: { id },
        data: { balance: { increment: delta } },
      }),
      prisma.balanceHistory.create({
        data: {
          employeeId: id,
          amount: delta,
          type,
          description: description ?? null,
        },
      }),
    ]);

    return NextResponse.json({ balance: employee.balance });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
