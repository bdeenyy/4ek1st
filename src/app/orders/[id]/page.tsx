"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import io from "socket.io-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ArrowLeft, MapPin, Calendar, Clock, Users, Phone, Mail, 
  CheckCircle, XCircle, UserPlus, UserX, Send, Edit, Trash2,
  Star, Image as ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const orderStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: "Черновик", color: "text-gray-700", bgColor: "bg-gray-100" },
  PUBLISHED: { label: "Опубликован", color: "text-blue-700", bgColor: "bg-blue-100" },
  IN_PROGRESS: { label: "В работе", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  COMPLETED: { label: "Завершен", color: "text-green-700", bgColor: "bg-green-100" },
  CANCELLED: { label: "Отменен", color: "text-red-700", bgColor: "bg-red-100" },
};

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  NOT_PAID: { label: "Не оплачено", color: "bg-red-500" },
  PARTIAL: { label: "Частично", color: "bg-yellow-500" },
  PAID: { label: "Оплачено", color: "bg-green-500" },
};

const responseStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Ожидает", color: "bg-yellow-500" },
  ASSIGNED: { label: "Назначен", color: "bg-green-500" },
  CHECKED_IN: { label: "На месте", color: "bg-purple-500" },
  REJECTED: { label: "Отклонен", color: "bg-red-500" },
  COMPLETED: { label: "Завершил", color: "bg-blue-500" },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string | Date) {
  return new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

interface Order {
  id: string;
  title: string;
  description: string | null;
  clientName: string;
  clientPhone: string;
  district: string | null;
  street: string;
  houseNumber: string;
  officeNumber: string | null;
  workDate: Date;
  workTime: string;
  workType: string;
  requiredPeople: number;
  pricePerPerson: number;
  checklists: string | null;
  status: string;
  paymentStatus: string;
  publishType: string;
  publishAt: Date | null;
  createdAt: Date;
  bot: { id: string; name: string; city: string };
  creator: { id: string; name: string; email: string };
  responses: Array<{
    id: string;
    status: string;
    respondedAt: Date;
    assignedAt: Date | null;
    checkedInAt: Date | null;
    completedAt: Date | null;
    reportText: string | null;
    reportPhotoId: string | null;
    rating: number | null;
    ratedAt: Date | null;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      rating: number;
      telegramId: string | null;
    };
  }>;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [checklists, setChecklists] = useState<string[]>([]);
  const [checkedItems, setCheckedItems] = useState<boolean[]>([]);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  const [ratingResponseId, setRatingResponseId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(5);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") fetchOrder();
  }, [status, resolvedParams.id]);

  useEffect(() => {
    if (!resolvedParams.id || status !== "authenticated") return;
    
    const socket = io();
    
    socket.on("connect", () => {
      socket.emit("joinOrder", resolvedParams.id);
    });
    
    socket.on("orderUpdated", (data: { orderId: string }) => {
      if (data.orderId === resolvedParams.id) {
        fetchOrder();
        toast({
          title: "Заказ обновлен",
          description: "Получены новые данные (статусы, отклики и т.д.)",
        });
      }
    });

    return () => {
      socket.emit("leaveOrder", resolvedParams.id);
      socket.off("orderUpdated");
      socket.disconnect();
    };
  }, [resolvedParams.id, status, toast]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${resolvedParams.id}`);
      if (response.ok) {
        const data = await response.json();
        setOrder(data);
        
        // Parse checklists
        if (data.checklists) {
          const parsed = JSON.parse(data.checklists);
          setChecklists(parsed);
          setCheckedItems(new Array(parsed.length).fill(false));
        }
      } else {
        toast({
          title: "Ошибка",
          description: "Заказ не найден",
          variant: "destructive",
        });
        router.push("/orders");
      }
    } catch (error) {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить заказ",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/orders/${resolvedParams.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setOrder(order ? { ...order, status: newStatus } : null);
        toast({
          title: "Статус обновлен",
          description: `Статус заказа изменен на ${orderStatusConfig[newStatus]?.label}`,
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус",
        variant: "destructive",
      });
    }
  };

  const handlePublish = async () => {
    try {
      const response = await fetch("/api/orders/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: resolvedParams.id }),
      });

      if (response.ok) {
        const result = await response.json();
        setOrder(order ? { ...order, status: "PUBLISHED" } : null);
        toast({
          title: "Заказ опубликован",
          description: `Отправлено ${result.sentCount} уведомлений`,
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка публикации",
        description: "Не удалось опубликовать заказ",
        variant: "destructive",
      });
    } finally {
      setIsPublishDialogOpen(false);
    }
  };

  const handleAssignEmployee = async (responseId: string) => {
    try {
      const response = await fetch(`/api/orders/${resolvedParams.id}/responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ASSIGNED" }),
      });

      if (response.ok) {
        fetchOrder();
        toast({
          title: "Сотрудник назначен",
          description: "Сотрудник успешно назначен на заказ",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось назначить сотрудника",
        variant: "destructive",
      });
    }
  };

  const handleRejectEmployee = async (responseId: string) => {
    try {
      const response = await fetch(`/api/orders/${resolvedParams.id}/responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });

      if (response.ok) {
        fetchOrder();
        toast({
          title: "Отклик отклонен",
          description: "Отклик сотрудника отклонен",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отклонить отклик",
        variant: "destructive",
      });
    }
  };

  const handleOpenRatingDialog = (responseId: string) => {
    setRatingResponseId(responseId);
    setRatingValue(5);
    setIsRatingDialogOpen(true);
  };

  const handleRateEmployee = async () => {
    if (!ratingResponseId) return;
    try {
      const response = await fetch(`/api/orders/${resolvedParams.id}/responses/${ratingResponseId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: ratingValue }),
      });

      if (response.ok) {
        fetchOrder();
        setIsRatingDialogOpen(false);
        setRatingResponseId(null);
        toast({
          title: "Оценка сохранена",
          description: "Рейтинг сотрудника обновлен",
        });
        throw new Error("Failed");
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось выставить оценку", variant: "destructive" });
    } finally {
      setIsRatingDialogOpen(false);
      setRatingResponseId(null);
    }
  };

  const handleChecklistChange = (index: number, checked: boolean) => {
    const newCheckedItems = [...checkedItems];
    newCheckedItems[index] = checked;
    setCheckedItems(newCheckedItems);
  };

  if (status === "loading" || loading) return <div className="p-6">Загрузка...</div>;
  if (!order) return null;

  const assignedCount = order.responses.filter(r => r.status === "ASSIGNED").length;
  const pendingResponses = order.responses.filter(r => r.status === "PENDING");
  const assignedResponses = order.responses.filter(r => r.status === "ASSIGNED");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/orders")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{order.title}</h1>
            <p className="text-muted-foreground">
              {order.bot.city} • {order.bot.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={orderStatusConfig[order.status]?.bgColor}>
            {orderStatusConfig[order.status]?.label}
          </Badge>
          <Badge variant="outline">
            <div className={cn("w-2 h-2 rounded-full mr-2", paymentStatusConfig[order.paymentStatus]?.color)} />
            {paymentStatusConfig[order.paymentStatus]?.label}
          </Badge>
          <Button variant="outline" size="sm" className="text-destructive ml-2" onClick={handleDeleteOrder}>
            <Trash2 className="h-4 w-4 mr-1" />
            Удалить
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">Информация</TabsTrigger>
              <TabsTrigger value="checklist">Чек-лист</TabsTrigger>
              <TabsTrigger value="responses">Отклики ({order.responses.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Детали заказа</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {order.description && (
                    <div>
                      <p className="text-sm text-muted-foreground">Описание</p>
                      <p className="mt-1">{order.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDate(order.workDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{order.workTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{order.requiredPeople} чел.</span>
                    </div>
                    <div className="font-medium">
                      {formatCurrency(order.pricePerPerson)} / чел.
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Тип работ</p>
                    <Badge variant="secondary">{order.workType}</Badge>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Адрес</p>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        {order.district && <p>Район: {order.district}</p>}
                        <p>ул. {order.street}, д. {order.houseNumber}</p>
                        {order.officeNumber && <p>оф. {order.officeNumber}</p>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Клиент</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{order.clientName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${order.clientPhone}`} className="text-primary hover:underline">
                      {order.clientPhone}
                    </a>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="checklist">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Чек-лист задач</CardTitle>
                </CardHeader>
                <CardContent>
                  {checklists.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Чек-лист не задан
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {checklists.map((item, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <Checkbox
                            id={`checklist-${index}`}
                            checked={checkedItems[index]}
                            onCheckedChange={(checked) => 
                              handleChecklistChange(index, checked as boolean)
                            }
                          />
                          <label
                            htmlFor={`checklist-${index}`}
                            className={cn(
                              "text-sm cursor-pointer",
                              checkedItems[index] && "line-through text-muted-foreground"
                            )}
                          >
                            {item}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="responses">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Отклики сотрудников
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({assignedCount}/{order.requiredPeople} назначено)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {order.responses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Пока нет откликов
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {order.responses.map((response) => (
                        <div
                          key={response.id}
                          className="flex flex-col p-4 border rounded-lg gap-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback>
                                  {response.employee.firstName[0]}
                                  {response.employee.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {response.employee.firstName} {response.employee.lastName}
                                </p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {response.employee.phone}
                                  {response.employee.rating > 0 && (
                                    <span>★ {response.employee.rating.toFixed(1)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={responseStatusConfig[response.status]?.color}>
                                {responseStatusConfig[response.status]?.label}
                              </Badge>
                              {response.status === "PENDING" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleAssignEmployee(response.id)}
                                    disabled={assignedCount >= order.requiredPeople}
                                  >
                                    <UserPlus className="h-4 w-4 mr-1" />
                                    Назначить
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRejectEmployee(response.id)}
                                  >
                                    <UserX className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          {(response.checkedInAt || response.reportText || response.reportPhotoId || response.status === "COMPLETED") && (
                            <div className="flex flex-col gap-2 pt-2 border-t mt-2">
                              {response.checkedInAt && (
                                <div className="text-sm text-muted-foreground flex justify-between">
                                  <span>Время прибытия (чек-ин):</span>
                                  <span>{new Date(response.checkedInAt).toLocaleTimeString("ru-RU", {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                              )}
                              {response.completedAt && (
                                <div className="text-sm text-muted-foreground flex justify-between">
                                  <span>Время завершения:</span>
                                  <span>{new Date(response.completedAt).toLocaleTimeString("ru-RU", {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                              )}
                              {response.reportText && (
                                <div className="text-sm border-l-2 border-primary pl-3 py-1 my-1">
                                  <p className="text-muted-foreground italic">&quot;{response.reportText}&quot;</p>
                                </div>
                              )}
                              {response.reportPhotoId && (
                                <div className="text-sm text-muted-foreground mt-2">
                                  <div className="flex items-center gap-1 mb-2">
                                    <ImageIcon className="h-4 w-4" />
                                    <span>Фотоотчет прикреплен</span>
                                  </div>
                                  <div className="flex gap-2 overflow-x-auto pb-2">
                                    {response.reportPhotoId.split(',').filter(Boolean).map((photoUrl, idx) => (
                                      <img 
                                        key={idx} 
                                        src={photoUrl.startsWith('/') ? photoUrl : `/uploads/telegram_${photoUrl}.jpg`} 
                                        alt="Отчет" 
                                        className="h-24 w-24 object-cover rounded-md border" 
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {response.status === "COMPLETED" && (
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-sm font-medium">Оценка работы:</span>
                                  {response.rating ? (
                                    <div className="flex text-yellow-500">
                                      {Array.from({ length: 5 }).map((_, i) => (
                                        <Star key={i} className={`h-4 w-4 ${i < response.rating! ? "fill-current" : "text-gray-300"}`} />
                                      ))}
                                    </div>
                                  ) : (
                                    <Button size="sm" variant="outline" onClick={() => handleOpenRatingDialog(response.id)}>
                                      <Star className="h-4 w-4 mr-1" /> Оценить
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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
              <CardTitle className="text-lg">Финансы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Цена за человека</span>
                <span>{formatCurrency(order.pricePerPerson)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Количество</span>
                <span>{order.requiredPeople} чел.</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Итого</span>
                <span>{formatCurrency(order.pricePerPerson * order.requiredPeople)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Действия</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.status === "DRAFT" && (
                <Button className="w-full" onClick={() => setIsPublishDialogOpen(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Опубликовать
                </Button>
              )}
              {order.status === "PUBLISHED" && (
                <Button 
                  className="w-full" 
                  onClick={() => handleStatusChange("IN_PROGRESS")}
                  disabled={assignedCount === 0}
                >
                  Начать работу
                </Button>
              )}
              {order.status === "IN_PROGRESS" && (
                <Button className="w-full" onClick={() => handleStatusChange("COMPLETED")}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Завершить
                </Button>
              )}
              <Button variant="outline" className="w-full">
                <Edit className="h-4 w-4 mr-2" />
                Редактировать
              </Button>
              {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={() => handleStatusChange("CANCELLED")}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Отменить
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Создан</p>
                <p>{formatDate(order.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Автор</p>
                <p>{order.creator.name}</p>
              </div>
              {order.publishAt && (
                <div>
                  <p className="text-muted-foreground">Публикация</p>
                  <p>{formatDate(order.publishAt)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Publish Dialog */}
      <AlertDialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Опубликовать заказ?</AlertDialogTitle>
            <AlertDialogDescription>
              Заказ будет отправлен всем одобренным контактам в Telegram.
              Вы уверены, что хотите опубликовать?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish}>
              Опубликовать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rating Dialog */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Оценить работу сотрудника</DialogTitle>
            <DialogDescription>
              Оцените качество выполненной работы (от 1 до 5 звезд)
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-2 py-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Button 
                key={i} 
                variant="ghost" 
                size="icon" 
                className="h-12 w-12"
                onClick={() => setRatingValue(i + 1)}
              >
                <Star className={`h-10 w-10 ${i < ratingValue ? "fill-yellow-500 text-yellow-500" : "text-gray-300"}`} />
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRatingDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleRateEmployee}>
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}