"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, UserCheck, UserX, Clock, Loader2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
  status: "NEW" | "APPROVED" | "BANNED";
  registeredAt: string;
  bot?: { id: string; name: string; city: string };
}

export default function ModerationPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("new");
  const { toast } = useToast();

  const fetchContacts = async () => {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      setContacts(data);
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось загрузить контакты", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  const updateContactStatus = async (id: string, status: "APPROVED" | "BANNED") => {
    try {
      const res = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        toast({ title: "Успех", description: status === "APPROVED" ? "Контакт одобрен" : "Контакт заблокирован" });
        fetchContacts();
      }
    } catch (error) {
      toast({ title: "Ошибка", description: "Не удалось обновить статус", variant: "destructive" });
    }
  };

  const filteredContacts = contacts.filter((c) => {
    if (activeTab === "new") return c.status === "NEW";
    if (activeTab === "approved") return c.status === "APPROVED";
    if (activeTab === "banned") return c.status === "BANNED";
    return true;
  });

  const newCount = contacts.filter((c) => c.status === "NEW").length;

  if (loading) {
    return <div className="flex items-center justify-center h-[50vh]"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Модерация</h1>
        <p className="text-muted-foreground">Управление заявками пользователей из Telegram ботов</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="new">Новые {newCount > 0 && <Badge className="ml-2" variant="secondary">{newCount}</Badge>}</TabsTrigger>
          <TabsTrigger value="approved">Одобренные</TabsTrigger>
          <TabsTrigger value="banned">Заблокированные</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardContent className="pt-6">
              {filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Нет контактов</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Пользователь</TableHead>
                      <TableHead>Telegram</TableHead>
                      <TableHead>Бот</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8"><AvatarFallback>{contact.firstName?.[0] || "?"}</AvatarFallback></Avatar>
                            <span>{contact.firstName} {contact.lastName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{contact.username ? `@${contact.username}` : contact.telegramId}</TableCell>
                        <TableCell><Badge variant="outline">{contact.bot?.name || "-"}</Badge></TableCell>
                        <TableCell>{new Date(contact.registeredAt).toLocaleDateString("ru-RU")}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {contact.status === "NEW" && (
                              <>
                                <Button size="sm" variant="outline" className="text-green-600" onClick={() => updateContactStatus(contact.id, "APPROVED")}><Check className="h-4 w-4" /></Button>
                                <Button size="sm" variant="outline" className="text-red-600" onClick={() => updateContactStatus(contact.id, "BANNED")}><X className="h-4 w-4" /></Button>
                              </>
                            )}
                            {contact.status === "APPROVED" && <Button size="sm" variant="outline" className="text-red-600" onClick={() => updateContactStatus(contact.id, "BANNED")}>Заблокировать</Button>}
                            {contact.status === "BANNED" && <Button size="sm" variant="outline" className="text-green-600" onClick={() => updateContactStatus(contact.id, "APPROVED")}>Разблокировать</Button>}
                          </div>
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
