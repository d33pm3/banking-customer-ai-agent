import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Boxes,
  Gavel,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Chip } from "@/components/app/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuthGuard } from "@/lib/useAuthGuard";
import {
  ROLE_CAPABILITIES,
  ROLE_LABEL,
  type BranchRecord,
  type ProductRecord,
  type StaffRecord,
  removeStaff,
  resetAdminConfig,
  setBranches,
  setDocApproved,
  setProducts,
  setRuleParam,
  setThresholds,
  upsertStaff,
  useAdminConfig,
} from "@/lib/domain/admin";
import { POLICY_DB } from "@/lib/domain/policy";
import { logAudit } from "@/lib/domain/store";
import type { Role } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration Console — Complaint Navigator" },
      {
        name: "description",
        content:
          "Manage staff and roles, branches, product configuration, approval thresholds and the policy rule book that drives redress calculations.",
      },
      { property: "og:title", content: "Administration Console" },
      {
        property: "og:description",
        content: "Users, roles, branches, products, limits and policy rules for the complaint platform.",
      },
    ],
  }),
  component: AdminPage,
});

const TABS = [
  { id: "users", label: "Users & roles", icon: Users },
  { id: "branches", label: "Branches", icon: Building2 },
  { id: "products", label: "Products & SLA", icon: Boxes },
  { id: "limits", label: "Limits & approvals", icon: ShieldCheck },
  { id: "policy", label: "Policy administration", icon: Gavel },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ROLES: Role[] = ["branch", "cc", "digital", "gho", "hitl", "admin"];

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}>{children}</div>;
}

function AdminPage() {
  const { user } = useAuthGuard();
  const cfg = useAdminConfig();
  const [tab, setTab] = useState<TabId>("users");

  if (!user) return null;

  const denied = user.role !== "admin";

  return (
    <AppShell user={user}>
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Settings2 className="size-5 text-primary" /> Administration console
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Everything configured here is read by the live workflow engine — staff access, branch and product setup,
          approval limits and the policy rule book behind every redress figure.
        </p>
      </div>

      {denied ? (
        <Card className="border-destructive/40">
          <p className="text-sm">
            Administration is restricted to the <strong>System administrator</strong> role. You are signed in as{" "}
            <strong>{ROLE_LABEL[user.role]}</strong>.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                  tab === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                if (confirm("Reset all administration configuration to factory defaults?")) resetAdminConfig();
              }}
            >
              <RotateCcw className="mr-2 size-4" /> Reset configuration
            </Button>
          </div>

          {tab === "users" && <UsersTab cfg={cfg} actor={user.user_id} />}
          {tab === "branches" && <BranchesTab cfg={cfg} actor={user.user_id} />}
          {tab === "products" && <ProductsTab cfg={cfg} actor={user.user_id} />}
          {tab === "limits" && <LimitsTab cfg={cfg} actor={user.user_id} />}
          {tab === "policy" && <PolicyTab cfg={cfg} actor={user.user_id} />}
        </>
      )}
    </AppShell>
  );
}

type Cfg = ReturnType<typeof useAdminConfig>;

/* ------------------------------ users & roles ----------------------------- */

function UsersTab({ cfg, actor }: { cfg: Cfg; actor: string }) {
  const blank: StaffRecord = {
    user_id: "",
    display_name: "",
    role: "branch",
    branch_code: cfg.branches[0]?.code ?? "FBD-001",
    email: "",
    active: true,
    view_filter: "Branch channel cases only",
  };
  const [draft, setDraft] = useState<StaffRecord>(blank);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    cfg.staff.forEach((s) => (m[s.role] = (m[s.role] ?? 0) + 1));
    return m;
  }, [cfg.staff]);

  function save() {
    const id = draft.user_id.trim().toLowerCase().replace(/\s+/g, "_");
    if (!id || !draft.display_name.trim()) return setError("User ID and display name are required.");
    if (cfg.staff.some((s) => s.user_id === id)) return setError("That user ID already exists.");
    upsertStaff({ ...draft, user_id: id });
    logAudit({ actor, action: "admin_user_created", case_id: null, details: { user_id: id, role: draft.role } });
    setDraft(blank);
    setError(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <Card>
        <h3 className="mb-3 font-semibold">Staff directory ({cfg.staff.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 text-left">User</th>
                <th className="text-left">Role</th>
                <th className="text-left">Branch</th>
                <th className="text-left">Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cfg.staff.map((s) => (
                <tr key={s.user_id} className="border-b last:border-0">
                  <td className="py-2">
                    <div className="font-medium">{s.display_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{s.user_id}</div>
                  </td>
                  <td>
                    <select
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                      value={s.role}
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        upsertStaff({ ...s, role });
                        logAudit({
                          actor,
                          action: "admin_role_changed",
                          case_id: null,
                          details: { user_id: s.user_id, from: s.role, to: role },
                        });
                      }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                      value={s.branch_code}
                      onChange={(e) => upsertStaff({ ...s, branch_code: e.target.value })}
                    >
                      {cfg.branches.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Switch
                      checked={s.active}
                      onCheckedChange={(v) => {
                        upsertStaff({ ...s, active: v });
                        logAudit({
                          actor,
                          action: v ? "admin_user_enabled" : "admin_user_disabled",
                          case_id: null,
                          details: { user_id: s.user_id },
                        });
                      }}
                    />
                  </td>
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        removeStaff(s.user_id);
                        logAudit({ actor, action: "admin_user_removed", case_id: null, details: { user_id: s.user_id } });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Disabled users are refused at sign-in and cannot be assigned new cases.
        </p>
      </Card>

      <div className="space-y-4">
        <Card>
          <h3 className="mb-3 font-semibold">Add a user</h3>
          <div className="space-y-2">
            <Input
              placeholder="User ID (e.g. cc_agent_03)"
              value={draft.user_id}
              onChange={(e) => setDraft({ ...draft, user_id: e.target.value })}
            />
            <Input
              placeholder="Display name"
              value={draft.display_name}
              onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
            />
            <Input
              placeholder="Email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
            <select
              className="w-full rounded-md border bg-background px-2 py-2 text-sm"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-md border bg-background px-2 py-2 text-sm"
              value={draft.branch_code}
              onChange={(e) => setDraft({ ...draft, branch_code: e.target.value })}
            >
              {cfg.branches.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full" onClick={save}>
              Create user
            </Button>
          </div>
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold">Role capabilities</h3>
          <ul className="space-y-2 text-sm">
            {ROLES.map((r) => (
              <li key={r} className="border-b pb-2 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{ROLE_LABEL[r]}</span>
                  <Chip tone="neutral">{counts[r] ?? 0}</Chip>
                </div>
                <div className="text-xs text-muted-foreground">{ROLE_CAPABILITIES[r].join(" · ")}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------- branches -------------------------------- */

function BranchesTab({ cfg, actor }: { cfg: Cfg; actor: string }) {
  const [draft, setDraft] = useState<BranchRecord>({
    code: "",
    name: "",
    region: "North",
    ifsc: "",
    active: true,
  });

  function update(code: string, patch: Partial<BranchRecord>) {
    setBranches(cfg.branches.map((b) => (b.code === code ? { ...b, ...patch } : b)));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <Card>
        <h3 className="mb-3 font-semibold">Branches & departments ({cfg.branches.length})</h3>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 text-left">Code</th>
              <th className="text-left">Name</th>
              <th className="text-left">Region</th>
              <th className="text-left">IFSC</th>
              <th className="text-left">Staff</th>
              <th className="text-left">Active</th>
            </tr>
          </thead>
          <tbody>
            {cfg.branches.map((b) => (
              <tr key={b.code} className="border-b last:border-0">
                <td className="py-2 font-mono text-xs">{b.code}</td>
                <td>
                  <Input
                    className="h-8"
                    value={b.name}
                    onChange={(e) => update(b.code, { name: e.target.value })}
                  />
                </td>
                <td>{b.region}</td>
                <td className="font-mono text-xs">{b.ifsc}</td>
                <td>{cfg.staff.filter((s) => s.branch_code === b.code).length}</td>
                <td>
                  <Switch checked={b.active} onCheckedChange={(v) => update(b.code, { active: v })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Add a branch</h3>
        <div className="space-y-2">
          <Input placeholder="Code (e.g. FBD-004)" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          <Input placeholder="Branch name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input placeholder="Region" value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} />
          <Input placeholder="IFSC" value={draft.ifsc} onChange={(e) => setDraft({ ...draft, ifsc: e.target.value })} />
          <Button
            className="w-full"
            onClick={() => {
              if (!draft.code.trim() || !draft.name.trim()) return;
              setBranches([...cfg.branches, draft]);
              logAudit({ actor, action: "admin_branch_created", case_id: null, details: { code: draft.code } });
              setDraft({ code: "", name: "", region: "North", ifsc: "", active: true });
            }}
          >
            Create branch
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------- products -------------------------------- */

function ProductsTab({ cfg, actor }: { cfg: Cfg; actor: string }) {
  function update(value: string, patch: Partial<ProductRecord>) {
    setProducts(cfg.products.map((p) => (p.value === value ? { ...p, ...patch } : p)));
    logAudit({ actor, action: "admin_product_updated", case_id: null, details: { product: value, ...patch } });
  }

  return (
    <Card>
      <h3 className="mb-3 font-semibold">Product configuration</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Disabled products disappear from the customer portal and staff intake form. The resolution SLA here caps the
        severity-derived deadline — the tighter of the two always applies.
      </p>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 text-left">Product</th>
            <th className="text-left">Group</th>
            <th className="text-left">Ack SLA (days)</th>
            <th className="text-left">Resolution SLA (days)</th>
            <th className="text-left">Enabled</th>
          </tr>
        </thead>
        <tbody>
          {cfg.products.map((p) => (
            <tr key={p.value} className="border-b last:border-0">
              <td className="py-2">{p.label}</td>
              <td>
                <Chip tone="neutral">{p.group}</Chip>
              </td>
              <td>
                <Input
                  className="h-8 w-20"
                  type="number"
                  min={1}
                  value={p.ack_sla_days}
                  onChange={(e) => update(p.value, { ack_sla_days: Math.max(1, Number(e.target.value) || 1) })}
                />
              </td>
              <td>
                <Input
                  className="h-8 w-24"
                  type="number"
                  min={1}
                  max={30}
                  value={p.resolution_sla_days}
                  onChange={(e) =>
                    update(p.value, {
                      resolution_sla_days: Math.min(30, Math.max(1, Number(e.target.value) || 1)),
                    })
                  }
                />
              </td>
              <td>
                <Switch checked={p.enabled} onCheckedChange={(v) => update(p.value, { enabled: v })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* --------------------------- limits and approvals -------------------------- */

function LimitsTab({ cfg, actor }: { cfg: Cfg; actor: string }) {
  const t = cfg.thresholds;
  function patch(p: Parameters<typeof setThresholds>[0]) {
    setThresholds(p);
    logAudit({ actor, action: "admin_threshold_updated", case_id: null, details: p as Record<string, unknown> });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-3 font-semibold">Approval limits</h3>
        <label className="mb-1 block text-sm font-medium">Auto-approval redress ceiling (INR)</label>
        <Input
          type="number"
          min={0}
          step={500}
          value={t.auto_approve_ceiling}
          onChange={(e) => patch({ auto_approve_ceiling: Math.max(0, Number(e.target.value) || 0) })}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Any case whose calculated redress exceeds this value is forced into the HITL queue.
        </p>

        <label className="mb-1 mt-4 block text-sm font-medium">Acknowledgement SLA (working days)</label>
        <Input
          type="number"
          min={1}
          max={5}
          value={t.ack_sla_days}
          onChange={(e) => patch({ ack_sla_days: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })}
        />
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Mandatory human review</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {["S1", "S2", "S3", "S4"].map((s) => {
            const on = t.mandatory_review_severities.includes(s);
            return (
              <button
                key={s}
                onClick={() =>
                  patch({
                    mandatory_review_severities: on
                      ? t.mandatory_review_severities.filter((x) => x !== s)
                      : [...t.mandatory_review_severities, s],
                  })
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">Force review on regulatory markers</div>
            <div className="text-xs text-muted-foreground">Fraud, vulnerability, conduct or unauthorised markers.</div>
          </div>
          <Switch checked={t.force_review_on_markers} onCheckedChange={(v) => patch({ force_review_on_markers: v })} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          These settings are applied by the grievance officer agent on every new case, including simulated arrivals.
        </p>
      </Card>
    </div>
  );
}

/* --------------------------- policy administration ------------------------- */

function PolicyTab({ cfg, actor }: { cfg: Cfg; actor: string }) {
  const [openDoc, setOpenDoc] = useState<string | null>(POLICY_DB[0]?.doc_id ?? null);
  return (
    <div className="space-y-3">
      <Card>
        <p className="text-sm text-muted-foreground">
          Withdrawing a document removes it from the calculator's accepted policy versions. Editing a numeric rule
          parameter changes the money the redress engine computes on the next case — every change is written to the
          audit trail.
        </p>
      </Card>
      {POLICY_DB.map((doc) => {
        const open = openDoc === doc.doc_id;
        const overridden = Object.keys(cfg.overrides.rules).some((id) => doc.rules.some((r) => r.rule_id === id));
        return (
          <Card key={doc.doc_id}>
            <div className="flex flex-wrap items-center gap-3">
              <button className="flex-1 text-left" onClick={() => setOpenDoc(open ? null : doc.doc_id)}>
                <div className="font-semibold">{doc.title}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {doc.doc_id} · v{doc.version} · {doc.issuer}
                </div>
              </button>
              {overridden && <Chip tone="warning">Locally amended</Chip>}
              <Chip tone={doc.approved ? "success" : "neutral"}>{doc.approved ? "Approved" : "Withdrawn"}</Chip>
              <Switch
                checked={doc.approved}
                onCheckedChange={(v) => {
                  setDocApproved(doc.doc_id, v);
                  logAudit({
                    actor,
                    action: v ? "admin_policy_approved" : "admin_policy_withdrawn",
                    case_id: null,
                    details: { doc_id: doc.doc_id },
                  });
                }}
              />
            </div>

            {open && (
              <div className="mt-3 space-y-3 border-t pt-3">
                {doc.rules.map((rule) => {
                  const numeric = Object.entries(rule.params).filter(([, v]) => typeof v === "number") as [
                    string,
                    number,
                  ][];
                  return (
                    <div key={rule.rule_id} className="rounded-lg border p-3">
                      <div className="text-sm font-medium">{rule.label}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {rule.rule_id} · {rule.clause_id} · {rule.formula}
                      </div>
                      {numeric.length === 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground">No numeric parameters — narrative rule.</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-3">
                          {numeric.map(([k, v]) => (
                            <label key={k} className="text-xs">
                              <span className="mb-1 block font-medium">{k}</span>
                              <Input
                                className="h-8 w-32"
                                type="number"
                                value={v}
                                onChange={(e) => {
                                  const next = Number(e.target.value);
                                  if (Number.isNaN(next)) return;
                                  setRuleParam(rule.rule_id, k, next);
                                  logAudit({
                                    actor,
                                    action: "admin_policy_param_updated",
                                    case_id: null,
                                    details: { rule: rule.rule_id, param: k, value: next },
                                  });
                                }}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
