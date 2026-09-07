import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, LogOut, Search, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip, SeverityChip, StatusChip } from "@/components/app/atoms";
import { PORTAL_CATEGORIES, PRODUCT_LABEL } from "@/lib/domain/catalog";
import { enabledProducts } from "@/lib/domain/admin";
import { buildRawFromForm, useHydratedCases } from "@/lib/domain/store";
import { injectRawCase } from "@/lib/domain/simulation";
import { redactText } from "@/lib/domain/agents";
import { CHANNEL_LABEL } from "@/lib/domain/engine";
import type { Channel } from "@/lib/domain/types";
import {
  linkCaseToCustomer,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  useCustomerSession,
  type PublicCustomer,
} from "@/lib/domain/customers";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Customer Portal — Complaint Navigator" },
      {
        name: "description",
        content:
          "Raise a banking complaint online in four steps and track its status, severity and resolution in real time.",
      },
      { property: "og:title", content: "Customer Portal — Complaint Navigator" },
      {
        property: "og:description",
        content: "Submit a banking grievance online and track the resolution end to end.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalPage,
});

const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: "mock_branch_webform", label: "Branch visit" },
  { value: "mock_email", label: "Phone / email to contact centre" },
  { value: "mock_digital_webform", label: "Internet or mobile banking" },
];

function PortalPage() {
  const [tab, setTab] = useState<"register" | "track">("register");
  const { customer, ready } = useCustomerSession();

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-brand border-b border-sidebar-border">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-black">
            SBF
          </span>
          <div className="text-sidebar-foreground">
            <p className="text-sm leading-4 font-extrabold">Customer Complaint Navigator</p>
            <p className="text-[11px] leading-4 opacity-70">State Bank of Faridabad · Customer Portal</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {customer && (
              <div className="text-right text-sidebar-foreground">
                <p className="text-xs font-bold">{customer.name}</p>
                <p className="mono text-[11px] opacity-75">{customer.customer_id}</p>
              </div>
            )}
            {customer && (
              <Button size="sm" variant="secondary" onClick={() => logoutCustomer()}>
                <LogOut className="size-4" /> Sign out
              </Button>
            )}
            <Link to="/" className="text-xs font-semibold text-sidebar-foreground/80 hover:underline">
              Staff login →
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-extrabold text-foreground">How can we help?</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Complaints registered here enter the bank's grievance workflow immediately and are handled by the
          branch, contact-centre, digital and grievance-officer teams under the RBI Integrated Ombudsman
          Scheme timelines.
        </p>

        {!ready ? null : !customer ? (
          <CustomerAuth />
        ) : (
          <>
            <div className="mt-5 flex gap-2">
              {(["register", "track"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-md border border-border px-4 py-2 text-sm font-semibold",
                    tab === t ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  {t === "register" ? "Register a complaint" : "My complaints"}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === "register" ? (
                <RegisterFlow customer={customer} onRegistered={() => setTab("track")} />
              ) : (
                <TrackPanel customer={customer} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ------------------------------ account access ---------------------------- */

function CustomerAuth() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [ident, setIdent] = useState("");

  const submit = () => {
    const res =
      mode === "signup"
        ? registerCustomer({ name, mobile, email, pin })
        : loginCustomer(ident, pin);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      mode === "signup"
        ? `Account created — your customer ID is ${res.customer.customer_id}`
        : `Welcome back, ${res.customer.name}`,
    );
  };

  return (
    <section className="panel mt-5 max-w-xl p-5">
      <div className="flex gap-2">
        {(["signup", "signin"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-md border border-border px-3 py-1.5 text-xs font-semibold",
              mode === m ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {m === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>

      <h2 className="mt-4 flex items-center gap-2 text-lg font-bold">
        <UserRound className="size-5 text-primary" />
        {mode === "signup" ? "Create your complaint account" : "Sign in to your account"}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Every complaint you raise is tied to your unique customer ID, so you can sign back in any time to
        track status, redress and the bank's reply.
      </p>

      <div className="mt-4 grid gap-3">
        {mode === "signup" ? (
          <>
            <Field label="Full name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mobile (10 digits)">
                <Input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" placeholder="9876543210" />
              </Field>
              <Field label="Email">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </Field>
            </div>
          </>
        ) : (
          <Field label="Customer ID, mobile or email">
            <Input value={ident} onChange={(e) => setIdent(e.target.value)} placeholder="CUST-XXXX-0001" />
          </Field>
        )}
        <Field label={mode === "signup" ? "Choose a 4-6 digit PIN" : "PIN"}>
          <Input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            placeholder="••••"
            className="max-w-40"
          />
        </Field>
        <div>
          <Button onClick={submit}>
            <ShieldCheck className="size-4" />
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}


/* ------------------------------ register flow ----------------------------- */

const STEPS = ["Category", "Channel", "Details", "Contact & consent"];

function RegisterFlow({
  customer,
  onRegistered,
}: {
  customer: PublicCustomer;
  onRegistered: () => void;
}) {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState(PORTAL_CATEGORIES[0]!.id);
  const [channel, setChannel] = useState<Channel>("mock_digital_webform");
  const [narrative, setNarrative] = useState("");
  const [amount, setAmount] = useState("");
  const [incident, setIncident] = useState("");
  const [consent, setConsent] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const cat = PORTAL_CATEGORIES.find((c) => c.id === category)!;

  const submit = () => {
    if (!consent) {
      toast.error("Please confirm the declaration to submit.");
      return;
    }
    if (narrative.trim().length < 20) {
      toast.error("Please describe the issue in at least 20 characters.");
      return;
    }
    const raw = buildRawFromForm(
      {
        channel,
        product: cat.product,
        narrative: redactText(narrative),
        customer_token: customer.customer_id,
        incident_date: incident || null,
        amount: amount ? Number(amount) : null,
        authority_status: "confirmed",
        consent_status: "consent-given",
      },
      "UCN-CUST",
    );
    injectRawCase(raw, `Customer portal submission by ${customer.customer_id}`);
    linkCaseToCustomer(customer.customer_id, raw.case_id);
    setReference(raw.case_id);
  };


  if (reference) {
    return (
      <section className="panel p-6">
        <CheckCircle2 className="size-10 text-success" />
        <h2 className="mt-3 text-lg font-bold">Complaint registered</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your complaint has been logged and routed to the handling team. Please keep this reference number.
        </p>
        <p className="mono mt-4 rounded-lg border border-border bg-muted px-4 py-3 text-lg font-bold">
          {reference}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          You will receive a final response within 30 days as required under the RBI Integrated Ombudsman
          Scheme, 2021. Critical cases are actioned within 3 days.
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setReference(null);
              setStep(0);
              setNarrative("");
              setAmount("");
              setConsent(false);
            }}
          >
            Register another
          </Button>
          <Button onClick={onRegistered}>Track my complaints</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel p-5">
      <ol className="mb-5 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={cn(
              "flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-semibold",
              i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-success/10 text-success" : "bg-card text-muted-foreground",
            )}
          >
            <span className="mono">{i + 1}</span> {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {PORTAL_CATEGORIES.filter((c) => enabledProducts().some((p) => p.value === c.product)).map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "rounded-lg border border-border p-3 text-left hover:bg-muted",
                category === c.id && "border-primary bg-primary/5",
              )}
            >
              <p className="text-sm font-bold">{c.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.examples.join(" · ")}</p>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Where did the issue happen or where did you first raise it?</p>
          {CHANNEL_OPTIONS.map((c) => (
            <button
              key={c.value}
              onClick={() => setChannel(c.value)}
              className={cn(
                "block w-full rounded-lg border border-border p-3 text-left text-sm font-semibold hover:bg-muted",
                channel === c.value && "border-primary bg-primary/5",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">
              Describe your complaint
            </label>
            <Textarea
              rows={5}
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="For example: My UPI payment of INR 2,500 on 28 August failed but the amount was debited and has not been reversed for 4 days."
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Do not share your full account number, card number, OTP or PIN. Anything that looks like an
              account number, phone number or email is masked automatically before storage.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Disputed amount (INR)
              </label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="2500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Date of incident</label>
              <Input type="date" value={incident} onChange={(e) => setIncident(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-3">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <p className="font-semibold text-foreground">Filing as</p>
            <p className="mt-1">
              {customer.name} · <span className="mono">{customer.customer_id}</span> · {customer.mobile} ·{" "}
              {customer.email}
            </p>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4"
            />
            <span>
              I confirm the information given is true, and I consent to the bank processing this complaint,
              including assistive automated triage with human review before any decision is communicated.
            </span>
          </label>
          <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Summary</p>
            <p className="mt-1">
              {cat.label} · {PRODUCT_LABEL[cat.product]} · {CHANNEL_LABEL[channel]} channel
              {amount ? ` · INR ${amount}` : ""}
              {incident ? ` · incident ${incident}` : ""}
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)}>
            Continue <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={submit}>
            <ShieldCheck className="size-4" /> Submit complaint
          </Button>
        )}
      </div>
    </section>
  );
}

/* -------------------------------- tracking -------------------------------- */

function TrackPanel({ customer }: { customer: PublicCustomer }) {
  const { cases } = useHydratedCases();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const mine = useMemo(
    () =>
      cases
        .filter((c) => c.customer_token === customer.customer_id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [cases, customer.customer_id],
  );

  const activeId = selected ?? (q.trim() ? q.trim().toUpperCase() : mine[0]?.case_id ?? null);
  const found = useMemo(
    () => mine.find((c) => c.case_id.toUpperCase() === (activeId ?? "").toUpperCase()),
    [mine, activeId],
  );

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSelected(null);
            }}
            placeholder="Filter by your complaint reference, e.g. UCN-CUST-1A2B3"
            className="pl-8"
          />
        </div>
      </div>

      {mine.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          You have not registered any complaints yet under {customer.customer_id}.
        </p>
      )}

      {mine.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {mine.map((c) => (
            <button
              key={c.case_id}
              onClick={() => {
                setSelected(c.case_id);
                setQ("");
              }}
              className={cn(
                "mono rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted",
                found?.case_id === c.case_id && "border-primary bg-primary/5",
              )}
            >
              {c.case_id}
            </button>
          ))}
        </div>
      )}

      {mine.length > 0 && q.trim() && !found && (
        <p className="mt-4 text-sm text-muted-foreground">
          No complaint under your account matches that reference.
        </p>
      )}


      {found && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-sm font-bold">{found.case_id}</span>
            <StatusChip status={found.status} />
            <SeverityChip severity={found.severity} />
            <Chip tone="info">{PRODUCT_LABEL[found.product] ?? found.product}</Chip>
            {found.deadline && (
              <Chip tone="warning">
                Response due {new Date(found.deadline.date).toLocaleDateString()}
              </Chip>
            )}
          </div>
          <p className="text-sm text-foreground">{found.narrative}</p>

          <div>
            <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">Progress</p>
            <ol className="space-y-1">
              {found.traces.map((t) => (
                <li key={t.trace_id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="mono text-muted-foreground">
                    {new Date(t.event_at).toLocaleString()}
                  </span>
                  <StatusChip status={t.state_after} />
                  <span className="text-muted-foreground">{t.reason}</span>
                </li>
              ))}
            </ol>
          </div>

          {(() => {
            const last = found.agent_outputs[found.agent_outputs.length - 1];
            const res = last?.resolution;
            if (!res) return null;
            return (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  Our response (draft — pending officer approval)
                </p>
                <pre className="mt-2 text-xs whitespace-pre-wrap">{res.draft_reply}</pre>
                {last?.redress && last.redress.calculated_amount > 0 && (
                  <p className="mt-2 text-xs font-semibold">
                    Indicative redress: INR {last.redress.calculated_amount} under {last.redress.policy_version}
                  </p>
                )}
              </div>
            );
          })()}

          <p className="text-[11px] text-muted-foreground">
            Not satisfied, or no reply within 30 days? You may escalate to the RBI Ombudsman under the
            Integrated Ombudsman Scheme, 2021.
          </p>
        </div>
      )}
    </section>
  );
}
