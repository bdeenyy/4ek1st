"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Copy, FileText } from "lucide-react";
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

interface OrderTemplate {
  id: string;
  name: string;
  description: string | null;
  workType: string;
  requiredPeople: number;
  checklists: string | null;
  createdAt: string;
}

export default function OrderTemplatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<OrderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<OrderTemplate | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    workType: "",
    requiredPeople: 1,
    checklists: [] as string[],
  });
  const [newChecklistItem, setNewChecklistItem] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") fetchTemplates();
  }, [status]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/orders/templates");
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить шаблоны",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template?: OrderTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || "",
        workType: template.workType,
        requiredPeople: template.requiredPeople,
        checklists: template.checklists ? JSON.parse(template.checklists) : [],
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: "",
        description: "",
        workType: "",
        requiredPeople: 1,
        checklists: [],
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const url = editingTemplate
        ? `/api/orders/templates/${editingTemplate.id}`
        : "/api/orders/templates";
      const method = editingTemplate ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          checklists: JSON.stringify(formData.checklists),
        }),
      });

      if (response.ok) {
        const savedTemplate = await response.json();
        if (editingTemplate) {
          setTemplates(
            templates.map((t) =>
              t.id === savedTemplate.id ? savedTemplate : t
            )
          );
          toast({
            title: "Шаблон обновлен",
            description: "Шаблон успешно обновлен",
          });
        } else {
          setTemplates([savedTemplate, ...templates]);
          toast({
            title: "Шаблон создан",
            description: "Новый шаблон успешно создан",
          });
        }
        setIsDialogOpen(false);
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить шаблон",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;

    try {
      const response = await fetch(`/api/orders/templates/${deleteTemplateId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTemplates(templates.filter((t) => t.id !== deleteTemplateId));
        toast({
          title: "Шаблон удален",
          description: "Шаблон успешно удален",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить шаблон",
        variant: "destructive",
      });
    } finally {
      setDeleteTemplateId(null);
    }
  };

  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setFormData({
        ...formData,
        checklists: [...formData.checklists, newChecklistItem.trim()],
      });
      setNewChecklistItem("");
    }
  };

  const handleRemoveChecklistItem = (index: number) => {
    setFormData({
      ...formData,
      checklists: formData.checklists.filter((_, i) => i !== index),
    });
  };

  const handleUseTemplate = (template: OrderTemplate) => {
    // Переходим на страницу создания заказа с параметрами шаблона
    const params = new URLSearchParams({
      templateId: template.id,
      name: template.name,
      workType: template.workType,
      requiredPeople: template.requiredPeople.toString(),
      description: template.description || "",
    });
    router.push(`/orders?${params.toString()}`);
  };

  if (status === "loading") return <div className="p-6">Загрузка...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Шаблоны заказов</h1>
          <p className="text-muted-foreground">
            Управление шаблонами для быстрого создания заказов
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Новый шаблон
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Редактирование шаблона" : "Новый шаблон"}
              </DialogTitle>
              <DialogDescription>
                Создайте шаблон для быстрого создания типовых заказов
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название шаблона *</Label>
                  <Input
                    id="name"
                    placeholder="Погрузка мебели"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workType">Тип работ *</Label>
                  <Input
                    id="workType"
                    placeholder="Погрузочные работы"
                    value={formData.workType}
                    onChange={(e) =>
                      setFormData({ ...formData, workType: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  placeholder="Описание работ по шаблону..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requiredPeople">Количество человек</Label>
                <Input
                  id="requiredPeople"
                  type="number"
                  min="1"
                  value={formData.requiredPeople}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requiredPeople: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Чек-лист задач</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Добавить пункт..."
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleAddChecklistItem()}
                  />
                  <Button type="button" onClick={handleAddChecklistItem}>
                    Добавить
                  </Button>
                </div>
                {formData.checklists.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {formData.checklists.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-muted p-2 rounded"
                      >
                        <span className="text-sm">{item}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveChecklistItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleSaveTemplate}>
                {editingTemplate ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center">Загрузка шаблонов...</div>
          ) : templates.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Шаблоны не найдены</p>
              <p className="text-sm">Создайте первый шаблон для быстрого создания заказов</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Тип работ</TableHead>
                  <TableHead>Кол-во человек</TableHead>
                  <TableHead>Чек-лист</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="font-medium">{template.name}</div>
                      {template.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {template.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{template.workType}</TableCell>
                    <TableCell>{template.requiredPeople} чел.</TableCell>
                    <TableCell>
                      {template.checklists
                        ? `${JSON.parse(template.checklists).length} пунктов`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUseTemplate(template)}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Использовать
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTemplateId(template.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteTemplateId}
        onOpenChange={() => setDeleteTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить шаблон?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Шаблон будет удален навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}