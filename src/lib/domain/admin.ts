/**
 * Administration configuration store.
 *
 * Everything an administrator can change at runtime lives here: staff and roles,
 * branches, product configuration, approval thresholds and policy overrides.
 * All of it is persisted in localStorage and read back by the live workflow
 * engine, so an admin change immediately affects how new cases are handled.
 */
import { useCallback, useEffect, useState } from "react";
import { PRODUCTS } from "./catalog";
import { POLICY_DB, refreshPolicyVersions } from "./policy";
import { USERS } from "./seed";
import type { Role } from "./types";

const KEY_STAFF = "acrs.admin.staff.v1";
const KEY_BRANCHES = "acrs.admin.branches.v1";
const KEY_PRODUCTS = "acrs.admin.products.v1";
const KEY_THRESHOLDS = "acrs.admin.thresholds.v1";
const KEY_POLICY = "acrs.admin.policy.v1";

export interface StaffRecord {
  user_id: string;
  display_name: string;
  role: Role;
  branch_code: string;
  email: string;
  active: boolean;
  view_filter: string;
}

export interface BranchRecord {
  code: string;
  name: string;
  region: string;
  ifsc: string;
  active: boolean;
}

export interface ProductRecord {
  value: string;
  label: string;
  group: string;
  enabled: boolean;
  ack_sla_days: number;
  resolution_sla_days: number;
}

export interface Thresholds {
  /** redress at or below this value may auto-approve without a human */
  auto_approve_ceiling: number;
  /** severities that always require human review */
  mandatory_review_severities: string[];
  /** fraud / vulnerability markers always force human review */
  force_review_on_markers: boolean;
  /** acknowledgement SLA in working days */
  ack_sla_days: number;
}

export interface PolicyOverrides {
  docs: Record<string, { approved?: boolean }>;
  rules: Record<string, { params: Record<string, number> }>;
}

export const ROLE_LABEL: Record<Role, string> = {
  branch: "Branch Level agent",
  cc: "Contact Centre agent",
  digital: "Digital Desk agent",
  gho: "Grievance Handling Officer",
  hitl: "HITL reviewer / Compliance",
  admin: "System administrator",
};

export const ROLE_CAPABILITIES: Record<Role, string[]> = {
  branch: ["Own branch cases", "Workbench decisions", "Routing"],
  cc: ["Contact centre cases", "Workbench decisions", "Routing"],
  digital: ["Digital channel cases", "Workbench decisions", "Routing"],
  gho: ["All cases", "Investigation", "Redress calculation", "Reports"],
  hitl: ["HITL queue", "Approve / override", "Audit"],
  admin: ["Everything", "User & role management", "Policy administration"],
};

const DEFAULT_BRANCHES: BranchRecord[] = [
  { code: "FBD-001", name: "Faridabad Sector 16 (Main)", region: "North", ifsc: "SBFB0000001", active: true },
  { code: "FBD-002", name: "Faridabad NIT", region: "North", ifsc: "SBFB0000002", active: true },
  { code: "FBD-003", name: "Ballabgarh", region: "North", ifsc: "SBFB0000003", active: true },
  { code: "HO-CENTRAL", name: "Head Office — Central Operations", region: "Head office", ifsc: "SBFB0000100", active: true },
  { code: "HO-GRV", name: "Head Office — Grievance Cell", region: "Head office", ifsc: "SBFB0000101", active: true },
];

function branchForRole(role: Role, index: number): string {
  if (role === "gho" || role === "hitl") return "HO-GRV";
  if (role === "admin") return "HO-CENTRAL";
  return DEFAULT_BRANCHES[index % 3]!.code;
}

const DEFAULT_THRESHOLDS: Thresholds = {
  auto_approve_ceiling: 5000,
  mandatory_review_severities: ["S1", "S2"],
  force_review_on_markers: true,
  ack_sla_days: 1,
};

const DEFAULT_SLA: Record<string, number> = {
  upi: 7,
  cards: 10,
  deposit: 14,
  loan: 21,
  cheque: 14,
  deceased_claim: 15,
  other: 30,
};

/* ------------------------------ persistence ------------------------------- */

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function isBrowser() {
  return typeof window !== "undefined";
}
function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota — ignore */
  }
  emit();
}

/* --------------------------------- getters -------------------------------- */

export function defaultStaff(): StaffRecord[] {
  return USERS.map((u, i) => ({
    user_id: u.user_id,
    display_name: u.display_name,
    role: u.role,
    branch_code: branchForRole(u.role, i),
    email: `${u.user_id}@statebankoffaridabad.demo`,
    active: true,
    view_filter: u.view_filter,
  }));
}

export function getStaff(): StaffRecord[] {
  const stored = read<StaffRecord[] | null>(KEY_STAFF, null);
  if (stored && stored.length) return stored;
  const seeded = defaultStaff();
  write(KEY_STAFF, seeded);
  return seeded;
}

export function setStaff(rows: StaffRecord[]) {
  write(KEY_STAFF, rows);
}

export function upsertStaff(row: StaffRecord) {
  const rows = getStaff();
  const i = rows.findIndex((r) => r.user_id === row.user_id);
  if (i >= 0) rows[i] = row;
  else rows.push(row);
  setStaff(rows);
}

export function removeStaff(userId: string) {
  setStaff(getStaff().filter((r) => r.user_id !== userId));
}

export function isStaffActive(userId: string): boolean {
  const row = getStaff().find((r) => r.user_id === userId);
  return row ? row.active : true;
}

export function getBranches(): BranchRecord[] {
  const stored = read<BranchRecord[] | null>(KEY_BRANCHES, null);
  if (stored && stored.length) return stored;
  write(KEY_BRANCHES, DEFAULT_BRANCHES);
  return DEFAULT_BRANCHES;
}

export function setBranches(rows: BranchRecord[]) {
  write(KEY_BRANCHES, rows);
}

export function defaultProducts(): ProductRecord[] {
  return PRODUCTS.map((p) => ({
    value: p.value,
    label: p.label,
    group: p.group,
    enabled: true,
    ack_sla_days: 1,
    resolution_sla_days: DEFAULT_SLA[p.value] ?? 30,
  }));
}

export function getProducts(): ProductRecord[] {
  const stored = read<ProductRecord[] | null>(KEY_PRODUCTS, null);
  if (stored && stored.length) return stored;
  const seeded = defaultProducts();
  write(KEY_PRODUCTS, seeded);
  return seeded;
}

export function setProducts(rows: ProductRecord[]) {
  write(KEY_PRODUCTS, rows);
}

export function enabledProducts(): ProductRecord[] {
  return getProducts().filter((p) => p.enabled);
}

export function getThresholds(): Thresholds {
  return { ...DEFAULT_THRESHOLDS, ...read<Partial<Thresholds>>(KEY_THRESHOLDS, {}) };
}

export function setThresholds(patch: Partial<Thresholds>) {
  write(KEY_THRESHOLDS, { ...getThresholds(), ...patch });
}

/* ---------------------------- policy overrides ---------------------------- */

export function getPolicyOverrides(): PolicyOverrides {
  return read<PolicyOverrides>(KEY_POLICY, { docs: {}, rules: {} });
}

export function setPolicyOverrides(next: PolicyOverrides) {
  write(KEY_POLICY, next);
  applyPolicyOverrides();
}

/** Mutates the in-memory POLICY_DB so the redress calculator uses admin values. */
export function applyPolicyOverrides() {
  const ov = getPolicyOverrides();
  for (const doc of POLICY_DB) {
    const docOv = ov.docs[doc.doc_id];
    if (docOv && typeof docOv.approved === "boolean") doc.approved = docOv.approved;
    for (const rule of doc.rules) {
      const ruleOv = ov.rules[rule.rule_id];
      if (!ruleOv) continue;
      for (const [k, v] of Object.entries(ruleOv.params)) {
        if (typeof rule.params[k] === "number" || rule.params[k] === undefined) rule.params[k] = v;
      }
    }
  }
  refreshPolicyVersions();
  emit();
}

export function setRuleParam(ruleId: string, key: string, value: number) {
  const ov = getPolicyOverrides();
  const existing = ov.rules[ruleId]?.params ?? {};
  ov.rules[ruleId] = { params: { ...existing, [key]: value } };
  setPolicyOverrides(ov);
}

export function setDocApproved(docId: string, approved: boolean) {
  const ov = getPolicyOverrides();
  ov.docs[docId] = { ...ov.docs[docId], approved };
  setPolicyOverrides(ov);
}

export function resetPolicyOverrides() {
  if (isBrowser()) window.localStorage.removeItem(KEY_POLICY);
  // reload the module defaults by reapplying an empty override set
  window.location.reload();
}

export function resetAdminConfig() {
  if (!isBrowser()) return;
  [KEY_STAFF, KEY_BRANCHES, KEY_PRODUCTS, KEY_THRESHOLDS, KEY_POLICY].forEach((k) =>
    window.localStorage.removeItem(k),
  );
  window.location.reload();
}

/* ---------------------------------- hooks --------------------------------- */

export function useAdminConfig() {
  const [tick, setTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    setHydrated(true);
    listeners.add(refresh);
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  return {
    hydrated,
    tick,
    staff: hydrated ? getStaff() : [],
    branches: hydrated ? getBranches() : [],
    products: hydrated ? getProducts() : [],
    thresholds: hydrated ? getThresholds() : DEFAULT_THRESHOLDS,
    overrides: hydrated ? getPolicyOverrides() : { docs: {}, rules: {} },
    refresh,
  };
}

/** Called once on app boot so policy edits survive a reload. */
export function bootstrapAdmin() {
  if (!isBrowser()) return;
  applyPolicyOverrides();
}
