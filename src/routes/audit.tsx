import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { SectionTitle, StatCard } from "@/components/app/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useAudit, useHydratedCases, visibleCases } from "@/lib/domain/store";
import { download, summarise, toCsv } from "@/lib/domain/metrics";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit & Compliance — Complaint Navigator" },
      {
        name: "description",
        content:
          "Searchable audit trail of every agent action, state transition and human override, plus PII redaction and SLA compliance metrics.",
      },
      { property: "og:title", content: "Audit & Compliance" },
      {
        property: "og:description",
        content: "Immutable audit trail with PII redaction, refusal and SLA compliance metrics.",
      },
    ],
  }),
  component: AuditPage,
});

const ALL = "all";

function AuditPage() {
  const { user } = useAuthGuard();
  const audit = useAudit();
  const { cases } = useHydratedCases();
  const [actor, setActor] = useState(ALL);
  const [action, setAction] = useState(ALL);
  const [caseQuery, setCaseQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const scoped = useMemo(() => visibleCases(cases, user), [cases, user]);
  const m = useMemo(() => summarise(scoped), [scoped]);
  const visibleIds = useMemo(() => new Set(scoped.map((c) => c.case_id)), [scoped]);

  const actors = useMemo(() => Array.from(new Set(audit.map((a) => a.actor))).sort(), [audit]);
  const actions = useMemo(() => Array.from(new Set(audit.map((a) => a.action))).sort(), [audit]);

  const rows = useMemo(
    () =>
      audit
        .filter((a) => !a.case_id || visibleIds.has(a.case_id))
        .filter((a) => actor === ALL || a.actor === actor)
        .filter((a) => action === ALL || a.action === action)
        .filter((a) => !caseQuery || (a.case_id ?? "").toLowerCase().includes(caseQuery.toLowerCase()))
        .filter((a) => !from || new Date(a.at) >= new Date(from))
        .filter((a) => !to || new Date(a.at) <= new Date(`${to}T23:59:59`))
        .slice()
        .reverse()
        .slice(0, 500),
    [audit, actor, action, caseQuery, from, to, visibleIds],
  );

  if (!user) return null;

  return (
    <AppShell user={user}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">Audit & compliance</h1>
            <p className="text-sm text-muted-foreground">
              Every state transition and human decision is logged with a redacted, PII-free payload.
            </p>
          </div>
          <Button
            onClick={() => {
              download(
                `audit-${Date.now()}.csv`,
                toCsv(
                  rows.map((r) => ({
                    timestamp: r.at,
                    actor: r.actor,
                    action: r.action,
                    case_id: r.case_id ?? "",
                    details: JSON.stringify(r.details),
                    ip: r.ip,
                  })),
                ),
              );
              toast.success(`Exported ${rows.length} audit rows`);
            }}
          >
            <Download className="size-4" /> Export to CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="PII detected & redacted" value={m.piiRedacted} tone="warning" />
          <StatCard label="Unsafe requests blocked" value={m.refusals} tone="danger" />
          <StatCard label="HITL overrides" value={m.overrides} tone="info" />
          <StatCard label="SLA breaches" value={m.breaches} tone="danger" />
        </div>

        <div className="panel grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">Case ID</Label>
            <Input value={caseQuery} onChange={(e) => setCaseQuery(e.target.value)} placeholder="UCN-DEMO-…" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">User / agent</Label>
            <Select value={actor} onValueChange={setActor}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {actors.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Action type</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {actions.map((a) => (<SelectItem key={a} value={a}>{a.replaceAll("_", " ")}</SelectItem>))}
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
        </div>

        <div className="panel overflow-hidden">
          <div className="p-4 pb-0"><SectionTitle title={`${rows.length} audit entries`} /></div>
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User / agent</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Case ID</th>
                  <th className="p-3">Details</th>
                  <th className="p-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="mono p-3 text-xs whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                    <td className="p-3 text-xs font-semibold">{r.actor}</td>
                    <td className="p-3 text-xs">{r.action.replaceAll("_", " ")}</td>
                    <td className="p-3">
                      {r.case_id ? (
                        <Link to="/cases/$caseId" params={{ caseId: r.case_id }} className="mono text-xs text-primary hover:underline">
                          {r.case_id}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="mono max-w-md truncate p-3 text-[11px] text-muted-foreground">
                      {JSON.stringify(r.details)}
                    </td>
                    <td className="mono p-3 text-xs text-muted-foreground">{r.ip}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">No audit entries match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
