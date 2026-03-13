"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  MoreHorizontal,
  Clock,
  XCircle,
  Trash2,
  Edit,
  Send,
  LayoutDashboard,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
    { title: "Всего сотрудников", value: data?.stats.totalEmployees || 0, icon: Users, color: "text-green-600", bg: "bg-green-100" },
    { title: "Выручка", value: formatCurrency(data?.financials.totalIncome || 0), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-100" },
    { title: "Прибыль", value: formatCurrency(data?.financials.profit || 0), icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-100" },
  ];

  return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Последние отклики</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => (window.location.href = '/moderation')}>
              Все
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.recentResponses?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Нет новых откликов</p>
              ) : (
                data?.recentResponses?.map((resp: any) => (
                  <div key={resp.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{resp.employee.firstName[0]}{resp.employee.lastName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{resp.employee.firstName} {resp.employee.lastName}</span>
                        <span className="text-xs text-muted-foreground">{resp.order.title}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => (window.location.href = `/orders/${resp.order.id}`)}>
                      Просмотр
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Недавние заказы</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => (window.location.href = '/orders')}>
              Все
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.recentOrders?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Заказы не найдены</p>
              ) : (
                data?.recentOrders?.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{order.title}</span>
                      <div className="flex items-center gap-2 mt-1">
                         <Badge variant="outline" className="text-[10px] h-4 px-1">{order.bot.city}</Badge>
                         <span className="text-xs text-muted-foreground">
                           {order.responses.filter((r: any) => r.status === 'ASSIGNED').length}/{order.requiredPeople} чел.
                         </span>
                      </div>
                    </div>
                    <Badge className={cn("text-[10px] h-4 px-1", 
                      order.status === 'DRAFT' ? 'bg-gray-500' :
                      order.status === 'PUBLISHED' ? 'bg-blue-500' :
                      order.status === 'IN_PROGRESS' ? 'bg-yellow-500' :
                      order.status === 'COMPLETED' ? 'bg-green-500' : 'bg-red-500'
                    )}>
                      {order.status === 'DRAFT' ? 'Черновик' :
                       order.status === 'PUBLISHED' ? 'Опубликован' :
                       order.status === 'IN_PROGRESS' ? 'В работе' :
                       order.status === 'COMPLETED' ? 'Завершен' : 'Отменен'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
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

// Add Bot Dialog Component
function AddBotDialog({ onBotAdded }: { onBotAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    token: "",
    city: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    
    setLoading(true);
    try {
      // 1. Создаем бота в базе
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          ownerId: session.user.id,
        }),
      });

      if (!res.ok) throw new Error("Failed to create bot");
      const bot = await res.json();

      // 2. Регистрируем Webhook
      await fetch(`/api/telegram/webhook?bot_id=${bot.id}`);

      toast({ title: "Бот успешно добавлен", description: "Webhook зарегистрирован" });
      setOpen(false);
      setFormData({ name: "", token: "", city: "", description: "" });
      onBotAdded();
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось добавить бота", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Добавить бота</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Добавить нового бота</DialogTitle>
            <DialogDescription>
              Введите данные вашего бота из BotFather для интеграции в систему.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Название (для панели)</Label>
              <Input
                id="name"
                placeholder="Персонал-24: Сочи"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">Город</Label>
              <Input
                id="city"
                placeholder="Сочи"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="token">HTTP API Token (из BotFather)</Label>
              <Input
                id="token"
                type="password"
                placeholder="123456789:ABCDE..."
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Описание (опционально)</Label>
              <Textarea
                id="description"
                placeholder="Бот для найма в Сочи..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить и запустить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={async () => {
            try {
              const res = await fetch("/api/bots/sync");
              if (res.ok) {
                toast({ title: "Синхронизация завершена" });
                // Refresh bots list
                fetch("/api/bots").then(res => res.json()).then(setBots);
              }
            } catch (err) {
              toast({ title: "Ошибка синхронизации", variant: "destructive" });
            }
          }}>
            Синхронизировать данные
          </Button>
          <AddBotDialog onBotAdded={() => {
            setLoading(true);
            fetch("/api/bots")
              .then((res) => res.json())
              .then(setBots)
              .finally(() => setLoading(false));
          }} />
        </div>
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

// Orders Tab (simplified list for dashboard)
function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/orders")
      .then((res) => res.json())
      .then(setOrders)
      .catch(() => toast({ title: "Ошибка загрузки заказов", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setOrders(orders.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
        toast({ title: "Статус обновлен" });
      }
    } catch (error) {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const handlePublishOrder = async (orderId: string) => {
    try {
      const response = await fetch("/api/orders/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      if (response.ok) {
        const result = await response.json();
        setOrders(orders.map(order => order.id === orderId ? { ...order, status: "PUBLISHED" } : order));
        toast({ title: "Заказ опубликован", description: `Уведомления отправлены (${result.sentCount})` });
      }
    } catch (error) {
      toast({ title: "Ошибка публикации", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Заказ</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="font-medium">{order.title}</div>
                    <div className="text-xs text-muted-foreground">{order.bot?.city}</div>
                  </TableCell>
                  <TableCell className="text-sm">{order.clientName}</TableCell>
                  <TableCell className="text-sm">{formatDate(order.workDate)}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-xs font-normal", 
                      order.status === 'DRAFT' ? 'bg-gray-500' :
                      order.status === 'PUBLISHED' ? 'bg-blue-500' :
                      order.status === 'IN_PROGRESS' ? 'bg-yellow-500' :
                      order.status === 'COMPLETED' ? 'bg-green-500' : 'bg-red-500'
                    )}>
                      {order.status === 'DRAFT' ? 'Черновик' :
                       order.status === 'PUBLISHED' ? 'Опубликован' :
                       order.status === 'IN_PROGRESS' ? 'В работе' :
                       order.status === 'COMPLETED' ? 'Завершен' : 'Отменен'}
                    </Badge>
                  </TableCell>
                   <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Действия</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => router.push(`/orders/${order.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />Просмотр
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/orders/${order.id}`)}>
                          <Edit className="mr-2 h-4 w-4" />Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handlePublishOrder(order.id)} disabled={order.status === "PUBLISHED"}>
                          <Send className="mr-2 h-4 w-4" />Опубликовать
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(order.id, "IN_PROGRESS")} disabled={order.status === "IN_PROGRESS"}>
                          <Clock className="mr-2 h-4 w-4" />В работу
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(order.id, "COMPLETED")} disabled={order.status === "COMPLETED"}>
                          <CheckCircle className="mr-2 h-4 w-4" />Завершить
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={async () => {
                            if (window.confirm("Вы уверены, что хотите удалить этот заказ?")) {
                              try {
                                const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
                                if (res.ok) {
                                  setOrders(orders.filter(o => o.id !== order.id));
                                  toast({ title: "Заказ удален" });
                                } else {
                                  toast({ title: "Ошибка удаления", variant: "destructive" });
                                }
                              } catch (error) {
                                toast({ title: "Ошибка удаления", variant: "destructive" });
                              }
                            }
                          }} 
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// Main Page
export default function StaffyMainPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Staffy" />
      <main className="flex-1 p-4 md:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4" /><span className="hidden sm:inline">Дашборд</span></TabsTrigger>
            <TabsTrigger value="orders-tab" className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /><span className="hidden sm:inline">Заказы</span></TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="hidden sm:inline">Сотрудники</span></TabsTrigger>
            <TabsTrigger value="bots" className="flex items-center gap-2"><Bot className="h-4 w-4" /><span className="hidden sm:inline">Боты</span></TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /><span className="hidden sm:inline">Модерация</span></TabsTrigger>
            <TabsTrigger value="finances" className="flex items-center gap-2"><DollarSign className="h-4 w-4" /><span className="hidden sm:inline">Финансы</span></TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab /></TabsContent>
          <TabsContent value="orders-tab"><OrdersTab /></TabsContent>
          <TabsContent value="employees"><EmployeesTab /></TabsContent>
          <TabsContent value="bots"><BotsTab /></TabsContent>
          <TabsContent value="contacts"><ContactsTab /></TabsContent>
          <TabsContent value="finances"><FinancesTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
