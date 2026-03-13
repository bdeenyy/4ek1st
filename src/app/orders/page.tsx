"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MoreHorizontal, Eye, Edit, CalendarIcon, CheckCircle, XCircle, Clock, Phone, Send, Trash2 } from "lucide-react";

const orderStatusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Черновик", color: "bg-gray-500" },
  PUBLISHED: { label: "Опубликован", color: "bg-blue-500" },
  IN_PROGRESS: { label: "В работе", color: "bg-yellow-500" },
  COMPLETED: { label: "Завершен", color: "bg-green-500" },
  CANCELLED: { label: "Отменен", color: "bg-red-500" },
};

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  NOT_PAID: { label: "Не оплачено", color: "bg-red-500" },
  PARTIAL: { label: "Частично", color: "bg-yellow-500" },
  PAID: { label: "Оплачено", color: "bg-green-500" },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [bots, setBots] = useState<any[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({
    title: "", description: "", clientName: "", clientPhone: "", district: "", street: "",
    houseNumber: "", officeNumber: "", workDate: new Date(), workTime: "09:00", workType: "",
    requiredPeople: 1, pricePerPerson: 0, botId: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") { fetchOrders(); fetchBots(); }
  }, [status]);

  const fetchOrders = async () => {
    try {
      const response = await fetch("/api/orders");
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      toast({ title: "Ошибка загрузки", description: "Не удалось загрузить заказы", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const fetchBots = async () => {
    try {
      const response = await fetch("/api/bots");
      const data = await response.json();
      setBots(data);
    } catch (error) { console.error("Error fetching bots:", error); }
  };

  const handleCreateOrder = async () => {
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newOrder, creatorId: session?.user?.id }),
      });
      if (response.ok) {
        const createdOrder = await response.json();
        setOrders([createdOrder, ...orders]);
        setIsCreateDialogOpen(false);
        setNewOrder({ title: "", description: "", clientName: "", clientPhone: "", district: "", street: "",
          houseNumber: "", officeNumber: "", workDate: new Date(), workTime: "09:00", workType: "",
          requiredPeople: 1, pricePerPerson: 0, botId: "" });
        toast({ title: "Заказ создан", description: "Новый заказ успешно создан" });
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось создать заказ", variant: "destructive" });
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setOrders(orders.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
        toast({ title: "Статус обновлен", description: `Статус заказа изменен на ${orderStatusConfig[newStatus]?.label}` });
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось обновить статус", variant: "destructive" });
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
        toast({ 
          title: "Заказ опубликован", 
          description: `Бот разослал уведомления (${result.sentCount} чел.)` 
        });
      }
    } catch (error) {
      toast({ title: "Ошибка публикации", variant: "destructive" });
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchSearch = order.title.toLowerCase().includes(search.toLowerCase()) ||
      order.clientName.toLowerCase().includes(search.toLowerCase()) || order.clientPhone.includes(search);
    const matchStatus = statusFilter === "all" || order.status === statusFilter;
    const matchCity = cityFilter === "all" || order.bot?.city === cityFilter;
    return matchSearch && matchStatus && matchCity;
  });

  if (status === "loading") return <div className="p-6">Загрузка...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Заказы</h1>
          <p className="text-muted-foreground">Управление заказами и назначение сотрудников</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Новый заказ</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Создание нового заказа</DialogTitle>
              <DialogDescription>Заполните информацию о заказе для публикации в Telegram-бот</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Название заказа *</Label>
                  <Input id="title" placeholder="Погрузка мебели" value={newOrder.title}
                    onChange={(e) => setNewOrder({...newOrder, title: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workType">Тип работ *</Label>
                  <Input id="workType" placeholder="Погрузочные работы" value={newOrder.workType}
                    onChange={(e) => setNewOrder({...newOrder, workType: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea id="description" placeholder="Детальное описание работ..." value={newOrder.description}
                  onChange={(e) => setNewOrder({...newOrder, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Имя клиента *</Label>
                  <Input id="clientName" placeholder="Иванов Иван Иванович" value={newOrder.clientName}
                    onChange={(e) => setNewOrder({...newOrder, clientName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Телефон клиента *</Label>
                  <Input id="clientPhone" placeholder="+7 (999) 123-45-67" value={newOrder.clientPhone}
                    onChange={(e) => setNewOrder({...newOrder, clientPhone: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="district">Район</Label>
                  <Input id="district" placeholder="Центральный" value={newOrder.district}
                    onChange={(e) => setNewOrder({...newOrder, district: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="street">Улица *</Label>
                  <Input id="street" placeholder="ул. Ленина" value={newOrder.street}
                    onChange={(e) => setNewOrder({...newOrder, street: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="houseNumber">Дом *</Label>
                  <Input id="houseNumber" placeholder="45" value={newOrder.houseNumber}
                    onChange={(e) => setNewOrder({...newOrder, houseNumber: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Дата работы *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newOrder.workDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newOrder.workDate ? format(newOrder.workDate, "PPP", { locale: ru }) : <span>Выберите дату</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={newOrder.workDate} onSelect={(date) => date && setNewOrder({...newOrder, workDate: date})} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workTime">Время *</Label>
                  <Input id="workTime" type="time" value={newOrder.workTime}
                    onChange={(e) => setNewOrder({...newOrder, workTime: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="botId">Telegram-бот *</Label>
                  <Select value={newOrder.botId} onValueChange={(value) => setNewOrder({...newOrder, botId: value})}>
                    <SelectTrigger><SelectValue placeholder="Выберите бота" /></SelectTrigger>
                    <SelectContent>
                      {bots.map((bot) => (<SelectItem key={bot.id} value={bot.id}>{bot.city} - {bot.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requiredPeople">Количество человек *</Label>
                  <Input id="requiredPeople" type="number" min="1" value={newOrder.requiredPeople}
                    onChange={(e) => setNewOrder({...newOrder, requiredPeople: parseInt(e.target.value) || 1})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricePerPerson">Цена за человека (₽) *</Label>
                  <Input id="pricePerPerson" type="number" min="0" value={newOrder.pricePerPerson}
                    onChange={(e) => setNewOrder({...newOrder, pricePerPerson: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Отмена</Button>
              <Button onClick={handleCreateOrder}>Создать заказ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Поиск по названию, клиенту или телефону..." className="pl-8" value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Статус заказа" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="DRAFT">Черновик</SelectItem>
                  <SelectItem value="PUBLISHED">Опубликован</SelectItem>
                  <SelectItem value="IN_PROGRESS">В работе</SelectItem>
                  <SelectItem value="COMPLETED">Завершен</SelectItem>
                  <SelectItem value="CANCELLED">Отменен</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Город" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все города</SelectItem>
                  {Array.from(new Set(orders.map(o => o.bot?.city).filter(Boolean))).map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center">Загрузка заказов...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Заказы не найдены</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Заказ</TableHead>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Дата/Время</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Оплата</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="font-medium">{order.title}</div>
                      <div className="text-sm text-muted-foreground">{order.bot?.city}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.clientName}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />{order.clientPhone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{order.street}, {order.houseNumber}{order.officeNumber && `, оф. ${order.officeNumber}`}</div>
                      {order.district && <div className="text-xs text-muted-foreground">{order.district}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(order.workDate)}</div>
                      <div className="text-xs text-muted-foreground">{order.workTime}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", orderStatusConfig[order.status]?.color)} />
                        <span>{orderStatusConfig[order.status]?.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", paymentStatusConfig[order.paymentStatus]?.color)} />
                        <span>{paymentStatusConfig[order.paymentStatus]?.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{formatCurrency(order.pricePerPerson * order.requiredPeople)}</div>
                      <div className="text-xs text-muted-foreground">{order.requiredPeople} × {formatCurrency(order.pricePerPerson)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
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
                              if (window.confirm("Вы уверены, что хотите удалить этот заказ? Это также отправит уведомление об отмене всем откликнувшимся.")) {
                                try {
                                  const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
                                  if (res.ok) {
                                    setOrders(orders.filter(o => o.id !== order.id));
                                    toast({ title: "Заказ удален" });
                                  }
                                } catch (error) {
                                  toast({ title: "Ошибка удаления", variant: "destructive" });
                                }
                              }
                            }} 
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />Удалить полностью
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(order.id, "CANCELLED")} disabled={order.status === "CANCELLED"} className="text-destructive">
                            <XCircle className="mr-2 h-4 w-4" />Отменить (архив)
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
    </div>
  );
}
