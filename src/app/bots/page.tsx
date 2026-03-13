"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Plus, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, RefreshCw, PowerOff, Trash2, Power, Info } from "lucide-react";

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

export default function BotsPage() {
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

  const handleDeleteBot = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить этого бота? Это действие нельзя отменить.")) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/bots/${id}`, { method: "DELETE" });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to delete bot");
      }
      
      toast({ title: "Бот удален" });
      setBots(bots.filter(b => b.id !== id));
    } catch (error: any) {
      toast({ 
        title: "Ошибка", 
        description: error.message || "Не удалось удалить бота", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBot = async (id: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/bots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (!res.ok) throw new Error("Failed to update bot status");
      toast({ title: !currentStatus ? "Бот активирован" : "Бот приостановлен" });
      setBots(bots.map(b => b.id === id ? { ...b, isActive: !currentStatus } : b));
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось изменить статус бота", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshWebhook = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/telegram/webhook?bot_id=${id}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to refresh webhook");
      }
      
      toast({ 
        title: "Webhook обновлен", 
        description: data.bot?.username 
          ? `Бот @${data.bot.username} готов к работе` 
          : "Бот снова готов к работе" 
      });
    } catch (error: any) {
      toast({ 
        title: "Ошибка", 
        description: error.message || "Не удалось обновить webhook", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckBotStatus = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/telegram/webhook?bot_id=${id}&action=info`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to check bot status");
      }
      
      if (data.ok) {
        const botInfo = data.bot;
        const webhookInfo = data.webhook;
        
        let message = `Бот: @${botInfo.username} (${botInfo.firstName})\n`;
        message += `Webhook: ${webhookInfo.url ? '✅ Настроен' : '❌ Не настроен'}\n`;
        
        if (webhookInfo.lastErrorMessage) {
          message += `Последняя ошибка: ${webhookInfo.lastErrorMessage}\n`;
        }
        
        if (webhookInfo.pendingUpdateCount > 0) {
          message += `Ожидающих обновлений: ${webhookInfo.pendingUpdateCount}\n`;
        }
        
        toast({ 
          title: "Статус бота", 
          description: message,
          duration: 5000
        });
      }
    } catch (error: any) {
      toast({ 
        title: "Ошибка", 
        description: error.message || "Не удалось проверить статус бота", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Боты" />
      <main className="flex-1 p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Telegram-боты</h1>
            <p className="text-muted-foreground">Управление городами и интеграциями</p>
          </div>
          <AddBotDialog onBotAdded={() => {
            setLoading(true);
            fetch("/api/bots")
              .then((res) => res.json())
              .then(setBots)
              .finally(() => setLoading(false));
          }} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            [1, 2, 3].map((i) => <Card key={i}><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>)
          ) : bots.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Боты не найдены. Добавьте первого бота для начала работы.
            </div>
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
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", bot.isActive ? "bg-green-500" : "bg-gray-400")} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="-mr-2">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Меню действий</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Управление ботом</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleCheckBotStatus(bot.id)}>
                            <Info className="mr-2 h-4 w-4" />
                            Проверить статус
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRefreshWebhook(bot.id)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Обновить Webhook
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleBot(bot.id, bot.isActive)}>
                            {bot.isActive ? (
                              <>
                                <PowerOff className="mr-2 h-4 w-4" />
                                Приостановить
                              </>
                            ) : (
                              <>
                                <Power className="mr-2 h-4 w-4" />
                                Запустить
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => handleDeleteBot(bot.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Удалить бота
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Подписчики</span><span className="font-medium">{bot.subscriberCount?.toLocaleString("ru-RU") || 0}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Заказы</span><span className="font-medium">{bot._count?.orders || 0}</span></div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
