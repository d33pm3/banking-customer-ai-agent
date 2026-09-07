import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, Filter, Route as RouteIcon, Star, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import {
  Chip,
  ClassificationChip,
  SeverityChip,
  SlaMeter,
  StatusChip,
} from "@/components/app/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { assignCase, updateCase, useHydratedCases, visibleCases } from "@/lib/domain/store";
import { AGENT_LABEL, ALL_STATUSES, CHANNEL_ICON, CHANNEL_LABEL } from "@/lib/domain/engine";
import { download, toCsv } from "@/lib/domain/metrics";
import type { AgentName, CaseRecord } from "@/lib/domain/types";

interface CaseSearch {
  q?: string;
  status?: string;
  severity?: string;
  sla?: string;
}

export const Route = createFileRoute("/cases/")({
  validateSearch: (s: Record<string, unknown>): CaseSearch => ({
    ...(typeof s["q"] === "string" ? { q: s["q"] as string } : {}),
    ...(typeof s["status"] === "string" ? { status: s["status"] as string } : {}),
    ...(typeof s["severity"] === "string" ? { severity: s["severity"] as string } : {}),
    ...(typeof s["sla"] === "string" ? { sla: s["sla"] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Case Queue — Complaint Navigator" },
      {
        name: "description",
        content:
          "Filter, search and triage banking grievance cases by channel, classification, severity, status and SLA deadline.",
      },
      { property: "og:title", content: "Case Queue — Complaint Navigator" },
      {
        property: "og:description",
        content: "Filter and triage banking grievance cases across channels, severities and SLA deadlines.",
      },
    ],
  }),
  component: CasesPage,
});

const ALL = "all";

function CasesPage() {
  const { user } = useAuthGuard();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { cases } = useHydratedCases();

  const [channel, setChannel] = useState(ALL);
  const [classification, setClassification] = useState(ALL);
  const [severity, setSeverity] = useState(search.severity ?? ALL);
  const [status, setStatus] = useState(search.status ?? ALL);
  const [agent, setAgent] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState(search.q ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(true);

  const scoped = useMemo(() => visibleCases(cases, user), [cases, user]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scoped.filter((c) => {
      if (channel !== ALL && c.source_channel !== channel) return false;
      if (classification !== ALL && c.classification !== classification) return false;
      if (severity !== ALL && c.severity !== severity) return false;
      if (status !== ALL && c.status !== status) return false;
      if (agent !== ALL && c.assigned_agent !== agent) return false;
      if (search.sla === "breached" && !(c.deadline && new Date(c.deadline.date).getTime() < Date.now()))
        return false;
      if (from && new Date(c.created_at) < new Date(from)) return false;
      if (to && new Date(c.created_at) > new Date(`${to}T23:59:59`)) return false;
      if (
        term &&
        !(
          c.case_id.toLowerCase().includes(term) ||
          c.narrative.toLowerCase().includes(term) ||
          c.customer_token.toLowerCase().includes(term) ||
          c.product.toLowerCase().includes(term)
        )
      )
        return false;
      return true;
    });
  }, [scoped, channel, classification, severity, status, agent, from, to, q, search.sla]);

  if (!user) return null;

  const clearFilters = () => {
    setChannel(ALL);
    setClassification(ALL);
    setSeverity(ALL);
    setStatus(ALL);
    setAgent(ALL);
    setFrom("");
    setTo("");
    setQ("");
    navigate({ to: "/cases", search: {} });
  };

  const exportRows = (rows: CaseRecord[]) => {
    download(
      `cases-${Date.now()}.csv`,
      toCsv(
        rows.map((c) => ({
          case_id: c.case_id,
          channel: CHANNEL_LABEL[c.source_channel],
          product: c.product,
          classification: c.classification,
          severity: c.severity,
          status: c.status,
          assigned_agent: c.assigned_agent,
          created_at: c.created_at,
          deadline: c.deadline?.date ?? "",
          hitl_required: c.hitl_required,
          refusal_reason: c.refusal_reason ?? "",
        })),
      ),
    );
    toast.success(`Exported ${rows.length} cases`);
  };

  const bulkStatus = (next: string) => {
    selected.forEach((id) => updateCase(id, { status: next as CaseRecord["status"] }));
    toast.success(`Updated ${selected.length} cases to ${next}`);
    setSelected([]);
  };

  return (
    <AppShell user={user}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">Cases</h1>
            <p className="text-sm text-muted-foreground">
              {filtered.length} of {scoped.length} visible cases · {user.view_filter}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowFilters((s) => !s)}>
              <Filter className="size-4" /> {showFilters ? "Hide" : "Show"} filters
            </Button>
            <Button variant="outline" asChild>
              <Link to="/routing"><RouteIcon className="size-4" /> Routing desk</Link>
            </Button>
            <Button onClick={() => exportRows(filtered)}>
              <Download className="size-4" /> Export CSV
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="panel grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Search</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Case ID or keywords" />
            </div>
            <FilterSelect label="Channel" value={channel} onChange={setChannel} options={Object.keys(CHANNEL_LABEL).map((k) => ({ value: k, label: CHANNEL_LABEL[k] ?? k }))} />
            <FilterSelect label="Classification" value={classification} onChange={setClassification} options={["complaint", "request", "query", "ambiguous"].map((v) => ({ value: v, label: v }))} />
            <FilterSelect label="Severity" value={severity} onChange={setSeverity} options={["S1", "S2", "S3", "S4", "pending_human"].map((v) => ({ value: v, label: v }))} />
            <FilterSelect label="Status" value={status} onChange={setStatus} options={ALL_STATUSES.map((v) => ({ value: v, label: v.replaceAll("_", " ") }))} />
            <FilterSelect label="Assigned agent" value={agent} onChange={setAgent} options={Object.entries(AGENT_LABEL).map(([value, label]) => ({ value, label }))} />
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" onClick={clearFilters}>
                <X className="size-4" /> Clear filters
              </Button>
            </div>
          </div>
        )}

        {selected.length > 0 && (
          <div className="panel flex flex-wrap items-center gap-3 p-3">
            <Chip tone="info">{selected.length} selected</Chip>
            <Button size="sm" variant="outline" onClick={() => exportRows(filtered.filter((c) => selected.includes(c.case_id)))}>
              Export selected
            </Button>
            <Select onValueChange={(v) => { selected.forEach((id) => assignCase(id, v as AgentName, user.user_id, "Bulk routed from case list")); toast.success("Routed to " + (AGENT_LABEL[v as AgentName] ?? v)); setSelected([]); }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Assign to agent" /></SelectTrigger>
              <SelectContent>
                {Object.entries(AGENT_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={bulkStatus}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Update status" /></SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s.replaceAll("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear selection</Button>
          </div>
        )}

        <div className="panel overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-surface text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">
                    <Checkbox
                      checked={selected.length > 0 && selected.length === filtered.length}
                      onCheckedChange={(v) => setSelected(v ? filtered.map((c) => c.case_id) : [])}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3">Case ID</th>
                  <th className="p-3">Channel</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Classification</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Agent</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">SLA</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.case_id} className="border-t border-border hover:bg-surface/60">
                    <td className="p-3">
                      <Checkbox
                        checked={selected.includes(c.case_id)}
                        onCheckedChange={(v) =>
                          setSelected((prev) => (v ? [...prev, c.case_id] : prev.filter((id) => id !== c.case_id)))
                        }
                        aria-label={`Select ${c.case_id}`}
                      />
                    </td>
                    <td className="p-3">
                      <Link
                        to="/cases/$caseId"
                        params={{ caseId: c.case_id }}
                        className="mono font-semibold text-primary hover:underline"
                      >
                        {c.case_id}
                      </Link>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {CHANNEL_ICON[c.source_channel]} {CHANNEL_LABEL[c.source_channel]}
                    </td>
                    <td className="p-3 capitalize">{c.product.replaceAll("_", " ")}</td>
                    <td className="p-3"><ClassificationChip value={c.classification} /></td>
                    <td className="p-3"><SeverityChip severity={c.severity} /></td>
                    <td className="p-3"><StatusChip status={c.status} /></td>
                    <td className="p-3 text-xs whitespace-nowrap">{c.assigned_agent ? AGENT_LABEL[c.assigned_agent] : "—"}</td>
                    <td className="mono p-3 text-xs whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString()}{" "}
                      {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-3"><SlaMeter record={c} /></td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/cases/$caseId" params={{ caseId: c.case_id }}>View</Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Bookmark case"
                          onClick={() => updateCase(c.case_id, { starred: !c.starred })}
                        >
                          <Star className={c.starred ? "size-4 fill-accent text-accent" : "size-4"} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-10 text-center text-sm text-muted-foreground">
                      No cases match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
