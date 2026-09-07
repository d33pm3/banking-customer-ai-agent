import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip, SectionTitle } from "./atoms";
import { buildRawFromForm, type IntakeForm as IntakeFormData } from "@/lib/domain/store";
import { injectRawCase } from "@/lib/domain/simulation";
import { CHANNELS } from "@/lib/domain/catalog";
import { enabledProducts } from "@/lib/domain/admin";
import type { Channel } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Staff-side intake: log a real complaint and push it straight into the live
 * agent pipeline, exactly as a customer-portal submission would flow.
 */
export function IntakeForm({ actor, onCreated }: { actor: string; onCreated?: (id: string) => void }) {
  const [channel, setChannel] = useState<Channel>("mock_branch_webform");
  const [product, setProduct] = useState("upi");
  const [narrative, setNarrative] = useState("");
  const [amount, setAmount] = useState("");
  const [incident, setIncident] = useState("");
  const [token, setToken] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);

  const submit = () => {
    if (narrative.trim().length < 15) {
      toast.error("Describe the complaint in at least 15 characters.");
      return;
    }
    const form: IntakeFormData = {
      channel,
      product,
      narrative,
      ...(token.trim() ? { customer_token: token.trim() } : {}),
      incident_date: incident || null,
      amount: amount ? Number(amount) : null,
      authority_status: "confirmed",
      consent_status: "consent-given",
    };
    const raw = buildRawFromForm(form, "UCN-INTAKE");
    injectRawCase(raw, `Desk intake by ${actor}`);
    setLastId(raw.case_id);
    setNarrative("");
    setAmount("");
    setIncident("");
    setToken("");
    toast.success(`Case ${raw.case_id} created — now flowing through the agents`);
    onCreated?.(raw.case_id);
  };

  return (
    <section className="panel p-4">
      <SectionTitle
        title="Log a new complaint"
        action={lastId ? <Chip tone="success">Last: {lastId}</Chip> : <Chip tone="info">Real intake</Chip>}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Channel</label>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={c.value}
                onClick={() => setChannel(c.value)}
                className={cn(
                  "rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold",
                  channel === c.value ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Product</label>
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
          >
            {enabledProducts().map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Narrative</label>
          <Textarea
            rows={3}
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder="What happened? Include dates and amounts — PII is redacted automatically."
          />
        </div>
        <div className="grid grid-cols-3 gap-2 lg:col-span-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Amount (INR)</label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="2500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Incident date</label>
            <Input type="date" value={incident} onChange={(e) => setIncident(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Customer token</label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="CUS-0421" />
          </div>
        </div>
      </div>
      <Button className="mt-3" onClick={submit}>
        <Send className="size-4" /> Submit into pipeline
      </Button>
    </section>
  );
}
