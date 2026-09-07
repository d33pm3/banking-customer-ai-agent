import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ClipboardCheck, Inbox } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Chip, SectionTitle, SeverityChip, StatusChip } from "@/components/app/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { getCases, submitAgentDecision, useHydratedCases } from "@/lib/domain/store";
import { AGENT_LABEL, CHANNEL_LABEL } from "@/lib/domain/engine";
import { policyVersionFor } from "@/lib/domain/agents";
import { computeRedress } from "@/lib/domain/policy";
import { PRODUCT_LABEL } from "@/lib/domain/catalog";
import type { AgentName, Classification, Role, Severity } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/desk")({
  head: () => ({
    meta: [
      { title: "Agent Workbench — Complaint Navigator" },
      {
        name: "description",
        content:
          "Each handling agent records their own classification, severity and redress; the case advances through the pipeline automatically.",
      },
      { property: "og:title", content: "Agent Workbench — Complaint Navigator" },
      {
        property: "og:description",
        content: "Classify, grade severity and set redress on your queue; the pipeline advances automatically.",
      },
    ],
  }),
  component: DeskPage,
});

const ROLE_AGENT: Record<Role, AgentName> = {
  branch: "branch_level",
  cc: "email_contact",
  digital: "digital_desk",
  gho: "gho",
  hitl: "gho",
  admin: "gho",
};

const CLASSIFICATIONS: Classification[] = ["complaint", "request", "query", "ambiguous"];
const SEVERITIES: Severity[] = ["S1", "S2", "S3", "S4", "pending_human"];

function DeskPage() {
  const { user } = useAuthGuard();
  const { cases } = useHydratedCases();
  const [agent, setAgent] = useState<AgentName | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const activeAgent: AgentName = agent ?? (user ? ROLE_AGENT[user.role] : "gho");

  const queue = useMemo(
    () =>
      cases
        .filter(
          (c) =>
            c.assigned_agent === activeAgent &&
            !["CLOSED", "REJECTED", "WITHDRAWN"].includes(c.status),
        )
        .sort((a, b) => (a.received_at < b.received_at ? 1 : -1)),
    [cases, activeAgent],
  );

  const current = queue.find((c) => c.case_id === selected) ?? queue[0] ?? null;

  if (!user) return null;

  return (
    <AppShell user={user}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold">Agent workbench</h1>
          <p className="text-sm text-muted-foreground">
            Record your own classification, severity and redress. Submitting advances the case to the next
            stage of the pipeline and writes an audit entry.
          </p>
        </div>
        {user.role === "admin" &&
          (Object.keys(AGENT_LABEL) as AgentName[]).map((a) => (
            <button
              key={a}
              onClick={() => {
                setAgent(a);
                setSelected(null);
              }}
              className={cn(
                "rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold",
                activeAgent === a ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {AGENT_LABEL[a]}
            </button>
          ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <section className="panel p-3">
          <SectionTitle
            title={`${AGENT_LABEL[activeAgent]} queue`}
            action={<Chip tone="info">{queue.length}</Chip>}
          />
          {queue.length === 0 && (
            <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Inbox className="size-4" /> Nothing assigned right now.
            </p>
          )}
          <ul className="space-y-1.5">
            {queue.map((c) => (
              <li key={c.case_id}>
                <button
                  onClick={() => setSelected(c.case_id)}
                  className={cn(
                    "w-full rounded-lg border border-border p-2.5 text-left hover:bg-muted",
                    current?.case_id === c.case_id && "border-primary bg-primary/5",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="mono text-xs font-bold">{c.case_id}</span>
                    <SeverityChip severity={c.severity} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.narrative}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <StatusChip status={c.status} />
                    <Chip>{CHANNEL_LABEL[c.source_channel] ?? c.source_channel}</Chip>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {current ? (
          <DecisionPanel
            key={current.case_id}
            caseId={current.case_id}
            actor={user.display_name}
            stage={activeAgent === "gho" ? "gho" : "intake"}
          />
        ) : (
          <section className="panel grid place-items-center p-10 text-sm text-muted-foreground">
            Select a case from your queue.
          </section>
        )}
      </div>
    </AppShell>
  );
}

function DecisionPanel({
  caseId,
  actor,
  stage,
}: {
  caseId: string;
  actor: string;
  stage: "intake" | "gho";
}) {
  const record = getCases().find((c) => c.case_id === caseId)!;
  const last = record.agent_outputs[record.agent_outputs.length - 1];
  const [classification, setClassification] = useState<Classification>(
    record.classification ?? "complaint",
  );
  const [severity, setSeverity] = useState<Severity>(
    record.severity ?? "S3",
  );
  const [redress, setRedress] = useState(String(last?.redress?.calculated_amount ?? 0));
  const [decision, setDecision] = useState<string>(last?.resolution?.decision ?? "uphold");
  const [note, setNote] = useState("");
  const [hitl, setHitl] = useState(stage === "gho");

  const suggested = useMemo(() => {
    try {
      const evt = last?.redress?.event_type ?? "service_delay";
      return computeRedress({
        case_id: caseId,
        event_type: evt,
        product: record.product,
        policy_version: policyVersionFor(evt, record.product),
        amount: last?.redress?.amount_claimed ?? 0,
        severity,
      });
    } catch {
      return null;
    }
  }, [caseId, last, record.product, severity]);

  const submit = () => {
    if (note.trim().length < 8) {
      toast.error("Add a short rationale (at least 8 characters).");
      return;
    }
    const res = submitAgentDecision(
      caseId,
      {
        stage,
        classification,
        severity,
        redress_amount: Number(redress) || 0,
        decision,
        note: note.trim(),
        hitl_required: hitl,
      },
      actor,
    );
    if (!res) {
      toast.error(`This case is in ${record.status} — the ${stage === "intake" ? "intake" : "GHO"} stage cannot act on it.`);
      return;
    }
    setNote("");
    toast.success(`${caseId} advanced to ${res.status}`);
  };

  return (
    <section className="panel p-4">
      <SectionTitle
        title={`Decision — ${caseId}`}
        action={
          <Link to="/cases/$caseId" params={{ caseId }} className="text-xs font-semibold text-primary hover:underline">
            Open full case →
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusChip status={record.status} />
        <SeverityChip severity={record.severity} />
        <Chip tone="info">{PRODUCT_LABEL[record.product] ?? record.product}</Chip>
        <Chip>{CHANNEL_LABEL[record.source_channel] ?? record.source_channel}</Chip>
        {record.deadline && <Chip tone="warning">Due {new Date(record.deadline.date).toLocaleDateString()}</Chip>}
      </div>
      <p className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">{record.narrative}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Classification</label>
          <div className="flex flex-wrap gap-1.5">
            {CLASSIFICATIONS.map((c) => (
              <button
                key={c}
                onClick={() => setClassification(c)}
                className={cn(
                  "rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold capitalize",
                  classification === c ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="mt-3 mb-1 block text-xs font-semibold text-muted-foreground">Severity</label>
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={cn(
                  "rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold",
                  severity === s ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                {s === "pending_human" ? "Pending" : s}
              </button>
            ))}
          </div>
        </div>

        <div>
          {stage === "gho" && (
            <>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Decision</label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
              >
                {["uphold", "partially_uphold", "reject", "refer_human", "information_only"].map((d) => (
                  <option key={d} value={d}>
                    {d.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </>
          )}
          <label className="mt-3 mb-1 block text-xs font-semibold text-muted-foreground">
            Redress you propose (INR)
          </label>
          <Input value={redress} onChange={(e) => setRedress(e.target.value)} inputMode="numeric" />
          {suggested && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Policy calculator suggests INR {suggested.calculated_amount} under {suggested.policy_version}.{" "}
              <button className="font-semibold text-primary hover:underline" onClick={() => setRedress(String(suggested.calculated_amount))}>
                Use this
              </button>
            </p>
          )}
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={hitl} onChange={(e) => setHitl(e.target.checked)} className="size-4" />
            Send to human approval queue
          </label>
        </div>
      </div>

      <label className="mt-4 mb-1 block text-xs font-semibold text-muted-foreground">Rationale / note</label>
      <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this classification, severity and redress?" />

      <Button className="mt-3" onClick={submit}>
        <ClipboardCheck className="size-4" /> Submit decision
      </Button>
    </section>
  );
}
