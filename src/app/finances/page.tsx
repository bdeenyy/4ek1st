"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { 
  Download, TrendingUp, TrendingDown, DollarSign, CalendarIcon, 
  Plus, FileSpreadsheet, FileText, CreditCard, Users, AlertCircle
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";

const COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function FinancesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpenses: 0, profit: 0, margin: 0, recordCount: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [typeFilter, setTypeFilter] = useState("all");
  
  // Payments state
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsSummary, setPaymentsSummary] = useState({ totalPending: 0, totalPaid: 0, count: 0 });
  const [debts, setDebts] = useState<any[]>([]);
  const [debtsSummary, setDebtsSummary] = useState({ totalDebt: 0, employeesCount: 0 });
  
  // Dialogs
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({ type: "INCOME", amount: "", description: "" });
  const [newPayment, setNewPayment] = useState({ 
    employeeId: "", amount: "", periodStart: new Date(), periodEnd: new Date(), description: "" 
  });
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchFinances();
      fetchPayments();
      fetchDebts();
      fetchEmployees();
    }
  }, [status, period, typeFilter]);

  const fetchFinances = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ period });
      if (typeFilter !== "all") params.append("type", typeFilter);
      
      const response = await fetch(`/api/finances?${params}`);
      const data = await response.json();
      setRecords(data.records);
      setSummary(data.summary);
      setChartData(data.chartData);
    } catch (error) {
      toast({ title: "Ошибка загрузки", description: "Не удалось загрузить финансовые данные", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await fetch("/api/payments");
      const data = await response.json();
      setPayments(data.payments);
      setPaymentsSummary(data.summary);
    } catch (error) {
      console.error("Error fetching payments:", error);
    }
  };

  const fetchDebts = async () => {
    try {
      const response = await fetch("/api/payments/debts");
      const data = await response.json();
      setDebts(data.debts);
      setDebtsSummary(data.summary);
    } catch (error) {
      console.error("Error fetching debts:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/employees");
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    try {
      const params = new URLSearchParams({ format, period });
      const response = await fetch(`/api/finances/export?${params}`);
      
      if (format === "csv") {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `finances_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `finances_${new Date().toISOString().split("T")[0]}.xlsx`;
        a.click();
      }
      
      toast({ title: "Экспорт завершен", description: `Файл успешно скачан` });
    } catch (error) {
      toast({ title: "Ошибка экспорта", description: "Не удалось экспортировать данные", variant: "destructive" });
    }
  };

  const handleCreateRecord = async () => {
    try {
      const response = await fetch("/api/finances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRecord),
      });
      
      if (response.ok) {
        setIsRecordDialogOpen(false);
        setNewRecord({ type: "INCOME", amount: "", description: "" });
        fetchFinances();
        toast({ title: "Запись создана", description: "Финансовая запись успешно добавлена" });
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось создать запись", variant: "destructive" });
    }
  };

  const handleCreatePayment = async () => {
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPayment,
          periodStart: newPayment.periodStart.toISOString(),
          periodEnd: newPayment.periodEnd.toISOString(),
        }),
      });
      
      if (response.ok) {
        setIsPaymentDialogOpen(false);
        setNewPayment({ employeeId: "", amount: "", periodStart: new Date(), periodEnd: new Date(), description: "" });
        fetchPayments();
        fetchDebts();
        toast({ title: "Выплата создана", description: "Запись о выплате успешно создана" });
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось создать выплату", variant: "destructive" });
    }
  };

  const handleMarkPaymentPaid = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      
      if (response.ok) {
        fetchPayments();
        fetchDebts();
        toast({ title: "Выплата подтверждена", description: "Статус выплаты изменен на 'Выплачено'" });
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось обновить статус выплаты", variant: "destructive" });
    }
  };

  // Prepare pie chart data
  const pieData = [
    { name: "Доходы", value: summary.totalIncome },
    { name: "Расходы", value: summary.totalExpenses },
  ];

  if (status === "loading") return <div className="p-6">Загрузка...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Финансы</h1>
          <p className="text-muted-foreground">Управление доходами, расходами и выплатами</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport("csv")}>
            <FileText className="mr-2 h-4 w-4" />CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("xlsx")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общий доход</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalIncome)}</div>
            <p className="text-xs text-muted-foreground">{summary.recordCount} записей</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общий расход</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">Выплаты сотрудникам</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Прибыль</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", summary.profit >= 0 ? "text-blue-600" : "text-red-600")}>
              {formatCurrency(summary.profit)}
            </div>
            <p className="text-xs text-muted-foreground">Маржа: {summary.margin.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Задолженность</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(debtsSummary.totalDebt)}</div>
            <p className="text-xs text-muted-foreground">{debtsSummary.employeesCount} сотрудников</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="records">Записи</TabsTrigger>
          <TabsTrigger value="payments">Выплаты</TabsTrigger>
          <TabsTrigger value="debts">Задолженности</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Income/Expense Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Динамика доходов и расходов</CardTitle>
                <CardDescription>По дням за выбранный период</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(v) => formatDate(v)} />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="income" name="Доход" stroke="#22c55e" strokeWidth={2} />
                      <Line type="monotone" dataKey="expense" name="Расход" stroke="#ef4444" strokeWidth={2} />
                      <Line type="monotone" dataKey="profit" name="Прибыль" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Структура финансов</CardTitle>
                <CardDescription>Соотношение доходов и расходов</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Финансовые записи</CardTitle>
                <CardDescription>История всех доходов и расходов</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Период" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">День</SelectItem>
                    <SelectItem value="week">Неделя</SelectItem>
                    <SelectItem value="month">Месяц</SelectItem>
                    <SelectItem value="quarter">Квартал</SelectItem>
                    <SelectItem value="year">Год</SelectItem>
                    <SelectItem value="all">Все время</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Тип" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все типы</SelectItem>
                    <SelectItem value="INCOME">Доходы</SelectItem>
                    <SelectItem value="EXPENSE">Расходы</SelectItem>
                  </SelectContent>
                </Select>
                <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" />Добавить</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Новая финансовая запись</DialogTitle>
                      <DialogDescription>Добавьте запись о доходе или расходе</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>Тип записи</Label>
                        <Select value={newRecord.type} onValueChange={(v) => setNewRecord({...newRecord, type: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INCOME">Доход</SelectItem>
                            <SelectItem value="EXPENSE">Расход</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount">Сумма (₽)</Label>
                        <Input id="amount" type="number" placeholder="10000" value={newRecord.amount}
                          onChange={(e) => setNewRecord({...newRecord, amount: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Описание</Label>
                        <Textarea id="description" placeholder="Описание записи..." value={newRecord.description}
                          onChange={(e) => setNewRecord({...newRecord, description: e.target.value})} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsRecordDialogOpen(false)}>Отмена</Button>
                      <Button onClick={handleCreateRecord}>Создать</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-center">Загрузка...</div>
              ) : records.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Записи не найдены</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead>Описание</TableHead>
                      <TableHead>Заказ</TableHead>
                      <TableHead>Сотрудник</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{formatDate(record.createdAt)}</TableCell>
                        <TableCell>
                          <span className={cn("px-2 py-1 rounded text-xs font-medium",
                            record.type === "INCOME" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          )}>
                            {record.type === "INCOME" ? "Доход" : "Расход"}
                          </span>
                        </TableCell>
                        <TableCell className={cn("font-medium",
                          record.type === "INCOME" ? "text-green-600" : "text-red-600"
                        )}>
                          {record.type === "INCOME" ? "+" : "-"}{formatCurrency(record.amount)}
                        </TableCell>
                        <TableCell>{record.description || "-"}</TableCell>
                        <TableCell>{record.order?.title || "-"}</TableCell>
                        <TableCell>
                          {record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Выплаты сотрудникам</CardTitle>
                <CardDescription>Управление выплатами и их статусами</CardDescription>
              </div>
              <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />Новая выплата</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Создание выплаты</DialogTitle>
                    <DialogDescription>Создайте запись о выплате сотруднику</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Сотрудник</Label>
                      <Select value={newPayment.employeeId} onValueChange={(v) => setNewPayment({...newPayment, employeeId: v})}>
                        <SelectTrigger><SelectValue placeholder="Выберите сотрудника" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.firstName} {emp.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentAmount">Сумма (₽)</Label>
                      <Input id="paymentAmount" type="number" placeholder="5000" value={newPayment.amount}
                        onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Начало периода</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(newPayment.periodStart, "PPP", { locale: ru })}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={newPayment.periodStart}
                              onSelect={(d) => d && setNewPayment({...newPayment, periodStart: d})} />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Конец периода</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(newPayment.periodEnd, "PPP", { locale: ru })}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={newPayment.periodEnd}
                              onSelect={(d) => d && setNewPayment({...newPayment, periodEnd: d})} />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentDesc">Описание</Label>
                      <Textarea id="paymentDesc" placeholder="Примечание к выплате..." value={newPayment.description}
                        onChange={(e) => setNewPayment({...newPayment, description: e.target.value})} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Отмена</Button>
                    <Button onClick={handleCreatePayment}>Создать</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Выплаты не найдены</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Сотрудник</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead>Период</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Дата выплаты</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div className="font-medium">
                            {payment.employee?.firstName} {payment.employee?.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">{payment.employee?.phone}</div>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(payment.periodStart), "dd.MM.yyyy")} - {format(new Date(payment.periodEnd), "dd.MM.yyyy")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn("px-2 py-1 rounded text-xs font-medium",
                            payment.status === "PAID" ? "bg-green-100 text-green-800" :
                            payment.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                            "bg-gray-100 text-gray-800"
                          )}>
                            {payment.status === "PAID" ? "Выплачено" : payment.status === "PENDING" ? "Ожидает" : "Отменено"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {payment.paidAt ? format(new Date(payment.paidAt), "dd.MM.yyyy HH:mm") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.status === "PENDING" && (
                            <Button size="sm" variant="outline" onClick={() => handleMarkPaymentPaid(payment.id)}>
                              <CreditCard className="mr-2 h-4 w-4" />Подтвердить
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Задолженности по выплатам</CardTitle>
              <CardDescription>Сотрудники с невыплаченными суммами за выполненные работы</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {debts.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Задолженностей нет</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Сотрудник</TableHead>
                      <TableHead>Заработано</TableHead>
                      <TableHead>Выплачено</TableHead>
                      <TableHead>Задолженность</TableHead>
                      <TableHead>Заказов</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debts.map((debt) => (
                      <TableRow key={debt.employee.id}>
                        <TableCell>
                          <div className="font-medium">
                            {debt.employee.firstName} {debt.employee.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">{debt.employee.phone}</div>
                        </TableCell>
                        <TableCell>{formatCurrency(debt.totalEarned)}</TableCell>
                        <TableCell>{formatCurrency(debt.totalPaid)}</TableCell>
                        <TableCell className="font-medium text-orange-600">{formatCurrency(debt.debt)}</TableCell>
                        <TableCell>{debt.orders.length}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => {
                            setNewPayment({
                              employeeId: debt.employee.id,
                              amount: debt.debt.toString(),
                              periodStart: new Date(),
                              periodEnd: new Date(),
                              description: `Выплата за ${debt.orders.length} заказов`
                            });
                            setIsPaymentDialogOpen(true);
                          }}>
                            <Plus className="mr-2 h-4 w-4" />Оформить выплату
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}