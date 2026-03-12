"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Tag } from "lucide-react";
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

interface EmployeeTag {
  id: string;
  name: string;
  color: string;
  type: string;
  _count?: { employees: number };
}

const tagTypeConfig: Record<string, { label: string }> = {
  SKILL: { label: "Навык" },
  STATUS: { label: "Статус" },
};

const predefinedColors = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9",
  "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7", "#D946EF",
  "#EC4899", "#F43F5E", "#6B7280", "#71717A", "#737373",
];

export default function EmployeeTagsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [tags, setTags] = useState<EmployeeTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<EmployeeTag | null>(null);
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "#3B82F6",
    type: "SKILL",
  });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") fetchTags();
  }, [status]);

  const fetchTags = async () => {
    try {
      const response = await fetch("/api/employees/tags");
      const data = await response.json();
      setTags(data);
    } catch (error) {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить теги",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (tag?: EmployeeTag) => {
    if (tag) {
      setEditingTag(tag);
      setFormData({
        name: tag.name,
        color: tag.color,
        type: tag.type,
      });
    } else {
      setEditingTag(null);
      setFormData({
        name: "",
        color: "#3B82F6",
        type: "SKILL",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveTag = async () => {
    try {
      const url = editingTag
        ? `/api/employees/tags/${editingTag.id}`
        : "/api/employees/tags";
      const method = editingTag ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const savedTag = await response.json();
        if (editingTag) {
          setTags(tags.map((t) => (t.id === savedTag.id ? savedTag : t)));
          toast({
            title: "Тег обновлен",
            description: "Тег успешно обновлен",
          });
        } else {
          setTags([savedTag, ...tags]);
          toast({
            title: "Тег создан",
            description: "Новый тег успешно создан",
          });
        }
        setIsDialogOpen(false);
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить тег",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTag = async () => {
    if (!deleteTagId) return;

    try {
      const response = await fetch(`/api/employees/tags/${deleteTagId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTags(tags.filter((t) => t.id !== deleteTagId));
        toast({
          title: "Тег удален",
          description: "Тег успешно удален",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить тег",
        variant: "destructive",
      });
    } finally {
      setDeleteTagId(null);
    }
  };

  if (status === "loading") return <div className="p-6">Загрузка...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Теги сотрудников</h1>
          <p className="text-muted-foreground">
            Управление тегами для классификации сотрудников
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Новый тег
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTag ? "Редактирование тега" : "Новый тег"}
              </DialogTitle>
              <DialogDescription>
                Создайте тег для классификации сотрудников
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название тега *</Label>
                <Input
                  id="name"
                  placeholder="Грузчик"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Тип тега</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SKILL">Навык</SelectItem>
                    <SelectItem value="STATUS">Статус</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Цвет</Label>
                <div className="flex flex-wrap gap-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        formData.color === color ? "border-black scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Label htmlFor="customColor" className="text-sm">Свой цвет:</Label>
                  <Input
                    id="customColor"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-8 p-0 cursor-pointer"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-28"
                    placeholder="#000000"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label>Превью:</Label>
                <Badge style={{ backgroundColor: formData.color }}>
                  {formData.name || "Название"}
                </Badge>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleSaveTag} disabled={!formData.name.trim()}>
                {editingTag ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center">Загрузка тегов...</div>
          ) : tags.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Tag className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Теги не найдены</p>
              <p className="text-sm">Создайте первый тег для классификации сотрудников</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тег</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Сотрудников</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <Badge style={{ backgroundColor: tag.color }}>
                        {tag.name}
                      </Badge>
                    </TableCell>
                    <TableCell>{tagTypeConfig[tag.type]?.label}</TableCell>
                    <TableCell>{tag._count?.employees || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(tag)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTagId(tag.id)}
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
        open={!!deleteTagId}
        onOpenChange={() => setDeleteTagId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить тег?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Тег будет удален со всех сотрудников.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTag}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}