"use client";

import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

interface DashboardNotification {
  id: string;
  text: string;
  time: string;
  type: "response" | "checkin" | "completed" | "other";
}

interface RecentResponse {
  id: string;
  status: string;
  respondedAt: string;
  employee: {
    firstName: string;
    lastName: string;
  };
  order: {
    id: string;
    title: string;
  };
}

interface HeaderProps {
  title: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин. назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч. назад`;
  return `${Math.floor(diffHours / 24)} дн. назад`;
}

function buildNotifications(recentResponses: RecentResponse[]): DashboardNotification[] {
  return recentResponses.map((r) => {
    const name = `${r.employee.firstName} ${r.employee.lastName}`;
    let text = "";
    let type: DashboardNotification["type"] = "other";
    switch (r.status) {
      case "PENDING":
        text = `Новый отклик: ${name} на «${r.order.title}»`;
        type = "response";
        break;
      case "CHECKED_IN":
        text = `${name} отметился на «${r.order.title}»`;
        type = "checkin";
        break;
      case "COMPLETED":
        text = `${name} завершил «${r.order.title}»`;
        type = "completed";
        break;
      case "REJECTED":
        text = `${name} отказался от «${r.order.title}»`;
        break;
      default:
        text = `Обновлён отклик ${name} на «${r.order.title}»`;
    }
    return { id: r.id, text, time: formatRelativeTime(r.respondedAt), type };
  });
}

export function Header({ title }: HeaderProps) {
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(buildNotifications(data.recentResponses ?? []));
    } catch {
      // молча игнорируем ошибки сети
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = notifications.filter((n) => n.type === "response").length;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-base font-medium">
              {title}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex flex-1 items-center justify-end gap-2">
        <div className="relative hidden md:flex">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Поиск..."
            className="w-64 pl-8 bg-muted/50"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Уведомления</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <DropdownMenuItem className="text-muted-foreground text-sm justify-center py-4 pointer-events-none">
                Нет новых уведомлений
              </DropdownMenuItem>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className="flex flex-col items-start gap-1"
                >
                  <span className="font-medium text-sm leading-snug">{n.text}</span>
                  <span className="text-xs text-muted-foreground">{n.time}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
