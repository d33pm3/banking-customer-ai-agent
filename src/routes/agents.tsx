import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Chip, SectionTitle, SeverityChip, StatusChip } from "@/components/app/atoms";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useHydratedCases, visibleCases } from "@/lib/domain/store";
import { AGENT_ICON, AGENT_LABEL } from "@/lib/domain/engine";
import { agentStats } from "@/lib/domain/metrics";
import { cn } from "@/lib/utils";
import type { AgentName } from "@/lib/domain/types";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "Agent Workflow & Performance — Complaint Navigator" },
      {
        name: "description",
        content:
          "Visualise how cases flow through Branch, Contact Centre, Digital Desk and GHO agents, with speed, accuracy and workload leaderboards.",
      },
      { property: "og:title", content: "Agent Workflow & Performance" },
      {
        property: "og:description",
        content: "Four-agent flow diagram, queues and leaderboards for speed, accuracy and workload.",
      },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const { user } = useAuthGuard();
  const { cases } = useHydratedCases();
  const [focus, setFocus] = useState<AgentName | null>(null);

  const scoped = useMemo(() => visibleCases(cases, user), [cases, user]);
  const stats = useMemo(() => agentStats(scoped), [scoped]);

  if (!user) return null;

  const queueFor = (agent: AgentName) =>
    scoped.filter(
      (c) =>
        c.agent_outputs.some((o) => o.agent === agent) &&
        ["HITL_REQUIRED", "QA_REVIEW", "INVESTIGATING", "EMAIL_READY"].includes(c.status),
    );

  return (
    <AppShell user={user}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold">Agent workflow</h1>
          <p className="text-sm text-muted-foreground">
            Deterministic pipeline: intake agent by channel → GHO investigation → human review → closure.
          </p>
        </div>

        <div className="panel overflow-x-auto p-5">
          <div className="flex min-w-[880px] items-stretch gap-3">
            <FlowNode title="New case" subtitle="Intake queue" count={scoped.length} tone="neutral" />
            <Arrow />
            <div className="grid flex-1 gap-3">
              {(["branch_level", "email_contact", "digital_desk"] as AgentName[]).map((a) => {
                const s = stats.find((x) => x.agent === a)!;
                return (
                  <button
                    key={a}
                    onClick={() => setFocus(focus === a ? null : a)}
                    className={cn(
                      "rounded-xl border border-border bg-card p-3 text-left transition-shadow hover:shadow-lift",
                      focus === a && "ring-2 ring-ring",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{AGENT_ICON[a]}</span>
                      <span className="text-sm font-bold">{AGENT_LABEL[a]}</span>
                      <span
                        className={cn(
                          "ml-auto size-2.5 rounded-full",
                          queueFor(a).length > 8 ? "bg-destructive" : "bg-success",
                        )}
                      />
                    </div>
                    <p className="mono mt-1 text-xs text-muted-foreground">
                      {queueFor(a).length} in progress · {s.avgMinutes} min avg
                    </p>
                  </button>
                );
              })}
            </div>
            <Arrow />
            <FlowNode
              title="GHO"
              subtitle="Investigation & redress"
              count={scoped.filter((c) => c.assigned_agent === "gho").length}
              tone="info"
              onClick={() => setFocus(focus === "gho" ? null : "gho")}
            />
            <Arrow />
            <FlowNode
              title="HITL"
              subtitle="Human review"
              count={scoped.filter((c) => c.status === "HITL_REQUIRED").length}
              tone="danger"
            />
            <Arrow />
            <FlowNode
              title="Closed"
              subtitle="Reply drafted"
              count={scoped.filter((c) => c.status === "CLOSED_DEMO").length}
              tone="success"
            />
          </div>
        </div>

        {focus && (
          <div className="panel p-4">
            <SectionTitle
              title={`${AGENT_LABEL[focus]} queue & recent decisions`}
              action={<Chip tone="info">{queueFor(focus).length} active</Chip>}
            />
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {scoped
                .filter((c) => c.agent_outputs.some((o) => o.agent === focus))
                .slice(0, 12)
                .map((c) => (
                  <Link
                    key={c.case_id}
                    to="/cases/$caseId"
                    params={{ caseId: c.case_id }}
                    className="rounded-lg border border-border bg-surface p-3 transition-shadow hover:shadow-lift"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="mono text-xs font-bold">{c.case_id}</span>
                      <SeverityChip severity={c.severity} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.narrative}</p>
                    <div className="mt-2"><StatusChip status={c.status} /></div>
                  </Link>
                ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.agent} className="panel rise-in p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{AGENT_ICON[s.agent]}</span>
                <div>
                  <p className="text-sm font-extrabold">{s.label} Agent</p>
                  <p className="text-[11px] text-muted-foreground">Peak hour {s.peakHour}</p>
                </div>
              </div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <KV k="Cases processed" v={`${s.total} total, ${s.today} today`} />
                <KV k="Avg processing" v={`${s.avgMinutes} minutes`} />
                <KV k="Accuracy" v={`${s.accuracy}%`} />
                <KV k="HITL escalation" v={s.agent === "gho" ? "N/A (sends to HITL)" : `${s.hitlRate}%`} />
                <KV k="Refusals" v={String(s.refusals)} />
                <KV k="Top product" v={`${s.topProduct} (${s.topProductPct}%)`} />
              </dl>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Leaderboard
            title="Speed leaderboard"
            rows={[...stats].sort((a, b) => a.avgMinutes - b.avgMinutes).map((s) => ({ label: s.label, value: `${s.avgMinutes} min avg` }))}
          />
          <Leaderboard
            title="Accuracy leaderboard"
            rows={[...stats].sort((a, b) => b.accuracy - a.accuracy).map((s) => ({ label: s.label, value: `${s.accuracy}%` }))}
          />
          <Leaderboard
            title="Workload leaderboard"
            rows={[...stats].sort((a, b) => b.total - a.total).map((s) => ({ label: s.label, value: `${s.total} cases` }))}
          />
        </div>
      </div>
    </AppShell>
  );
}

function FlowNode({
  title,
  subtitle,
  count,
  tone,
  onClick,
}: {
  title: string;
  subtitle: string;
  count: number;
  tone: "neutral" | "info" | "danger" | "success";
  onClick?: () => void;
}) {
  const tones = {
    neutral: "border-border",
    info: "border-info/50",
    danger: "border-destructive/50",
    success: "border-success/50",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-40 shrink-0 rounded-xl border-2 bg-card p-3 text-left transition-shadow hover:shadow-lift",
        tones[tone],
      )}
    >
      <p className="text-sm font-bold">{title}</p>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      <p className="mono mt-2 text-xl font-extrabold">{count}</p>
    </button>
  );
}

function Arrow() {
  return (
    <svg width="42" height="60" viewBox="0 0 42 60" className="shrink-0 self-center" aria-hidden>
      <line x1="2" y1="30" x2="34" y2="30" className="flow-line" stroke="var(--primary)" strokeWidth="2" />
      <polygon points="34,24 42,30 34,36" fill="var(--primary)" />
    </svg>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border pb-1 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

function Leaderboard({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="panel p-4">
      <SectionTitle title={title} />
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-center gap-2 text-sm">
            <span className="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              {i + 1}
            </span>
            <span className="font-semibold">{r.label}</span>
            <span className="mono ml-auto text-xs text-muted-foreground">{r.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
