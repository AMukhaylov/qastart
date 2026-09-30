import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, Trash2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getNotificationNavigationTarget } from "@/lib/notification-navigation";

type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
  metadata: Json;
};

const SOUND_KEY = "startqa:notifications:sound";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function createAudioContext() {
  const AudioContextClass =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function playNotificationSound(context: AudioContext | null) {
  if (!context || context.state !== "running") return;
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.04, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  } catch {
    // Sound is optional and must never prevent notification delivery.
  }
}

export function NotificationBell() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const announcedNotificationIdsRef = useRef<Set<string>>(new Set());
  const soundEnabledRef = useRef(true);

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read_at: now } : item)),
    );
    await supabase.from("notifications").update({ read_at: now }).eq("id", id);
  }, []);

  const openNotification = useCallback(
    (item: AppNotification) => {
      // The badge updates immediately; a navigation error never removes notification history.
      void markRead(item.id);
      const target = getNotificationNavigationTarget(item, isAdmin);
      if (target.kind === "student-homework") {
        void navigate({
          to: "/lessons/$day",
          params: { day: String(target.lessonDay) },
          search: { focus: "homework" },
        });
        return;
      }
      if (target.kind === "admin-homework") {
        // Use a real URL for the admin deep link so the submission query is
        // preserved even when the notification lives outside the router tree.
        window.location.assign(
          `/admin/homework?submission=${encodeURIComponent(target.submissionId)}`,
        );
        return;
      }
      window.location.assign(target.href);
    },
    [isAdmin, markRead, navigate],
  );

  useEffect(() => {
    setSoundEnabled(window.localStorage.getItem(SOUND_KEY) !== "off");
    soundEnabledRef.current = window.localStorage.getItem(SOUND_KEY) !== "off";
    const unlockAudio = () => {
      if (!audioContextRef.current) audioContextRef.current = createAudioContext();
      void audioContextRef.current?.resume();
    };
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,title,body,link,read_at,created_at,metadata")
        .eq("recipient_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!active || error) return;
      const nextItems = (data ?? []) as AppNotification[];
      nextItems.forEach((item) => seenNotificationIdsRef.current.add(item.id));
      setItems(nextItems);
    };
    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), 30_000);
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as AppNotification;
          if (!active) return;
          const alreadySeen = seenNotificationIdsRef.current.has(incoming.id);
          seenNotificationIdsRef.current.add(incoming.id);
          setItems((current) =>
            [incoming, ...current.filter((item) => item.id !== incoming.id)].slice(0, 20),
          );
          if (
            payload.eventType !== "INSERT" ||
            alreadySeen ||
            announcedNotificationIdsRef.current.has(incoming.id)
          )
            return;
          announcedNotificationIdsRef.current.add(incoming.id);
          toast(incoming.title, {
            description: incoming.body,
            action: { label: "Открыть", onClick: () => openNotification(incoming) },
          });
          if (soundEnabledRef.current) playNotificationSound(audioContextRef.current);
          if (
            document.visibilityState !== "visible" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const browserNotification = new Notification(incoming.title, {
              body: incoming.body,
              data: { link: incoming.link, metadata: incoming.metadata, type: incoming.type },
            });
            browserNotification.onclick = () => {
              window.focus();
              browserNotification.close();
              openNotification(incoming);
            };
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as AppNotification;
          if (!active) return;
          seenNotificationIdsRef.current.add(incoming.id);
          setItems((current) =>
            current.some((item) => item.id === incoming.id)
              ? current.map((item) => (item.id === incoming.id ? incoming : item))
              : [incoming, ...current].slice(0, 20),
          );
        },
      )
      .subscribe();
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [openNotification, user?.id]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);
  if (!user) return null;

  const markAllRead = async () => {
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_user_id", user.id)
      .is("read_at", null);
  };
  const clearNotifications = async () => {
    const previousItems = items;
    setItems([]);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("recipient_user_id", user.id);
    if (error) {
      setItems(previousItems);
      toast.error("Не удалось очистить уведомления");
      return;
    }
    seenNotificationIdsRef.current.clear();
    announcedNotificationIdsRef.current.clear();
    toast.success("Уведомления очищены");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Уведомления">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-2">
        <div className="flex items-center justify-between gap-3 px-2 py-1">
          <DropdownMenuLabel className="p-0">Уведомления</DropdownMenuLabel>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => void markAllRead()}>
                <CheckCheck className="h-4 w-4" /> Прочитать все
              </Button>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Новых уведомлений нет
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openNotification(item)}
                className={`block w-full rounded-lg p-3 text-left text-sm hover:bg-muted ${item.read_at ? "opacity-60" : "bg-primary-soft/50"}`}
              >
                <div className="font-semibold">{item.title}</div>
                <div className="mt-1 text-muted-foreground">{item.body}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {formatTime(item.created_at)}
                </div>
              </button>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="flex flex-wrap gap-2 px-1 pt-1">
          {items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => void clearNotifications()}>
              <Trash2 className="h-4 w-4" /> Очистить уведомления
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              soundEnabledRef.current = next;
              window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
            }}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} Звук:{" "}
            {soundEnabled ? "вкл" : "выкл"}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
