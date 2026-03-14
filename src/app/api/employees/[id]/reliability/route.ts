/**
 * API для получения метрик надёжности сотрудника
 * GET /api/employees/[id]/reliability
 *
 * Возвращает:
 * - checkinRate:       % смен с чек-ином (CHECKED_IN / ASSIGNED)
 * - completionRate:    % завершённых смен (COMPLETED / (ASSIGNED+COMPLETED+CHECKED_IN))
 * - cancellationCount: количество отмен после назначения
 * - reliabilityScore:  итоговый балл 0-100
 */

import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { ResponseStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const responses = await prisma.orderResponse.findMany({
      where: { employeeId: id },
      select: { status: true },
    });

    const total = responses.length;
    const assigned = responses.filter(r => r.status === ResponseStatus.ASSIGNED).length;
    const checkedIn = responses.filter(r => r.status === ResponseStatus.CHECKED_IN).length;
    const completed = responses.filter(r => r.status === ResponseStatus.COMPLETED).length;
    const rejected = responses.filter(r => r.status === ResponseStatus.REJECTED).length;

    // Смены, на которые был назначен (или завершил)
    const totalAssigned = assigned + checkedIn + completed;

    // Процент чек-инов среди назначенных
    const checkinRate = totalAssigned > 0
      ? Math.round(((checkedIn + completed) / totalAssigned) * 100)
      : 0;

    // Процент завершённых смен
    const completionRate = totalAssigned > 0
      ? Math.round((completed / totalAssigned) * 100)
      : 0;

    // Итоговый балл (среднее чек-ина и завершения)
    const reliabilityScore = Math.round((checkinRate + completionRate) / 2);

    return NextResponse.json({
      total,
      assigned,
      checkedIn,
      completed,
      rejected,
      checkinRate,
      completionRate,
      reliabilityScore,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
