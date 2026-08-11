import { useState } from "react";
import { Activity, X, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useDiagnostics, clearDiag, type DiagEntry } from "@/lib/admin-diagnostics";

function StatusDot({ entry }: { entry: DiagEntry }) {
  const color = entry.status === "ok" ? "bg-emerald-500" : "bg-rose-500";
  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}

export function AdminDiagnosticsPanel() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const entries = useDiagnostics();
  const errors = entries.filter((e) => e.status === "error").length;
  const avg = entries.length
    ? Math.round(entries.reduce((a, e) => a + e.durationMs, 0) / entries.length)
    : 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Диагностика (Ctrl+Shift+D)"
        className="fixed bottom-4 right-4 z-50 h-10 w-10 rounded-full bg-card border border-border shadow-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <Activity className="h-4 w-4" />
        {errors > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {errors}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(480px,calc(100vw-2rem))] rounded-2xl border border-border bg-card shadow-2xl text-sm overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2 font-semibold">
          <Activity className="h-4 w-4 text-primary" />
          Диагностика
          <span className="text-xs font-normal text-muted-foreground">
            {entries.length} • ошибок: {errors} • avg {avg}ms
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="p-1 rounded hover:bg-muted"
            title="Свернуть"
          >
            {collapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          <button onClick={clearDiag} className="p-1 rounded hover:bg-muted" title="Очистить">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-muted"
            title="Закрыть"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
      {!collapsed && (
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-border">
          {entries.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-xs">Запросов пока нет</div>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="px-4 py-2 hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <StatusDot entry={e} />
                  <span className="font-mono text-xs flex-1 truncate">{e.label}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {e.durationMs}ms
                  </span>
                  {e.attempts > 1 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-semibold">
                      ×{e.attempts}
                    </span>
                  )}
                </div>
                {e.error && (
                  <div className="mt-1 text-[11px] text-rose-500 font-mono truncate">
                    {e.code ? `[${e.code}] ` : ""}
                    {e.error}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
