import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/lessons")({
  component: AdminLessons,
});

type Lesson = {
  id: string;
  day_number: number;
  title: string;
  description: string;
  video_url: string | null;
  content_md: string;
  homework_md: string;
};

function AdminLessons() {
  const { isAdmin } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      setLoading(true);
      const { data } = await supabase.from("lessons").select("*").order("day_number");
      setLessons((data ?? []) as Lesson[]);
      setActiveId(((data ?? [])[0] as Lesson | undefined)?.id ?? null);
      setLoading(false);
    })();
  }, [isAdmin]);

  const active = lessons.find((l) => l.id === activeId) ?? null;

  function update<K extends keyof Lesson>(key: K, value: Lesson[K]) {
    if (!active) return;
    setLessons((prev) => prev.map((l) => (l.id === active.id ? { ...l, [key]: value } : l)));
  }

  async function save() {
    if (!active) return;
    setSaving(true);
    const { error } = await supabase
      .from("lessons")
      .update({
        title: active.title,
        description: active.description,
        video_url: active.video_url,
        content_md: active.content_md,
        homework_md: active.homework_md,
      })
      .eq("id", active.id);
    setSaving(false);
    if (error) toast.error("Не удалось сохранить");
    else toast.success("Урок сохранён");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Управление уроками</h1>
        <p className="text-muted-foreground mt-1">Редактируй контент уроков, видео и задания.</p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <aside className="rounded-2xl border border-border bg-card p-3 h-fit lg:sticky lg:top-32">
          <div className="space-y-1 max-h-[70vh] overflow-y-auto">
            {lessons.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveId(l.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-colors ${
                  activeId === l.id ? "bg-primary-soft text-primary font-semibold" : "hover:bg-muted"
                }`}
              >
                <span className="h-7 w-7 rounded-md bg-background border border-border flex items-center justify-center text-xs font-bold shrink-0">
                  {l.day_number}
                </span>
                <span className="truncate">{l.title}</span>
              </button>
            ))}
          </div>
        </aside>

        {active ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" /> День {active.day_number}
              </div>
              <Button variant="hero" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Сохранить
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={active.title} onChange={(e) => update("title", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Краткое описание</Label>
              <Input value={active.description} onChange={(e) => update("description", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ссылка на видео (embed)</Label>
              <Input
                placeholder="https://www.youtube.com/embed/..."
                value={active.video_url ?? ""}
                onChange={(e) => update("video_url", e.target.value || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Конспект</Label>
              <Textarea rows={10} value={active.content_md} onChange={(e) => update("content_md", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Домашнее задание</Label>
              <Textarea rows={6} value={active.homework_md} onChange={(e) => update("homework_md", e.target.value)} />
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
            Выбери урок слева
          </div>
        )}
      </div>
    </div>
  );
}
