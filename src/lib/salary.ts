import { db } from "@/lib/db";

/**
 * Начисляет зарплату сотруднику за выполненный заказ:
 * - создаёт FinancialRecord (EXPENSE)
 * - инкрементирует Employee.balance
 *
 * Вызывается как из Telegram-бота (handleWorkConfirm),
 * так и при ручном завершении через дашборд (PATCH /api/orders/.../responses/...).
 */
export async function accrueEmployeeSalary(
  employeeId: string,
  orderId: string,
  orderTitle: string,
  salary: number
): Promise<void> {
  if (salary <= 0) return;

  await db.financialRecord.create({
    data: {
      type: "EXPENSE",
      amount: salary,
      description: `Оплата за заказ: ${orderTitle}`,
      employeeId,
      orderId,
    },
  });

  await db.employee.update({
    where: { id: employeeId },
    data: { balance: { increment: salary } },
  });
}
