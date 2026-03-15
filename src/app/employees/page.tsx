"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MoreHorizontal, Eye, Edit, Trash2, Star, Phone, MessageCircle, Loader2, CheckCircle, Ban, Clock, UserX } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const employeeStatusConfig: Record<string, { label: string; color: string }> = {
  AVAILABLE: { label: "Доступен", color: "bg-green-500" },
  WORKING: { label: "Работает", color: "bg-blue-500" },
  BUSY: { label: "Занят", color: "bg-yellow-500" },
  BANNED: { label: "Заблокирован", color: "bg-red-500" },
};

function formatRating(rating: number) { return rating ? rating.toFixed(1) : "—"; }

export default function EmployeesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ firstName: "", lastName: "", middleName: "", phone: "", phone2: "", telegramId: "", notes: "", tagIds: [] as string[] });

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);
  useEffect(() => { if (status === "authenticated") { fetchEmployees(); fetchTags(); } }, [status]);

  const fetchTags = async () => {
    try {
      const response = await fetch("/api/employees/tags");
      const data = await response.json();
      setTags(data);
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  const fetchEmployees = useCallback(async (searchTerm?: string) => {
    try {
      setSearching(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (tagFilter && tagFilter !== "all") params.append("tagId", tagFilter);
      
      const response = await fetch(`/api/employees?${params.toString()}`);
      const data = await response.json();
      setEmployees(data);
    } catch (error) { 
      toast({ title: "Ошибка загрузки", description: "Не удалось загрузить сотрудников", variant: "destructive" }); 
    } finally { 
      setLoading(false);
      setSearching(false);
    }
  }, [statusFilter, tagFilter, toast]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === "authenticated") {
        fetchEmployees(search);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, tagFilter, status, fetchEmployees]);

  const handleCreateEmployee = async () => {
    try {
      const { tagIds, ...rest } = newEmployee;
      const response = await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...rest, tags: tagIds }) });
      if (response.ok) { const created = await response.json(); setEmployees([created, ...employees]); setIsCreateDialogOpen(false); setNewEmployee({ firstName: "", lastName: "", middleName: "", phone: "", phone2: "", telegramId: "", notes: "", tagIds: [] }); toast({ title: "Сотрудник добавлен" }); }
    } catch (error) { toast({ title: "Ошибка", description: "Не удалось добавить сотрудника", variant: "destructive" }); }
  };

  const handleStatusChange = async (employeeId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setEmployees(employees.map(emp => emp.id === employeeId ? { ...emp, status: newStatus } : emp));
        toast({ title: "Статус обновлен" });
      }
    } catch (error) {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!window.confirm("Вы уверены, что хотите удалить этого сотрудника? Все его данные и история будут удалены.")) return;
    
    try {
      const response = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (response.ok) {
        setEmployees(employees.filter(emp => emp.id !== id));
        toast({ title: "Сотрудник удален" });
      }
    } catch (error) {
      toast({ title: "Ошибка удаления", variant: "destructive" });
    }
  };

  if (status === "loading") return <div className="p-6">Загрузка...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-3xl font-bold">Сотрудники</h1><p className="text-muted-foreground">Управление базой сотрудников</p></div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Добавить сотрудника</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Добавление сотрудника</DialogTitle><DialogDescription>Заполните информацию о сотруднике</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-2"><div className="space-y-1"><Label>Фамилия</Label><Input value={newEmployee.lastName} onChange={(e) => setNewEmployee({...newEmployee, lastName: e.target.value})} /></div><div className="space-y-1"><Label>Имя</Label><Input value={newEmployee.firstName} onChange={(e) => setNewEmployee({...newEmployee, firstName: e.target.value})} /></div><div className="space-y-1"><Label>Отчество</Label><Input value={newEmployee.middleName} onChange={(e) => setNewEmployee({...newEmployee, middleName: e.target.value})} /></div></div>
              <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>Телефон</Label><Input value={newEmployee.phone} onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})} /></div><div className="space-y-1"><Label>Telegram ID</Label><Input value={newEmployee.telegramId} onChange={(e) => setNewEmployee({...newEmployee, telegramId: e.target.value})} /></div></div>
              <div className="space-y-1"><Label>Заметки</Label><Textarea value={newEmployee.notes} onChange={(e) => setNewEmployee({...newEmployee, notes: e.target.value})} /></div>
              {tags.length > 0 && (
                <div className="space-y-2">
                  <Label>Теги</Label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag: any) => {
                      const selected = newEmployee.tagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => setNewEmployee({
                            ...newEmployee,
                            tagIds: selected
                              ? newEmployee.tagIds.filter(id => id !== tag.id)
                              : [...newEmployee.tagIds, tag.id]
                          })}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium border-2 transition-opacity ${selected ? 'opacity-100' : 'opacity-40'}`}
                          style={{ backgroundColor: tag.color, borderColor: tag.color, color: '#fff' }}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Отмена</Button><Button onClick={handleCreateEmployee}>Добавить</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-4"><div className="flex flex-col md:flex-row gap-4"><div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Поиск..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Статус" /></SelectTrigger><SelectContent><SelectItem value="all">Все</SelectItem><SelectItem value="AVAILABLE">Доступен</SelectItem><SelectItem value="WORKING">Работает</SelectItem><SelectItem value="BUSY">Занят</SelectItem><SelectItem value="BANNED">Заблокирован</SelectItem></SelectContent></Select>{tags.length > 0 && (<Select value={tagFilter} onValueChange={setTagFilter}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Тег" /></SelectTrigger><SelectContent><SelectItem value="all">Все теги</SelectItem>{tags.map((tag: any) => (<SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>))}</SelectContent></Select>)}</div></CardContent></Card>

      <Card><CardContent className="p-0">
        {loading ? <div className="p-6 text-center">Загрузка...</div> : employees.length === 0 ? <div className="p-6 text-center text-muted-foreground">Сотрудники не найдены</div> : (
          <Table><TableHeader><TableRow><TableHead>Сотрудник</TableHead><TableHead>Контакты</TableHead><TableHead>Рейтинг</TableHead><TableHead>Статус</TableHead><TableHead>Теги</TableHead><TableHead className="text-right">Действия</TableHead></TableRow></TableHeader><TableBody>
            {employees.map((emp) => (<TableRow key={emp.id}><TableCell><div className="font-medium">{emp.lastName} {emp.firstName}</div>{emp.middleName && <div className="text-sm text-muted-foreground">{emp.middleName}</div>}</TableCell><TableCell><div className="flex items-center gap-1"><Phone className="h-3 w-3" />{emp.phone}</div>{emp.telegramId && <div className="text-xs text-muted-foreground flex items-center gap-1"><MessageCircle className="h-3 w-3" />{emp.telegramId}</div>}</TableCell><TableCell><div className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-500" />{formatRating(emp.rating)}</div></TableCell><TableCell><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${employeeStatusConfig[emp.status]?.color}`} /><span>{employeeStatusConfig[emp.status]?.label}</span></div></TableCell><TableCell><div className="flex flex-wrap gap-1">{emp.tags?.slice(0, 3).map((t: any) => <Badge key={t.id} style={{backgroundColor: t.color}}>{t.name}</Badge>)}</div></TableCell><TableCell className="text-right">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>Действия</DropdownMenuLabel>
      <DropdownMenuItem onClick={() => router.push(`/employees/${emp.id}`)}>
        <Eye className="mr-2 h-4 w-4" />Просмотр
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => handleStatusChange(emp.id, "AVAILABLE")} disabled={emp.status === "AVAILABLE"}>
        <CheckCircle className="mr-2 h-4 w-4 text-green-600" />Доступен
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleStatusChange(emp.id, "BUSY")} disabled={emp.status === "BUSY"}>
        <Clock className="mr-2 h-4 w-4 text-yellow-600" />Занят
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => handleStatusChange(emp.id, "BANNED")} disabled={emp.status === "BANNED"}>
        <UserX className="mr-2 h-4 w-4 text-red-600" />Заблокировать
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem 
        onClick={() => handleDeleteEmployee(emp.id)} 
        className="text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />Удалить полностью
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</TableCell>
</TableRow>))}
          </TableBody></Table>)}
        </CardContent></Card>
    </div>
  );
}
