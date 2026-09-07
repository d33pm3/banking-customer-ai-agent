import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { SectionTitle, StatCard } from "@/components/app/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useHydratedCases, visibleCases } from "@/lib/domain/store";
import { AGENT_LABEL, CHANNEL_LABEL } from "@/lib/domain/engine";
import { agentStats, byField, download, summarise, toCsv } from "@/lib/domain/metrics";
import type { AgentName } from "@/lib/domain/types";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Exports — Complaint Navigator" },
      {
        name: "description",
        content:
          "Build daily summary, weekly performance and monthly compliance reports for the AI grievance workflow, then export CSV or PDF.",
      },
      { property: "og:title", content: "Reports & Exports" },
      {
        property: "og:description",
        content: "Daily, weekly and monthly grievance reporting with CSV and PDF export.",
      },
    ],
  }),
  component: ReportsPage,
});

const REPORT_TYPES = [
  { value: "daily", label: "Daily Summary" },
  { value: "weekly", label: "Weekly Performance" },
  { value: "monthly", label: "Monthly Compliance" },
];

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultFrom(type: string) {
  const days = type === "daily" ? 1 : type === "monthly" ? 30 : 7;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return isoDay(d);
}

function ReportsPage() {
  const { user } = useAuthGuard();
  const { cases } = useHydratedCases();
  const [type, setType] = useState("weekly");
  const [from, setFrom] = useState(() => defaultFrom("weekly"));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [agents, setAgents] = useState<AgentName[]>(["branch_level", "email_contact", "digital_desk", "gho"]);
  const [generated, setGenerated] = useState(true);

  const onTypeChange = (v: string) => {
    setType(v);
    setFrom(defaultFrom(v));
    setTo(isoDay(new Date()));
  };


  const scoped = useMemo(() => visibleCases(cases, user), [cases, user]);

  const filtered = useMemo(
    () =>
      scoped
        .filter((c) => !from || new Date(c.created_at) >= new Date(from))
        .filter((c) => !to || new Date(c.created_at) <= new Date(`${to}T23:59:59`))
        .filter((c) => c.agent_outputs.some((o) => agents.includes(o.agent))),
    [scoped, from, to, agents],
  );

  const m = useMemo(() => summarise(filtered), [filtered]);
  const stats = useMemo(() => agentStats(filtered), [filtered]);
  const chan = useMemo(() => byField(filtered, (c) => CHANNEL_LABEL[c.source_channel] ?? null), [filtered]);

  if (!user) return null;

  return (
    <AppShell user={user}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Build a formatted report over any date range and export it for review committees.
          </p>
        </div>

        <div className="panel grid gap-3 p-4 md:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Report type</Label>
            <Select value={type} onValueChange={onTypeChange}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Agents included</Label>
            <div className="flex flex-wrap gap-3 pt-2">
              {(Object.keys(AGENT_LABEL) as AgentName[]).map((a) => (
                <label key={a} className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={agents.includes(a)}
                    onCheckedChange={(v) =>
                      setAgents((prev) => (v ? [...prev, a] : prev.filter((x) => x !== a)))
                    }
                  />
                  {AGENT_LABEL[a]}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-4 flex flex-wrap gap-2">
            <Button onClick={() => { setGenerated(true); toast.success("Report generated"); }}>
              <FileText className="size-4" /> Generate
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                download(
                  `report-${type}-${Date.now()}.csv`,
                  toCsv(
                    filtered.map((c) => ({
                      case_id: c.case_id,
                      channel: CHANNEL_LABEL[c.source_channel],
                      classification: c.classification,
                      severity: c.severity,
                      status: c.status,
                      created_at: c.created_at,
                      hitl: c.hitl_required,
                    })),
                  ),
                );
                toast.success("CSV downloaded");
              }}
            >
              <Download className="size-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" /> Download PDF
            </Button>
          </div>
        </div>

        {generated && (
          <div className="space-y-4">
            <div className="panel p-4">
              <SectionTitle title={`${REPORT_TYPES.find((r) => r.value === type)?.label} · ${filtered.length} cases`} />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="Complaints" value={m.complaints} tone="danger" />
                <StatCard label="HITL pending" value={m.hitlPending} tone="warning" />
                <StatCard label="SLA compliance" value={`${m.slaCompliance.toFixed(0)}%`} tone="success" />
                <StatCard label="Refusals" value={m.refusals} tone="info" />
              </div>
            </div>

            <div className="panel p-4">
              <SectionTitle title="Volume by channel" />
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chan}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} stroke="var(--muted-foreground)" />
                  <YAxis fontSize={12} stroke="var(--muted-foreground)" allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--chart-1)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="panel overflow-hidden">
              <div className="p-4 pb-0"><SectionTitle title="Agent breakdown" /></div>
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">Agent</th>
                    <th className="p-3">Cases</th>
                    <th className="p-3">Avg time</th>
                    <th className="p-3">Accuracy</th>
                    <th className="p-3">HITL rate</th>
                    <th className="p-3">Refusals</th>
                  </tr>
                </thead>
                <tbody>
                  {stats
                    .filter((s) => agents.includes(s.agent))
                    .map((s) => (
                      <tr key={s.agent} className="border-t border-border">
                        <td className="p-3 font-semibold">{s.label}</td>
                        <td className="mono p-3">{s.total}</td>
                        <td className="mono p-3">{s.avgMinutes} min</td>
                        <td className="mono p-3">{s.accuracy}%</td>
                        <td className="mono p-3">{s.hitlRate}%</td>
                        <td className="mono p-3">{s.refusals}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
