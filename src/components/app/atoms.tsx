import { cn } from "@/lib/utils";
import type { CaseRecord, Classification, Severity } from "@/lib/domain/types";

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "s1" | "s2" | "s3" | "s4" | "complaint" | "request" | "query" | "ambiguous" | "success" | "info" | "warning" | "danger";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-muted text-muted-foreground border-border",
    s1: "bg-s1/12 text-s1 border-s1/30",
    s2: "bg-s2/14 text-s2 border-s2/30",
    s3: "bg-s3/16 text-s3 border-s3/35",
    s4: "bg-s4/12 text-s4 border-s4/30",
    complaint: "bg-destructive/10 text-destructive border-destructive/25",
    request: "bg-info/10 text-info border-info/25",
    query: "bg-success/10 text-success border-success/25",
    ambiguous: "bg-warning/16 text-warning-foreground border-warning/40",
    success: "bg-success/10 text-success border-success/25",
    info: "bg-info/10 text-info border-info/25",
    warning: "bg-warning/16 text-warning-foreground border-warning/40",
    danger: "bg-destructive/10 text-destructive border-destructive/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SeverityChip({ severity }: { severity: Severity | null }) {
  if (!severity) return <Chip>—</Chip>;
  if (severity === "pending_human") return <Chip tone="warning">Pending human</Chip>;
  return <Chip tone={severity.toLowerCase() as "s1"}>{severity}</Chip>;
}

export function ClassificationChip({ value }: { value: Classification | null }) {
  if (!value) return <Chip>—</Chip>;
  return <Chip tone={value}>{value}</Chip>;
}

const STATUS_TONE: Record<string, "neutral" | "success" | "info" | "warning" | "danger"> = {
  CLOSED_DEMO: "success",
  EMAIL_READY: "info",
  HITL_REQUIRED: "danger",
  PRIVACY_REDACTION_HOLD: "warning",
  ERROR_SAFE_HOLD: "warning",
};

export function StatusChip({ status }: { status: string }) {
  return <Chip tone={STATUS_TONE[status] ?? "neutral"}>{status.replaceAll("_", " ")}</Chip>;
}

export function SlaMeter({ record }: { record: CaseRecord }) {
  if (!record.deadline) return <span className="text-xs text-muted-foreground">No deadline</span>;
  const due = new Date(record.deadline.date).getTime();
  const start = new Date(record.created_at).getTime();
  const now = Date.now();
  const total = Math.max(due - start, 1);
  const used = Math.min(Math.max(now - start, 0), total);
  const pct = (used / total) * 100;
  const hoursLeft = Math.round((due - now) / 3600000);
  const breached = hoursLeft <= 0;
  return (
    <div className="min-w-28">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            breached ? "bg-destructive" : pct > 75 ? "bg-s2" : "bg-success",
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn("mono text-[11px]", breached ? "text-destructive" : "text-muted-foreground")}>
        {breached ? `Breached ${Math.abs(hoursLeft)}h` : `${hoursLeft}h left`}
      </span>
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  badge,
}: {
  label: string;
  value: string | number;
  sub?: string | undefined;
  tone?: "neutral" | "danger" | "success" | "warning" | "info";
  badge?: string | undefined;
}) {
  const accent: Record<string, string> = {
    neutral: "before:bg-primary",
    danger: "before:bg-destructive",
    success: "before:bg-success",
    warning: "before:bg-warning",
    info: "before:bg-info",
  };
  return (
    <div
      className={cn(
        "panel rise-in relative overflow-hidden p-4",
        "before:absolute before:top-0 before:left-0 before:h-full before:w-1 before:content-['']",
        accent[tone],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
        {badge ? <Chip tone="danger">{badge}</Chip> : null}
      </div>
      <p className="mono mt-2 text-2xl font-bold text-foreground">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold tracking-wide text-foreground uppercase">{title}</h2>
      {action}
    </div>
  );
}
