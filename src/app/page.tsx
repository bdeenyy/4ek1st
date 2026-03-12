"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ClipboardList,
  Users,
  DollarSign,
  TrendingUp,
  Eye,
  Plus,
  Search,
  Star,
  Bot,
  MessageSquare,
  TrendingDown,
  Loader2,
  CheckCircle,
  Ban,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Status configurations
const employeeStatusConfig: Record<string, { label: string; color: string }> = {
  AVAILABLE: { label: "Свободен", color: "bg-green-500" },
  WORKING: { label: "В работе", color: "bg-blue-500" },
  BANNED: { label: "Забанен", color: "bg-red-500" },
};

const contactStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  NEW: { label: "Новый", variant: "secondary" },
  APPROVED: { label: "Одобрен", variant: "default" },
  BANNED: { label: "Забанен", variant: "destructive" },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU");
}

// Dashboard Tab
function DashboardTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then(setData)
      .catch(() => toast({ title: "Ошибка загрузки", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6"><Skeleton className="h-20" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    { title: "Активных заказов", value: data?.stats.activeOrders || 0, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Сотрудников в работе", value: data?.stats.workingEmployees || 0, icon: Users, color: "text-green-600", bg: "bg-green-100" },
    { title: "Выручка", value: formatCurrency(data?.financials.totalIncome || 0), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-100" },
    { title: "Прибыль", value: formatCurrency(data?.financials.profit || 0), icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-100" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.title}</CardTitle>
              <div className={cn("p-2 rounded-lg", s.bg)}><s.icon className={cn("h-4 w-4", s.color)} /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Финансовые показатели</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-muted-foreground">Маржинальность</span>
                <span className="font-medium">{(data?.financials.margin || 0).toFixed(1)}%</span>
              </div>
              <Progress value={data?.financials.margin || 0} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Активность ботов</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.bots?.map((bot: any) => (
                <div key={bot.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", bot.isActive ? "bg-green-500" : "bg-gray-400")} />
                    <span className="text-sm">{bot.city}</span>
                  </div>
                  <span className="text-sm font-medium">{bot.subscriberCount.toLocaleString("ru-RU")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Employees Tab
function EmployeesTab() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/employees")
      .then((res) => res.json())
      .then(setEmployees)
      .catch(() => toast({ title: "Ошибка загрузки", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  const filtered = employees.filter((emp) => {
    const matchSearch = `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || emp.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Статус" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="AVAILABLE">Свободен</SelectItem>
            <SelectItem value="WORKING">В работе</SelectItem>
            <SelectItem value="BANNED">Забанен</SelectItem>
          </SelectContent>
        </Select>
        <Button><Plus className="mr-2 h-4 w-4" />Добавить</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Рейтинг</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Теги</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{emp.firstName[0]}{emp.lastName[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{emp.phone}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        {emp.rating.toFixed(1)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", employeeStatusConfig[emp.status]?.color)} />
                        {employeeStatusConfig[emp.status]?.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {emp.tags?.slice(0, 2).map((t: any) => (
                          <Badge key={t.id} variant="outline" style={{ borderColor: t.color }}>{t.name}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Bots Tab
function BotsTab() {
  const [bots, setBots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/bots")
      .then((res) => res.json())
      .then(setBots)
      .catch(() => toast({ title: "Ошибка загрузки", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Telegram-боты</h3>
        <Button><Plus className="mr-2 h-4 w-4" />Добавить бота</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          [1, 2, 3].map((i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>)
        ) : (
          bots.map((bot) => (
            <Card key={bot.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100"><Bot className="h-5 w-5 text-blue-600" /></div>
                    <div>
                      <CardTitle className="text-base">{bot.name}</CardTitle>
                      <CardDescription>{bot.city}</CardDescription>
                    </div>
                  </div>
                  <div className={cn("w-2 h-2 rounded-full", bot.isActive ? "bg-green-500" : "bg-gray-400")} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Подписчики</span><span className="font-medium">{bot.subscriberCount.toLocaleString("ru-RU")}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Заказы</span><span className="font-medium">{bot._count?.orders || 0}</span></div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// Contacts Tab
function ContactsTab() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/contacts")
      .then((res) => res.json())
      .then(setContacts)
      .catch(() => toast({ title: "Ошибка загрузки", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      setContacts(contacts.map((c) => (c.id === id ? { ...c, status } : c)));
      toast({ title: "Статус обновлен" });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const filtered = contacts.filter((c) => statusFilter === "all" || c.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Модерация контактов</h3>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Статус" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="NEW">Новые</SelectItem>
            <SelectItem value="APPROVED">Одобренные</SelectItem>
            <SelectItem value="BANNED">Забаненные</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Telegram</TableHead>
                  <TableHead>Бот</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{contact.firstName?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        <span>{contact.firstName} {contact.lastName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{contact.username && `@${contact.username}`}</TableCell>
                    <TableCell><Badge variant="outline">{contact.bot?.city}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={contactStatusConfig[contact.status]?.variant}>
                        {contactStatusConfig[contact.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {contact.status === "NEW" && (
                          <>
                            <Button variant="ghost" size="icon" className="text-green-600" onClick={() => updateStatus(contact.id, "APPROVED")}><CheckCircle className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => updateStatus(contact.id, "BANNED")}><Ban className="h-4 w-4" /></Button>
                          </>
                        )}
                        {contact.status === "APPROVED" && (
                          <Button variant="ghost" size="icon" className="text-red-600" onClick={() => updateStatus(contact.id, "BANNED")}><Ban className="h-4 w-4" /></Button>
                        )}
                        {contact.status === "BANNED" && (
                          <Button variant="ghost" size="icon" className="text-green-600" onClick={() => updateStatus(contact.id, "APPROVED")}><CheckCircle className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Finances Tab
function FinancesTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/finances")
      .then((res) => res.json())
      .then(setData)
      .catch(() => toast({ title: "Ошибка загрузки", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Выручка</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(data?.summary?.totalIncome || 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Расходы</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(data?.summary?.totalExpenses || 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Прибыль</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(data?.summary?.profit || 0)}</div>
            <p className="text-xs text-muted-foreground">Маржа: {(data?.summary?.margin || 0).toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>История операций</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Сумма</TableHead>
                <TableHead>Описание</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.records?.slice(0, 10).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={r.type === "INCOME" ? "default" : "destructive"}>
                      {r.type === "INCOME" ? "Доход" : "Расход"}
                    </Badge>
                  </TableCell>
                  <TableCell className={r.type === "INCOME" ? "text-green-600" : "text-red-600"}>
                    {r.type === "INCOME" ? "+" : "-"}{formatCurrency(r.amount)}
                  </TableCell>
                  <TableCell>{r.description || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Page
export default function Personal24Page() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Personal-24" />
      <main className="flex-1 p-4 md:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /><span className="hidden sm:inline">Дашборд</span></TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Сотрудники</span></TabsTrigger>
            <TabsTrigger value="bots" className="flex items-center gap-2"><Bot className="h-4 w-4" /><span className="hidden sm:inline">Боты</span></TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /><span className="hidden sm:inline">Модерация</span></TabsTrigger>
            <TabsTrigger value="finances" className="flex items-center gap-2"><DollarSign className="h-4 w-4" /><span className="hidden sm:inline">Финансы</span></TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab /></TabsContent>
          <TabsContent value="employees"><EmployeesTab /></TabsContent>
          <TabsContent value="bots"><BotsTab /></TabsContent>
          <TabsContent value="contacts"><ContactsTab /></TabsContent>
          <TabsContent value="finances"><FinancesTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
