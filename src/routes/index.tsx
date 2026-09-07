import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Chip } from "@/components/app/atoms";
import { USERS, ensureSeeded, getSession, login } from "@/lib/domain/store";
import { isStaffActive } from "@/lib/domain/admin";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Customer Complaint Navigator" },
      {
        name: "description",
        content:
          "Role-based demo sign-in for the four-agent AI banking complaint resolution console. Twelve demo users, PIN-only access.",
      },
      { property: "og:title", content: "Sign in — Customer Complaint Navigator" },
      {
        property: "og:description",
        content: "Role-based demo sign-in for the four-agent AI banking complaint resolution console.",
      },
    ],
  }),
  component: LoginPage,
});

const GROUPS: { label: string; prefix: string }[] = [
  { label: "Branch Level", prefix: "branch_head" },
  { label: "Contact Centre", prefix: "cc_agent" },
  { label: "Digital Desk", prefix: "digital_agent" },
  { label: "Grievance Handling Officer", prefix: "gho_officer" },
  { label: "HITL Reviewers", prefix: "hitl_reviewer" },
  { label: "Admin", prefix: "admin_" },
];

function LoginPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("admin_01");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    ensureSeeded();
    if (getSession()) navigate({ to: "/dashboard" });
  }, [navigate]);

  const selected = USERS.find((u) => u.user_id === userId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim().length !== 4) {
      setError("Enter any 4-character PIN to continue.");
      return;
    }
    if (!login(userId)) {
      setError("That account is disabled by the administrator. Choose another user.");
      return;
    }
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="gradient-brand relative hidden flex-col justify-between p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-sidebar-primary text-lg font-black text-sidebar-primary-foreground">
            SBF
          </span>
          <div>
            <p className="text-lg font-extrabold">Customer Complaint Navigator</p>
            <p className="text-sm font-semibold opacity-90">State Bank of Faridabad</p>
            <p className="text-sm opacity-75">Branch · Contact Centre · Digital Desk · GHO</p>
          </div>
        </div>

        <div className="max-w-lg space-y-6">
          <h1 className="text-4xl leading-tight font-extrabold">
            Deterministic grievance handling with a human always in the loop.
          </h1>
          <p className="text-sm opacity-80">
            Four top-level agents and eight sub-agents triage, classify and draft non-binding decisions.
            No money movement, no legal advice, no PII in logs — every state transition is auditable.
          </p>
          <ul className="space-y-2 text-sm">
            {[
              "Deterministic state machine with immutable trace log",
              "Three safe read-only tools: evidence, redress estimate, policy",
              "Mandatory HITL for S1/S2, refusals and ambiguity",
              "Runs fully in your browser — no backend, no data leaves the device",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sidebar-primary" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs opacity-60">Prototype with synthetic test data only. Not a production banking system.</p>
      </section>

      <section className="flex items-center justify-center bg-background p-6">
        <form onSubmit={submit} className="panel w-full max-w-md space-y-5 p-7">
          <div className="space-y-1">
            <Chip tone="info">
              <Sparkles className="size-3" /> Demo access
            </Chip>
            <h2 className="text-2xl font-extrabold">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Pick any of the 12 demo user IDs and enter any 4-character PIN.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user">User ID</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="user" className="w-full">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {GROUPS.map((g) => (
                  <SelectGroup key={g.label}>
                    <SelectLabel>{g.label}</SelectLabel>
                    {USERS.filter((u) => u.user_id.startsWith(g.prefix) && isStaffActive(u.user_id)).map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.user_id}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {selected && <p className="text-xs text-muted-foreground">View: {selected.view_filter}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin">4-character PIN</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                id="pin"
                value={pin}
                maxLength={4}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError("");
                }}
                placeholder="e.g. 1234"
                className="mono pl-9 tracking-[0.4em]"
                autoComplete="off"
              />
            </div>
            {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
          </div>

          <Button type="submit" className="w-full" size="lg">
            Login
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Any 4 characters are accepted — this prototype stores everything in your browser.
          </p>

          <p className="text-center text-xs">
            Are you a customer?{" "}
            <a href="/portal" className="font-semibold text-primary hover:underline">
              Register or track a complaint →
            </a>
          </p>
        </form>
      </section>
    </div>
  );
}
