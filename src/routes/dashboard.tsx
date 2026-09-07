import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Activity, Play, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { SimulationPanel } from "@/components/app/SimulationPanel";
import { IntakeForm } from "@/components/app/IntakeForm";
import { Chip, SectionTitle, StatCard, StatusChip } from "@/components/app/atoms";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuthGuard } from "@/lib/useAuthGuard";
import {
  getAudit,
  resetDemoData,
  useHydratedCases,
  visibleCases,
} from "@/lib/domain/store";
import { DEMO_CASES } from "@/lib/domain/seed";
import { evaluateCase, processCase, AGENT_LABEL, CHANNEL_LABEL } from "@/lib/domain/engine";
import { agentStats, byField, lastSevenDays, summarise } from "@/lib/domain/metrics";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard — Complaint Navigator" },
      {
        name: "description",
        content:
          "Live grievance analytics: case volumes, severity mix, HITL backlog, SLA compliance and four-agent performance.",
      },
      { property: "og:title", content: "Operations Dashboard — Complaint Navigator" },
      {
        property: "og:description",
        content: "Live grievance analytics across the four-agent AI complaint resolution workflow.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuthGuard();
  const { cases } = useHydratedCases();
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<
    { case_id: string; expected: string; actual: string; pass: boolean }[] | null
  >(null);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const scoped = useMemo(() => visibleCases(cases, user), [cases, user]);
  const m = useMemo(() => summarise(scoped), [scoped, tick]);
  const stats = useMemo(() => agentStats(scoped), [scoped]);
  const classData = useMemo(() => byField(scoped, (c) => c.classification), [scoped]);
  const sevData = useMemo(() => byField(scoped, (c) => c.severity), [scoped]);
  const chanData = useMemo(
    () => byField(scoped, (c) => CHANNEL_LABEL[c.source_channel] ?? null),
    [scoped],
  );
  const timeline = useMemo(() => lastSevenDays(scoped), [scoped]);
  const audit = useMemo(() => getAudit().slice(-20).reverse(), [tick, cases.length]);


  if (!user) return null;

  const runAllTests = async () => {
    setRunning(true);
    setResults(null);
    const rows: { case_id: string; expected: string; actual: string; pass: boolean }[] = [];
    for (let i = 0; i < DEMO_CASES.length; i++) {
      const rec = processCase(DEMO_CASES[i]!);
      const checks = evaluateCase(rec);
      rows.push({
        case_id: rec.case_id,
        expected: checks.map((c) => `${c.field}=${c.expected}`).join(", "),
        actual: checks.map((c) => `${c.field}=${c.actual}`).join(", "),
        pass: checks.every((c) => c.pass),
      });
      setProgress(Math.round(((i + 1) / DEMO_CASES.length) * 100));
      await new Promise((r) => setTimeout(r, 90));
    }
    setResults(rows);
    setRunning(false);
    const passed = rows.filter((r) => r.pass).length;
    toast[passed === rows.length ? "success" : "error"](
      `${passed}/${rows.length} cases passed`,
    );
  };

  const SEV_COLORS: Record<string, string> = {
    S1: "var(--s1)",
    S2: "var(--s2)",
    S3: "var(--s3)",
    S4: "var(--s4)",
    pending_human: "var(--muted-foreground)",
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">Operations dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {user.display_name} · {user.view_filter}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={runAllTests} disabled={running}>
              <Play className="size-4" /> Run all 12 test cases
            </Button>
            {user.role === "admin" && (
              <Button
                variant="outline"
                onClick={() => {
                  resetDemoData();
                  toast.success("Demo data reset");
                }}
              >
                <RotateCcw className="size-4" /> Reset data
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <SimulationPanel />
          <IntakeForm actor={user.display_name} />
        </div>




        {(running || results) && (
          <div className="panel p-4">
            <SectionTitle
              title="Test runner"
              action={
                results ? (
                  <Chip tone={results.every((r) => r.pass) ? "success" : "danger"}>
                    {results.filter((r) => r.pass).length}/{results.length} passed (
                    {Math.round((results.filter((r) => r.pass).length / results.length) * 100)}%)
                  </Chip>
                ) : null
              }
            />
            {running && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">
                  Processing case {Math.ceil((progress / 100) * DEMO_CASES.length)}/{DEMO_CASES.length}…
                </p>
              </div>
            )}
            {results && (
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-card text-muted-foreground">
                    <tr>
                      <th className="p-2">Case ID</th>
                      <th className="p-2">Expected</th>
                      <th className="p-2">Actual</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.case_id} className="border-t border-border">
                        <td className="mono p-2 font-semibold">{r.case_id}</td>
                        <td className="p-2 text-muted-foreground">{r.expected}</td>
                        <td className="p-2 text-muted-foreground">{r.actual}</td>
                        <td className="p-2">
                          <Chip tone={r.pass ? "success" : "danger"}>{r.pass ? "✅ Pass" : "❌ Fail"}</Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <StatCard
            label="Total cases"
            value={m.total}
            sub={`${m.trend >= 0 ? "▲" : "▼"} ${Math.abs(m.trend)} vs yesterday`}
          />
          <StatCard label="Today's cases" value={m.today} sub="Received today" tone="info" />
          <StatCard label="Complaints" value={m.complaints} sub="Classified as complaint" tone="danger" />
          <StatCard
            label="HITL pending"
            value={m.hitlPending}
            {...(m.hitlPending ? { badge: "Action" } : {})}
            tone="warning"
          />
          <StatCard label="S1 / S2 critical" value={m.critical} sub="High severity" tone="danger" />
          <StatCard label="Avg resolution" value={`${m.avgResolutionHours.toFixed(1)}h`} sub="Closed cases" />
          <StatCard label="Agent accuracy" value={`${m.accuracy.toFixed(0)}%`} sub="vs expected label" tone="success" />
          <StatCard label="SLA compliance" value={`${m.slaCompliance.toFixed(0)}%`} sub="Within deadline" tone="success" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel p-4">
            <SectionTitle title="Cases by classification" />
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={classData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis fontSize={12} stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="panel p-4">
            <SectionTitle title="Cases by severity" />
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={sevData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                  {sevData.map((d) => (
                    <Cell key={d.name} fill={SEV_COLORS[d.name] ?? "var(--chart-2)"} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="panel p-4">
            <SectionTitle title="Cases over time (7 days)" />
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis fontSize={12} stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }} />
                <Legend />
                <Line type="monotone" dataKey="cases" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="complaints" stroke="var(--chart-4)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="panel p-4">
            <SectionTitle title="Cases by channel" />
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={chanData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" fontSize={12} stroke="var(--muted-foreground)" allowDecimals={false} />
                <YAxis dataKey="name" type="category" fontSize={12} stroke="var(--muted-foreground)" width={70} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="var(--chart-2)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-4">
          <SectionTitle title="Agent performance (stacked workload)" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={stats.map((s) => ({
                name: s.label,
                today: s.today,
                earlier: Math.max(s.total - s.today, 0),
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" fontSize={12} stroke="var(--muted-foreground)" />
              <YAxis fontSize={12} stroke="var(--muted-foreground)" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }} />
              <Legend />
              <Bar dataKey="today" stackId="a" fill="var(--chart-3)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="earlier" stackId="a" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="panel overflow-hidden">
            <div className="p-4 pb-0">
              <SectionTitle title="Agent performance table" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">Agent</th>
                    <th className="p-3">Cases today</th>
                    <th className="p-3">Avg time</th>
                    <th className="p-3">Accuracy</th>
                    <th className="p-3">HITL rate</th>
                    <th className="p-3">Refusals</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.agent} className="border-t border-border">
                      <td className="p-3 font-semibold">{AGENT_LABEL[s.agent]}</td>
                      <td className="mono p-3">{s.today}</td>
                      <td className="mono p-3">{s.avgMinutes} min</td>
                      <td className="mono p-3">{s.accuracy}%</td>
                      <td className="mono p-3">{s.agent === "gho" ? "N/A" : `${s.hitlRate}%`}</td>
                      <td className="mono p-3">{s.refusals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel p-4">
            <SectionTitle
              title="Recent activity"
              action={<Chip tone="info"><Activity className="size-3" /> auto-refresh 5s</Chip>}
            />
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {audit.map((a) => (
                <div key={a.id} className="flex items-start gap-2 border-b border-border pb-2 text-xs last:border-0">
                  <span className="mono w-16 shrink-0 text-muted-foreground">
                    {new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.actor}</p>
                    <p className="truncate text-muted-foreground">{a.action.replaceAll("_", " ")}</p>
                  </div>
                  {a.case_id && (
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: a.case_id }}
                      className="mono shrink-0 text-[11px] text-primary hover:underline"
                    >
                      {a.case_id}
                    </Link>
                  )}
                </div>
              ))}
              {audit.length === 0 && <p className="text-xs text-muted-foreground">No activity yet.</p>}
            </div>
          </div>
        </div>

        <div className="panel p-4">
          <SectionTitle title="Latest HITL backlog" />
          <div className="flex flex-wrap gap-2">
            {scoped
              .filter((c) => c.status === "HITL_REQUIRED")
              .slice(0, 12)
              .map((c) => (
                <Link
                  key={c.case_id}
                  to="/cases/$caseId"
                  params={{ caseId: c.case_id }}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-xs transition-shadow hover:shadow-lift"
                >
                  <span className="mono font-semibold">{c.case_id}</span>{" "}
                  <StatusChip status={c.status} />
                </Link>
              ))}
            {scoped.filter((c) => c.status === "HITL_REQUIRED").length === 0 && (
              <p className="text-xs text-muted-foreground">Nothing waiting for human review.</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
