import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Radio, Route as RouteIcon, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Chip, SeverityChip, StatusChip } from "@/components/app/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AGENT_ICON, AGENT_LABEL, CHANNEL_LABEL } from "@/lib/domain/engine";
import { assignCase, useHydratedCases, visibleCases } from "@/lib/domain/store";
import { enqueueRealCase, injectCaseNow, useSimulation } from "@/lib/domain/simulation";
import { useAuthGuard } from "@/lib/useAuthGuard";
import type { AgentName, CaseRecord } from "@/lib/domain/types";

export const Route = createFileRoute("/routing")({
  head: () => ({
    meta: [
      { title: "Case Routing Desk — Complaint Navigator" },
      { name: "description", content: "Manually assign complaints to the branch, contact centre, digital desk or grievance officer and watch dashboard metrics update live." },
      { property: "og:title", content: "Case Routing Desk" },
      { property: "og:description", content: "Manual case assignment with live pipeline updates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoutingPage,
});

const AGENTS: AgentName[] = ["branch_level", "email_contact", "digital_desk", "gho"];

function RoutingPage() {
  const { user, ready } = useAuthGuard();
  const { cases } = useHydratedCases();
  const sim = useSimulation();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<AgentName>("gho");
  const [note, setNote] = useState("");

  const mine = useMemo(() => visibleCases(cases, user), [cases, user]);
  const open = useMemo(
    () =>
      mine
        .filter((c) => c.status !== "CLOSED_DEMO")
        .filter((c) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return (
            c.case_id.toLowerCase().includes(q) ||
            c.narrative.toLowerCase().includes(q) ||
            c.product.toLowerCase().includes(q)
          );
        })
        .slice(0, 60),
    [mine, query],
  );

  const workload = useMemo(() => {
    const map = new Map<AgentName, CaseRecord[]>(AGENTS.map((a) => [a, []]));
    for (const c of mine) {
      if (c.status === "CLOSED_DEMO") continue;
      if (c.assigned_agent) map.get(c.assigned_agent)?.push(c);
    }
    return map;
  }, [mine]);

  if (!ready || !user) return null;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const doAssign = () => {
    if (!selected.length) {
      toast.error("Select at least one case to route");
      return;
    }
    selected.forEach((id) => assignCase(id, target, user.user_id, note.trim()));
    toast.success(`Routed ${selected.length} case(s) to ${AGENT_LABEL[target]}`);
    setSelected([]);
    setNote("");
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <RouteIcon className="size-5 text-primary" /> Routing desk
            </h1>
            <p className="text-sm text-muted-foreground">
              Assign open cases to an agent. Every assignment is traced, audited and reflected on the dashboard immediately.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone={sim.running ? "danger" : "neutral"}>
              <Radio className={sim.running ? "size-3 animate-pulse" : "size-3"} /> Simulation {sim.running ? "live" : "idle"}
            </Chip>
            <Button variant="outline" size="sm" onClick={() => { injectCaseNow(); toast.success("Real case injected into the live queue"); }}>
              <Send className="size-4" /> Inject next real case
            </Button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          {AGENTS.map((a) => {
            const list = workload.get(a) ?? [];
            const inFlight = sim.inFlight.filter((f) => f.agent === a).length;
            return (
              <div key={a} className="panel p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {AGENT_ICON[a]} {AGENT_LABEL[a]}
                  </span>
                  {inFlight > 0 && <Chip tone="warning">{inFlight} live</Chip>}
                </div>
                <p className="mt-2 font-mono text-2xl font-bold">{list.length}</p>
                <p className="text-xs text-muted-foreground">open cases assigned</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Open cases ({open.length})</h2>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search case id, product or text"
                className="h-9 w-64"
              />
            </div>
            <div className="mt-3 max-h-[520px] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-10 p-2"></th>
                    <th className="p-2">Case</th>
                    <th className="p-2">Channel</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Severity</th>
                    <th className="p-2">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {open.map((c) => (
                    <tr key={c.case_id} className="border-t hover:bg-muted/40">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.case_id}`}
                          checked={selected.includes(c.case_id)}
                          onChange={() => toggle(c.case_id)}
                        />
                      </td>
                      <td className="p-2">
                        <Link to="/cases/$caseId" params={{ caseId: c.case_id }} className="font-mono text-xs font-semibold hover:underline">
                          {c.case_id}
                        </Link>
                        <p className="max-w-[26rem] truncate text-xs text-muted-foreground">{c.narrative}</p>
                      </td>
                      <td className="p-2 text-xs">{CHANNEL_LABEL[c.source_channel] ?? c.source_channel}</td>
                      <td className="p-2"><StatusChip status={c.status} /></td>
                      <td className="p-2">{c.severity ? <SeverityChip severity={c.severity} /> : "—"}</td>
                      <td className="p-2 text-xs">
                        {c.assigned_agent ? AGENT_LABEL[c.assigned_agent] : <span className="text-muted-foreground">Unassigned</span>}
                      </td>
                    </tr>
                  ))}
                  {!open.length && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">No open cases match.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel p-4">
              <h2 className="text-sm font-bold">Assign selection</h2>
              <p className="mt-1 text-xs text-muted-foreground">{selected.length} case(s) selected</p>
              <div className="mt-3 space-y-3">
                <Select value={target} onValueChange={(v) => setTarget(v as AgentName)}>
                  <SelectTrigger aria-label="Target agent"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGENTS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {AGENT_ICON[a]} {AGENT_LABEL[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Routing note (recorded in the audit trail)"
                  rows={3}
                />
                <Button className="w-full" onClick={doAssign}>
                  <ArrowRight className="size-4" /> Route to {AGENT_LABEL[target]}
                </Button>
              </div>
            </div>

            <div className="panel p-4">
              <h2 className="text-sm font-bold">Queue a real case for live arrival</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick one of the 12 prototype cases; it arrives on the dashboard and flows through the agents.
              </p>
              <div className="mt-3 max-h-56 space-y-1 overflow-auto">
                {cases
                  .filter((c) => c.case_id.startsWith("UCN-DEMO-0"))
                  .slice(0, 12)
                  .map((c) => (
                    <button
                      key={c.case_id}
                      className="flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs hover:bg-muted"
                      onClick={() => {
                        enqueueRealCase(c.case_id);
                        injectCaseNow(c.case_id);
                        toast.success(`${c.case_id} sent to the live pipeline`);
                      }}
                    >
                      <span className="font-mono">{c.case_id}</span>
                      <span className="truncate text-muted-foreground">{c.product}</span>
                    </button>
                  ))}
              </div>
            </div>

            <div className="panel p-4">
              <h2 className="text-sm font-bold">In-flight now</h2>
              <div className="mt-2 space-y-1 text-xs">
                {sim.inFlight.length === 0 && <p className="text-muted-foreground">Nothing in flight.</p>}
                {sim.inFlight.map((f) => (
                  <div key={f.case_id} className="flex items-center justify-between gap-2">
                    <span className="font-mono">{f.case_id}</span>
                    <span className="text-muted-foreground">
                      {AGENT_LABEL[f.agent as AgentName] ?? f.agent} · {f.step}/{f.total}
                      {f.source_case_id ? ` · ${f.source_case_id}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
