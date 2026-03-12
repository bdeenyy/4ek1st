"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, Phone, MessageCircle, Star, MapPin, Calendar, 
  Clock, Edit, UserPlus, History, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

const employeeStatusConfig: Record<string, { label: string; color: string }> = {
  AVAILABLE: { label: "Доступен", color: "bg-green-500" },
  WORKING: { label: "Работает", color: "bg-blue-500" },
  BANNED: { label: "Заблокирован", color: "bg-red-500" },
};

const orderStatusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Черновик", color: "bg-gray-500" },
  PUBLISHED: { label: "Опубликован", color: "bg-blue-500" },
  IN_PROGRESS: { label: "В работе", color: "bg-yellow-500" },
  COMPLETED: { label: "Завершен", color: "bg-green-500" },
  CANCELLED: { label: "Отменен", color: "bg-red-500" },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string | Date) {
  return new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string;
  phone2: string | null;
  telegramId: string | null;
  rating: number;
  status: string;
  avatar: string | null;
  notes: string | null;
  createdAt: Date;
  tags: Array<{ id: string; name: string; color: string; type: string }>;
  workHistory: Array<{
    id: string;
    orderId: string;
    orderTitle: string;
    workDate: Date;
    rating: number | null;
    notes: string | null;
  }>;
  orderResponses: Array<{
    id: string;
    status: string;
    respondedAt: Date;
    order: {
      id: string;
      title: string;
      workDate: Date;
      workTime: string;
      status: string;
      pricePerPerson: number;
    };
  }>;
  financialRecords: Array<{
    id: string;
    type: string;
    amount: number;
    description: string | null;
    createdAt: Date;
  }>;
}

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") fetchEmployee();
  }, [status, resolvedParams.id]);

  const fetchEmployee = async () => {
    try {
      const response = await fetch(`/api/employees/${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setEmployee(data);
      } else {
        toast({
          title: "Ошибка",
          description: "Сотрудник не найден",
          variant: "destructive",
        });
        router.push("/employees");
      }
    } catch (error) {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить данные сотрудника",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) return <div className="p-6">Загрузка...</div>;
  if (!employee) return null;

  const completedOrders = employee.workHistory.length;
  const totalEarnings = employee.financialRecords
    .filter(r => r.type === "EXPENSE")
    .reduce((sum, r) => sum + r.amount, 0);
  const avgRating = employee.rating || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/employees")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl">
              {employee.firstName[0]}{employee.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {employee.lastName} {employee.firstName} {employee.middleName || ""}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge className={employeeStatusConfig[employee.status]?.color}>
                {employeeStatusConfig[employee.status]?.label}
              </Badge>
              {avgRating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span>{avgRating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline">
          <Edit className="h-4 w-4 mr-2" />
          Редактировать
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{completedOrders}</p>
                <p className="text-sm text-muted-foreground">Выполнено заказов</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalEarnings)}</p>
                <p className="text-sm text-muted-foreground">Всего заработано</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</p>
                <p className="text-sm text-muted-foreground">Средний рейтинг</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{formatDate(employee.createdAt)}</p>
                <p className="text-sm text-muted-foreground">Дата регистрации</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="history">
            <TabsList>
              <TabsTrigger value="history">История работ</TabsTrigger>
              <TabsTrigger value="responses">Отклики</TabsTrigger>
              <TabsTrigger value="payments">Выплаты</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">История выполненных заказов</CardTitle>
                </CardHeader>
                <CardContent>
                  {employee.workHistory.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      История работ пуста
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Заказ</TableHead>
                          <TableHead>Дата</TableHead>
                          <TableHead>Рейтинг</TableHead>
                          <TableHead>Заметки</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employee.workHistory.map((work) => (
                          <TableRow 
                            key={work.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/orders/${work.orderId}`)}
                          >
                            <TableCell className="font-medium">{work.orderTitle}</TableCell>
                            <TableCell>{formatDate(work.workDate)}</TableCell>
                            <TableCell>
                              {work.rating ? (
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                  {work.rating.toFixed(1)}
                                </div>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {work.notes || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="responses">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Активные отклики</CardTitle>
                </CardHeader>
                <CardContent>
                  {employee.orderResponses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Нет активных откликов
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Заказ</TableHead>
                          <TableHead>Дата работы</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead>Оплата</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employee.orderResponses.map((response) => (
                          <TableRow 
                            key={response.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/orders/${response.order.id}`)}
                          >
                            <TableCell className="font-medium">{response.order.title}</TableCell>
                            <TableCell>
                              <div>{formatDate(response.order.workDate)}</div>
                              <div className="text-sm text-muted-foreground">{response.order.workTime}</div>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(
                                response.status === "PENDING" && "bg-yellow-500",
                                response.status === "ASSIGNED" && "bg-green-500",
                                response.status === "REJECTED" && "bg-red-500",
                                response.status === "COMPLETED" && "bg-blue-500"
                              )}>
                                {response.status === "PENDING" && "Ожидает"}
                                {response.status === "ASSIGNED" && "Назначен"}
                                {response.status === "REJECTED" && "Отклонен"}
                                {response.status === "COMPLETED" && "Завершен"}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(response.order.pricePerPerson)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">История выплат</CardTitle>
                </CardHeader>
                <CardContent>
                  {employee.financialRecords.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      История выплат пуста
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Дата</TableHead>
                          <TableHead>Описание</TableHead>
                          <TableHead className="text-right">Сумма</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employee.financialRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{formatDate(record.createdAt)}</TableCell>
                            <TableCell>{record.description || "Выплата"}</TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              +{formatCurrency(record.amount)}
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

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Контакты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${employee.phone}`} className="text-primary hover:underline">
                  {employee.phone}
                </a>
              </div>
              {employee.phone2 && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${employee.phone2}`} className="text-primary hover:underline">
                    {employee.phone2}
                  </a>
                </div>
              )}
              {employee.telegramId && (
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.telegramId}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Теги</CardTitle>
            </CardHeader>
            <CardContent>
              {employee.tags.length === 0 ? (
                <p className="text-muted-foreground text-sm">Теги не назначены</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {employee.tags.map((tag) => (
                    <Badge key={tag.id} style={{ backgroundColor: tag.color }}>
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {employee.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Заметки</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{employee.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}