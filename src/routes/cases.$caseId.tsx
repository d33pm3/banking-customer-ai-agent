import { useEffect } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import {
  Chip,
  ClassificationChip,
  SectionTitle,
  SeverityChip,
  SlaMeter,
  StatusChip,
} from "@/components/app/atoms";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { pushRecent, useHydratedCases, visibleCases } from "@/lib/domain/store";
import { AGENT_ICON, AGENT_LABEL, CHANNEL_LABEL } from "@/lib/domain/engine";
import { redactText } from "@/lib/domain/agents";

export const Route = createFileRoute("/cases/$caseId")({
  head: ({ params }) => ({
    meta: [
      { title: `Case ${params.caseId} — Complaint Navigator` },
      {
        name: "description",
        content: `Full audit view of grievance case ${params.caseId}: narrative, agent decisions, state timeline and tool calls.`,
      },
      { property: "og:title", content: `Case ${params.caseId} — Complaint Navigator` },
      {
        property: "og:description",
        content: `Narrative, agent outputs, state timeline and tool calls for case ${params.caseId}.`,
      },
    ],
  }),
  component: CaseDetailPage,
});

function CaseDetailPage() {
  const { user } = useAuthGuard();
  const { caseId } = useParams({ from: "/cases/$caseId" });
  const { cases, ready } = useHydratedCases();

  useEffect(() => {
    if (caseId) pushRecent(caseId);
  }, [caseId]);

  if (!user) return null;
  const scoped = visibleCases(cases, user);
  const record = scoped.find((c) => c.case_id === caseId);

  if (!record) {
    return (
      <AppShell user={user}>
        <div className="panel p-10 text-center">
          <p className="font-semibold">
            {ready ? "Case not found or not visible with your role." : "Loading case…"}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/cases">Back to cases</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" aria-label="Back">
              <Link to="/cases"><ArrowLeft className="size-4" /></Link>
            </Button>
            <div>
              <h1 className="mono text-2xl font-extrabold">{record.case_id}</h1>
              <p className="text-sm text-muted-foreground">
                {CHANNEL_LABEL[record.source_channel]} · {record.product.replaceAll("_", " ")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClassificationChip value={record.classification} />
            <SeverityChip severity={record.severity} />
            <StatusChip status={record.status} />
            {record.hitl_required && <Chip tone="danger">HITL required</Chip>}
            {record.refusal_reason && <Chip tone="warning">Refusal: {record.refusal_reason}</Chip>}
            {record.duplicate_of && <Chip tone="info">Duplicate of {record.duplicate_of}</Chip>}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="panel p-4">
            <SectionTitle title="Case info" />
            <dl className="space-y-2 text-sm">
              <Row k="Case ID" v={record.case_id} mono />
              <Row k="Channel" v={CHANNEL_LABEL[record.source_channel] ?? record.source_channel} />
              <Row k="Product" v={record.product.replaceAll("_", " ")} />
              <Row k="Customer token" v={`${record.customer_token} (masked)`} mono />
              <Row k="Language" v={record.language} />
              <Row k="Created" v={new Date(record.created_at).toLocaleString()} />
              <Row k="Authority" v={record.authority_status} />
              <Row k="Consent" v={record.consent_status} />
              <Row k="Input hash" v={record.raw_input_hash} mono />
              <Row k="Assigned" v={record.assigned_agent ? AGENT_LABEL[record.assigned_agent] : "—"} />
              <Row
                k="SLA deadline"
                v={record.deadline ? new Date(record.deadline.date).toLocaleDateString() : "Pending human"}
              />
            </dl>
            <div className="mt-3"><SlaMeter record={record} /></div>
            {record.deadline && (
              <p className="mt-2 text-xs text-muted-foreground">{record.deadline.source_rule}</p>
            )}
          </div>

          <div className="panel p-4">
            <SectionTitle title="Narrative (PII redacted)" />
            <p className="rounded-lg bg-surface p-3 text-sm leading-relaxed">{redactText(record.narrative)}</p>
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Attachments</p>
              <p className="text-sm">
                {record.attachment_refs.length ? record.attachment_refs.join(", ") : "None"}
              </p>
            </div>
            {record.pii_detected && (
              <p className="mt-3 text-xs font-semibold text-warning-foreground">
                PII detected — privacy hold applied per KB-PRIVACY-001.
              </p>
            )}
            {record.hitl_decision && (
              <div className="mt-3 rounded-lg border border-border p-3 text-xs">
                <p className="font-bold">
                  HITL {record.hitl_decision.decision} by {record.hitl_decision.reviewer}
                </p>
                <p className="mt-1 text-muted-foreground">{record.hitl_decision.comment}</p>
              </div>
            )}
          </div>

          <div className="panel p-4">
            <SectionTitle title="Timeline" />
            <ol className="relative space-y-3 border-l border-border pl-4">
              {record.traces.map((t) => (
                <li key={t.trace_id} className="relative">
                  <span className="absolute top-1 -left-[21px] grid size-3.5 place-items-center rounded-full bg-card">
                    {t.state_after === record.status ? (
                      <Circle className="size-3 fill-accent text-accent" />
                    ) : (
                      <CheckCircle2 className="size-3.5 text-success" />
                    )}
                  </span>
                  <p className="text-xs font-bold">{t.state_after.replaceAll("_", " ")}</p>
                  <p className="mono text-[11px] text-muted-foreground">
                    {new Date(t.event_at).toLocaleString()} · {t.actor}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t.reason}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="panel p-4">
          <SectionTitle title="Agent outputs" />
          <Tabs defaultValue={record.agent_outputs[0]?.agent ?? "audit"}>
            <TabsList>
              {record.agent_outputs.map((o) => (
                <TabsTrigger key={o.agent} value={o.agent}>
                  {AGENT_ICON[o.agent]} {AGENT_LABEL[o.agent]}
                </TabsTrigger>
              ))}
              <TabsTrigger value="audit">Audit log</TabsTrigger>
            </TabsList>

            {record.agent_outputs.map((o) => (
              <TabsContent key={o.agent} value={o.agent} className="mt-3 space-y-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Mini k="Sub-agent" v={o.sub_agent} />
                  <Mini k="Classification" v={o.classification} />
                  <Mini k="Severity" v={o.severity} />
                  <Mini k="Recommendation" v={o.recommendation} />
                  <Mini k="Confidence" v={`${Math.round(o.confidence * 100)}%`} />
                  <Mini k="Refusal applied" v={o.refusal_applied ? `Yes (${o.refusal_reason})` : "No"} />
                  <Mini k="Citations" v={o.citations.join(", ") || "—"} />
                  <Mini k="Regulatory markers" v={o.regulatory_markers.join(", ") || "—"} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold text-muted-foreground uppercase">Allegations</p>
                  <ul className="space-y-1">
                    {o.allegations.map((a) => (
                      <li key={a.id} className="flex items-start gap-2 text-sm">
                        <Chip tone={a.risk === "high" ? "danger" : a.risk === "medium" ? "warning" : "neutral"}>
                          {a.id} · {a.risk}
                        </Chip>
                        <span className="text-muted-foreground">{a.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {o.redress ? (
                  <div className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-xs font-bold text-muted-foreground uppercase">
                      Non-binding redress calculation
                    </p>
                    <p className="text-lg font-extrabold">
                      INR {o.redress.calculated_amount.toLocaleString("en-IN")}
                      <span className="ml-2 text-xs font-medium text-muted-foreground">
                        {o.redress.event_type.replaceAll("_", " ")} · {o.redress.policy_version}
                      </span>
                    </p>
                    <ul className="mt-2 space-y-1">
                      {o.redress.components.map((c) => (
                        <li key={c.label} className="flex justify-between gap-3 text-xs">
                          <span className="text-muted-foreground">
                            {c.label} <span className="mono">({c.rule})</span>
                          </span>
                          <span className="mono font-semibold">INR {c.amount.toLocaleString("en-IN")}</span>
                        </li>
                      ))}
                      {o.redress.components.length === 0 && (
                        <li className="text-xs text-muted-foreground">{o.redress.basis}</li>
                      )}
                    </ul>
                    <p className="mt-2 text-[11px] text-muted-foreground">{o.redress.note}</p>
                  </div>
                ) : null}
                {o.resolution ? (
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold text-muted-foreground uppercase">Decision</p>
                      <Chip
                        tone={
                          o.resolution.decision === "uphold"
                            ? "success"
                            : o.resolution.decision === "reject"
                              ? "danger"
                              : o.resolution.decision === "refer_human"
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {o.resolution.decision.replaceAll("_", " ")}
                      </Chip>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{o.resolution.rationale}</p>
                    <p className="mt-2 text-xs font-bold text-muted-foreground uppercase">Next actions</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-sm">
                      {o.resolution.next_actions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs font-bold text-muted-foreground uppercase">Draft reply</p>
                    <pre className="mt-1 rounded-lg bg-surface p-3 text-xs whitespace-pre-wrap">
                      {o.resolution.draft_reply}
                    </pre>
                  </div>
                ) : null}
                {o.tool_calls?.length ? (
                  <div>
                    <p className="mb-1 text-xs font-bold text-muted-foreground uppercase">Tool calls</p>
                    <div className="space-y-2">
                      {o.tool_calls.map((t, i) => (
                        <div key={i} className="rounded-lg border border-border p-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="mono font-bold">{t.tool}</span>
                            <Chip tone={t.ok ? "success" : "danger"}>{t.ok ? "ok" : "validation error"}</Chip>
                          </div>
                          <pre className="mono mt-1 overflow-x-auto text-[11px] text-muted-foreground">
                            {JSON.stringify(t.result, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

              </TabsContent>
            ))}

            <TabsContent value="audit" className="mt-3">
              <pre className="mono max-h-96 overflow-auto rounded-lg bg-surface p-3 text-[11px]">
                {JSON.stringify(
                  { agent_outputs: record.agent_outputs, traces: record.traces },
                  null,
                  2,
                )}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border pb-1 last:border-0">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className={mono ? "mono text-xs font-semibold" : "text-xs font-semibold capitalize"}>{v}</dd>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <p className="text-[11px] font-bold text-muted-foreground uppercase">{k}</p>
      <p className="text-sm font-semibold break-words">{v}</p>
    </div>
  );
}
