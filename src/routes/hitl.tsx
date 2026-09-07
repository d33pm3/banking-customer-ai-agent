import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Chip, SectionTitle, SeverityChip, SlaMeter, StatCard } from "@/components/app/atoms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { applyHitlDecision, useHydratedCases, visibleCases } from "@/lib/domain/store";
import { AGENT_LABEL } from "@/lib/domain/engine";
import { redactText } from "@/lib/domain/agents";
import type { CaseRecord } from "@/lib/domain/types";

export const Route = createFileRoute("/hitl")({
  head: () => ({
    meta: [
      { title: "HITL Review Queue — Complaint Navigator" },
      {
        name: "description",
        content:
          "Human-in-the-loop queue: review agent recommendations, evidence and citations, then approve or override with a mandatory comment.",
      },
      { property: "og:title", content: "HITL Review Queue" },
      {
        property: "og:description",
        content: "Approve or override AI grievance decisions with full evidence and audit logging.",
      },
    ],
  }),
  component: HitlPage,
});

const ALTERNATIVES = [
  "uphold_complaint",
  "partially_uphold",
  "reject_complaint",
  "reclassify_as_query",
  "escalate_to_internal_ombudsman",
  "request_more_evidence",
];

function HitlPage() {
  const { user } = useAuthGuard();
  const { cases } = useHydratedCases();
  const [active, setActive] = useState<CaseRecord | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [alternative, setAlternative] = useState(ALTERNATIVES[0]!);
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  const scoped = useMemo(() => visibleCases(cases, user), [cases, user]);
  const queue = useMemo(() => scoped.filter((c) => c.status === "HITL_REQUIRED"), [scoped]);
  const reviewed = useMemo(() => scoped.filter((c) => c.hitl_decision), [scoped]);

  if (!user) return null;
  const canDecide = user.role === "hitl" || user.role === "admin";

  const approve = (c: CaseRecord) => {
    applyHitlDecision(c.case_id, {
      decision: "approved",
      reviewer: user.user_id,
      comment: "Approved as drafted after human review.",
      at: new Date().toISOString(),
    });
    toast.success(`${c.case_id} approved and closed`);
    setActive(null);
  };

  const submitOverride = () => {
    if (!active || comment.trim().length < 5) {
      toast.error("A comment explaining the override is mandatory.");
      return;
    }
    applyHitlDecision(active.case_id, {
      decision: "overridden",
      reviewer: user.user_id,
      comment: comment.trim(),
      alternative,
      at: new Date().toISOString(),
    });
    toast.success(`${active.case_id} overridden → ${alternative}`);
    setOverrideOpen(false);
    setComment("");
    setActive(null);
  };

  return (
    <AppShell user={user}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold">HITL review queue</h1>
          <p className="text-sm text-muted-foreground">
            Adverse, high-risk, ambiguous and refused cases require a human decision (KB-HITL-001).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Pending review" value={queue.length} tone="danger" {...(queue.length ? { badge: "Action" } : {})} />
          <StatCard label="Reviewed" value={reviewed.length} tone="success" />
          <StatCard
            label="Overrides"
            value={reviewed.filter((c) => c.hitl_decision?.decision === "overridden").length}
            tone="warning"
          />
          <StatCard
            label="S1 in queue"
            value={queue.filter((c) => c.severity === "S1").length}
            tone="danger"
          />
        </div>

        {selected.length > 0 && canDecide && (
          <div className="panel flex flex-wrap items-center gap-3 p-3">
            <Chip tone="info">{selected.length} selected</Chip>
            <Button size="sm" onClick={() => setBulkOpen(true)}>Approve all selected</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
          </div>
        )}

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">
                    <Checkbox
                      checked={selected.length > 0 && selected.length === queue.length}
                      onCheckedChange={(v) => setSelected(v ? queue.map((c) => c.case_id) : [])}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3">Case ID</th>
                  <th className="p-3">Summary</th>
                  <th className="p-3">Recommendation</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Deadline</th>
                  <th className="p-3">Time in queue</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((c) => {
                  const last = c.agent_outputs[c.agent_outputs.length - 1];
                  const hours = Math.round((Date.now() - new Date(c.updated_at).getTime()) / 3600000);
                  return (
                    <tr key={c.case_id} className="border-t border-border">
                      <td className="p-3">
                        <Checkbox
                          checked={selected.includes(c.case_id)}
                          onCheckedChange={(v) =>
                            setSelected((p) => (v ? [...p, c.case_id] : p.filter((x) => x !== c.case_id)))
                          }
                          aria-label={`Select ${c.case_id}`}
                        />
                      </td>
                      <td className="p-3">
                        <Link to="/cases/$caseId" params={{ caseId: c.case_id }} className="mono font-semibold text-primary hover:underline">
                          {c.case_id}
                        </Link>
                      </td>
                      <td className="max-w-64 truncate p-3 text-muted-foreground">{redactText(c.narrative).slice(0, 50)}…</td>
                      <td className="p-3 text-xs">{last?.recommendation ?? "—"}</td>
                      <td className="p-3"><SeverityChip severity={c.severity} /></td>
                      <td className="p-3"><SlaMeter record={c} /></td>
                      <td className="mono p-3 text-xs">{hours}h</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setActive(c)}>View</Button>
                          {canDecide && (
                            <>
                              <Button size="sm" onClick={() => approve(c)}>Approve</Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setActive(c);
                                  setOverrideOpen(true);
                                }}
                              >
                                Override
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {queue.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-sm text-muted-foreground">
                      Queue is clear — no cases awaiting human review.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {reviewed.length > 0 && (
          <div className="panel p-4">
            <SectionTitle title="Recently reviewed" />
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {reviewed.slice(0, 9).map((c) => (
                <div key={c.case_id} className="rounded-lg border border-border bg-surface p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="mono font-bold">{c.case_id}</span>
                    <Chip tone={c.hitl_decision!.decision === "approved" ? "success" : "warning"}>
                      {c.hitl_decision!.decision}
                    </Chip>
                  </div>
                  <p className="mt-1 text-muted-foreground">{c.hitl_decision!.comment}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">by {c.hitl_decision!.reviewer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Review modal */}
      <Dialog open={Boolean(active) && !overrideOpen} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="mono">{active.case_id}</DialogTitle>
                <DialogDescription>
                  {AGENT_LABEL[active.assigned_agent ?? "gho"]} recommendation pending human decision.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="rounded-lg bg-surface p-3">{redactText(active.narrative)}</p>
                {active.agent_outputs.map((o) => (
                  <div key={o.agent} className="rounded-lg border border-border p-3 text-xs">
                    <p className="font-bold">{AGENT_LABEL[o.agent]} — {o.recommendation}</p>
                    <p className="text-muted-foreground">
                      classification {o.classification} · severity {o.severity} · confidence{" "}
                      {Math.round(o.confidence * 100)}%
                    </p>
                    <p className="text-muted-foreground">Citations: {o.citations.join(", ") || "—"}</p>
                    {o.refusal_applied && <Chip tone="danger">Refusal: {o.refusal_reason}</Chip>}
                    {o.redress && (
                      <p className="mt-1 font-semibold">
                        Redress estimate: INR {o.redress.calculated_amount.toLocaleString("en-IN")} ·{" "}
                        {o.redress.event_type.replaceAll("_", " ")} ({o.redress.policy_version}) — non-binding
                      </p>
                    )}
                    {o.resolution && (
                      <div className="mt-1">
                        <p className="font-semibold">Proposed decision: {o.resolution.decision.replaceAll("_", " ")}</p>
                        <p className="text-muted-foreground">{o.resolution.rationale}</p>
                        <pre className="mt-1 rounded bg-surface p-2 text-[11px] whitespace-pre-wrap">
                          {o.resolution.draft_reply}
                        </pre>
                      </div>
                    )}
                    {o.tool_calls?.map((t, i) => (
                      <p key={i} className="mono mt-1 text-[11px] text-muted-foreground">
                        {t.tool}: {t.ok ? "ok" : "VALIDATION_ERROR"}
                      </p>
                    ))}

                  </div>
                ))}
              </div>
              {canDecide && (
                <DialogFooter className="gap-2 sm:justify-between">
                  <Button className="flex-1" onClick={() => approve(active)}>✅ Approve</Button>
                  <Button className="flex-1" variant="destructive" onClick={() => setOverrideOpen(true)}>
                    ❌ Override
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Override modal */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override agent decision</DialogTitle>
            <DialogDescription>The override and your comment are written to the audit trail.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Alternative decision</Label>
              <Select value={alternative} onValueChange={setAlternative}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALTERNATIVES.map((a) => (
                    <SelectItem key={a} value={a}>{a.replaceAll("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Comment (mandatory)</Label>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="Explain why the agent decision is being overridden…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitOverride}>Submit override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk approve confirm */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {selected.length} cases?</DialogTitle>
            <DialogDescription>
              Each case will be closed with your reviewer ID recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                selected.forEach((id) =>
                  applyHitlDecision(id, {
                    decision: "approved",
                    reviewer: user.user_id,
                    comment: "Bulk approved after human review.",
                    at: new Date().toISOString(),
                  }),
                );
                toast.success(`${selected.length} cases approved`);
                setSelected([]);
                setBulkOpen(false);
              }}
            >
              Approve all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
