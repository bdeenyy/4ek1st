import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const period = searchParams.get("period") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build date filter
    let dateFilter: Record<string, Date> = {};
    const now = new Date();
    
    if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (period !== "all") {
      switch (period) {
        case "day":
          dateFilter = {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lte: now,
          };
          break;
        case "week":
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          dateFilter = {
            gte: weekStart,
            lte: now,
          };
          break;
        case "month":
          dateFilter = {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lte: now,
          };
          break;
        case "quarter":
          const quarter = Math.floor(now.getMonth() / 3);
          dateFilter = {
            gte: new Date(now.getFullYear(), quarter * 3, 1),
            lte: now,
          };
          break;
        case "year":
          dateFilter = {
            gte: new Date(now.getFullYear(), 0, 1),
            lte: now,
          };
          break;
      }
    }

    // Build where clause
    const where: Record<string, unknown> = {};
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }

    const records = await db.financialRecord.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            title: true,
            clientName: true,
          },
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Prepare data for export
    const exportData = records.map((record) => ({
      "ID": record.id,
      "Дата": new Date(record.createdAt).toLocaleDateString("ru-RU"),
      "Тип": record.type === "INCOME" ? "Доход" : "Расход",
      "Сумма": record.amount,
      "Описание": record.description || "",
      "Заказ": record.order ? record.order.title : "",
      "Сотрудник": record.employee 
        ? `${record.employee.firstName} ${record.employee.lastName}` 
        : "",
    }));

    if (format === "csv") {
      const headers = ["ID", "Дата", "Тип", "Сумма", "Описание", "Заказ", "Сотрудник"];
      
      const rows = records.map((record) => [
        record.id,
        new Date(record.createdAt).toLocaleDateString("ru-RU"),
        record.type === "INCOME" ? "Доход" : "Расход",
        record.amount.toString(),
        record.description || "",
        record.order ? record.order.title : "",
        record.employee 
          ? `${record.employee.firstName} ${record.employee.lastName}` 
          : "",
      ]);

      const csv = [
        headers.join(";"),
        ...rows.map((row) => row.map(cell => `"${cell}"`).join(";")),
      ].join("\n");

      // Add BOM for Excel
      const bom = "\uFEFF";
      const csvContent = bom + csv;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="finances_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    if (format === "xlsx") {
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      worksheet["!cols"] = [
        { wch: 25 }, // ID
        { wch: 12 }, // Дата
        { wch: 10 }, // Тип
        { wch: 12 }, // Сумма
        { wch: 30 }, // Описание
        { wch: 25 }, // Заказ
        { wch: 25 }, // Сотрудник
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, "Финансы");

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="finances_${new Date().toISOString().split("T")[0]}.xlsx"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      records,
      exportedAt: new Date().toISOString(),
      totalRecords: records.length,
    });
  } catch (error) {
    console.error("Error exporting finances:", error);
    return NextResponse.json(
      { error: "Failed to export finances" },
      { status: 500 }
    );
  }
}