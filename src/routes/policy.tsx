import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Calculator } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Chip, SectionTitle } from "@/components/app/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { POLICY_DB, VALID_EVENT_TYPES, computeRedress, rulesFor } from "@/lib/domain/policy";
import { policyVersionFor } from "@/lib/domain/agents";
import { PRODUCTS } from "@/lib/domain/catalog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/policy")({
  head: () => ({
    meta: [
      { title: "Policy Library & Redress Calculator — Complaint Navigator" },
      {
        name: "description",
        content:
          "The RBI circulars and board-approved rules the grievance officer agent uses, with a live redress calculator showing every clause and formula applied.",
      },
      { property: "og:title", content: "Policy Library & Redress Calculator" },
      {
        property: "og:description",
        content: "Real RBI rules, clause references and the formulas behind every redress figure.",
      },
    ],
  }),
  component: PolicyPage,
});

function PolicyPage() {
  const { user } = useAuthGuard();
  const [openDoc, setOpenDoc] = useState<string | null>(POLICY_DB[0]!.doc_id);
  const [event, setEvent] = useState<string>("failed_payment");
  const [product, setProduct] = useState("upi");
  const [amount, setAmount] = useState("2500");
  const [delay, setDelay] = useState("4");
  const [reported, setReported] = useState("2");

  const result = useMemo(() => {
    try {
      return computeRedress({
        case_id: "CALC",
        event_type: event,
        product,
        policy_version: policyVersionFor(event, product),
        amount: Number(amount) || 0,
        delay_days: Number(delay) || 0,
        reported_after_days: Number(reported) || 0,
      });
    } catch (e) {
      return { error: (e as Error).message } as const;
    }
  }, [event, product, amount, delay, reported]);

  if (!user) return null;

  return (
    <AppShell user={user}>
      <div className="mb-4">
        <h1 className="text-xl font-extrabold">Policy library</h1>
        <p className="text-sm text-muted-foreground">
          Every redress figure the GHO agent produces is computed from these documents — the clause and the
          formula are recorded on the case.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="space-y-2">
          {POLICY_DB.map((d) => (
            <article key={d.doc_id} className="panel overflow-hidden">
              <button
                className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/50"
                onClick={() => setOpenDoc((o) => (o === d.doc_id ? null : d.doc_id))}
              >
                <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-bold">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.reference}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Chip tone="info">{d.doc_id}</Chip>
                    <Chip>v{d.version}</Chip>
                    <Chip tone={d.approved ? "success" : "danger"}>
                      {d.approved ? "Approved" : "Withdrawn"}
                    </Chip>
                    <Chip tone="neutral">{d.rules.length} rules</Chip>
                  </div>
                </div>
              </button>
              {openDoc === d.doc_id && (
                <div className="border-t border-border p-4 text-sm">
                  <p className="text-muted-foreground">{d.summary}</p>
                  <p className="mt-3 text-xs font-bold tracking-wide text-muted-foreground uppercase">Clauses</p>
                  <ul className="mt-1 space-y-1.5">
                    {d.clauses.map((c) => (
                      <li key={c.clause_id} className="text-xs">
                        <span className="mono font-bold">{c.clause_id}</span>{" "}
                        <span className="text-muted-foreground">{c.text}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    Machine-applied rules
                  </p>
                  <div className="mt-1 space-y-1.5">
                    {d.rules.map((r) => (
                      <div key={r.rule_id} className="rounded-md border border-border p-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="mono font-bold">{r.rule_id}</span>
                          <Chip>{r.kind.replaceAll("_", " ")}</Chip>
                          <Chip tone="info">{r.clause_id}</Chip>
                        </div>
                        <p className="mt-1 font-semibold">{r.label}</p>
                        <p className="mono mt-0.5 text-muted-foreground">{r.formula}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>

        <section className="panel h-fit p-4">
          <SectionTitle title="Redress calculator" action={<Calculator className="size-4 text-primary" />} />
          <div className="grid gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Event type</label>
            <div className="flex flex-wrap gap-1.5">
              {VALID_EVENT_TYPES.map((e) => (
                <button
                  key={e}
                  onClick={() => setEvent(e)}
                  className={cn(
                    "rounded-md border border-border px-2 py-1 text-xs font-semibold",
                    event === e ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  {e.replaceAll("_", " ")}
                </button>
              ))}
            </div>
            <label className="mt-2 text-xs font-semibold text-muted-foreground">Product</label>
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            >
              {PRODUCTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Amount</label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Delay days</label>
                <Input value={delay} onChange={(e) => setDelay(e.target.value)} inputMode="numeric" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Reported after</label>
                <Input value={reported} onChange={(e) => setReported(e.target.value)} inputMode="numeric" />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
            {"error" in result ? (
              <p className="text-sm font-semibold text-destructive">{result.error}</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Policy version</p>
                <p className="mono text-sm font-bold">{result.policy_version}</p>
                <p className="mono mt-2 text-2xl font-extrabold">INR {result.calculated_amount}</p>
                <div className="mt-3 space-y-1.5">
                  {result.workings.map((w) => (
                    <div key={w.label} className="text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">{w.label}</span>
                        <span className="mono">INR {w.amount}</span>
                      </div>
                      <p className="mono text-[11px] text-muted-foreground">{w.working}</p>
                      <p className="text-[11px] text-muted-foreground">{w.rule}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">{result.note}</p>
              </>
            )}
          </div>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Rules matched for this event/product: {rulesFor(event, product).length}
          </p>
        </section>
      </div>
    </AppShell>
  );
}
