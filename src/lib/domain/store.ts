import { useCallback, useEffect, useState } from "react";
import { processCase } from "./engine";
import { DEMO_CASES, USERS, generateExtraCases, type RawCase } from "./seed";
import type {
  AgentName,
  AuditEntry,
  CaseRecord,
  CaseStatus,
  Classification,
  HITLDecision,
  Severity,
  User,
} from "./types";
import { buildDeadline } from "./agents";
import { getStaff } from "./admin";

const KEY_CASES = "acrs.cases.v1";
const KEY_AUDIT = "acrs.audit.v1";
const KEY_USER = "acrs.session.v1";
const KEY_RECENT = "acrs.recent.v1";

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
    /* quota — ignore for demo */
  }
  emit();
}

/* --------------------------------- seeding -------------------------------- */

export function ensureSeeded(): CaseRecord[] {
  const existing = read<CaseRecord[] | null>(KEY_CASES, null);
  if (existing && existing.length) return existing;
  const raws: RawCase[] = [...DEMO_CASES, ...generateExtraCases(24)];
  const cases = raws.map(processCase);
  write(KEY_CASES, cases);
  const audit: AuditEntry[] = cases.flatMap((c) =>
    c.traces.map((t, i) => ({
      id: `${t.trace_id}-${i}`,
      at: t.event_at,
      actor: t.actor,
      action: `state_${t.state_after.toLowerCase()}`,
      case_id: c.case_id,
      details: { from: t.state_before, to: t.state_after, reason: t.reason },
      ip: "localhost",
    })),
  );
  write(KEY_AUDIT, audit.slice(-800));
  return cases;
}

export function getCases(): CaseRecord[] {
  return read<CaseRecord[]>(KEY_CASES, []);
}

export function setCases(cases: CaseRecord[]) {
  write(KEY_CASES, cases);
}

export function getAudit(): AuditEntry[] {
  return read<AuditEntry[]>(KEY_AUDIT, []);
}

export function logAudit(entry: Omit<AuditEntry, "id" | "at" | "ip"> & { at?: string }) {
  const audit = getAudit();
  audit.push({
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    at: entry.at ?? new Date().toISOString(),
    actor: entry.actor,
    action: entry.action,
    case_id: entry.case_id,
    details: entry.details,
    ip: "localhost",
  });
  write(KEY_AUDIT, audit.slice(-2000));
}

export function resetDemoData() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY_CASES);
  window.localStorage.removeItem(KEY_AUDIT);
  ensureSeeded();
}

/* --------------------------------- session -------------------------------- */

export function getSession(): User | null {
  return read<User | null>(KEY_USER, null);
}

export function login(userId: string): User | null {
  const staff = getStaff().find((s) => s.user_id === userId);
  if (staff && !staff.active) {
    logAudit({ actor: userId, action: "login_refused", case_id: null, details: { reason: "account disabled" } });
    return null;
  }
  const base = USERS.find((u) => u.user_id === userId) ?? null;
  const user: User | null = base
    ? { ...base, role: staff?.role ?? base.role, display_name: staff?.display_name ?? base.display_name }
    : staff
      ? { user_id: staff.user_id, role: staff.role, display_name: staff.display_name, view_filter: staff.view_filter }
      : null;
  if (user) {
    write(KEY_USER, user);
    logAudit({ actor: user.user_id, action: "login", case_id: null, details: { role: user.role } });
  }
  return user;
}

export function logout() {
  const u = getSession();
  if (u) logAudit({ actor: u.user_id, action: "logout", case_id: null, details: {} });
  if (isBrowser()) window.localStorage.removeItem(KEY_USER);
  emit();
}

export function getRecent(): string[] {
  return read<string[]>(KEY_RECENT, []);
}

export function pushRecent(caseId: string) {
  const list = getRecent().filter((c) => c !== caseId);
  list.unshift(caseId);
  write(KEY_RECENT, list.slice(0, 5));
}

/* -------------------------------- mutations ------------------------------- */

export function updateCase(caseId: string, patch: Partial<CaseRecord>) {
  const cases = getCases().map((c) =>
    c.case_id === caseId ? { ...c, ...patch, updated_at: new Date().toISOString() } : c,
  );
  setCases(cases);
}

export function addCase(raw: RawCase, actor = "system") {
  const record = processCase(raw);
  return addCaseRecord(record, actor);
}

/** Insert an already-processed (possibly partial) case record. */
export function addCaseRecord(record: CaseRecord, actor = "system") {
  const cases = getCases();
  cases.unshift(record);
  setCases(cases);
  logAudit({
    actor,
    action: "case_created",
    case_id: record.case_id,
    details: { channel: record.source_channel, classification: record.classification, severity: record.severity },
  });
  return record;
}

/** Replace (or insert) a case record wholesale — used by the live simulator. */
export function upsertCase(record: CaseRecord) {
  const cases = getCases();
  const idx = cases.findIndex((c) => c.case_id === record.case_id);
  if (idx >= 0) cases[idx] = record;
  else cases.unshift(record);
  setCases(cases);
  return record;
}


/** Manually route a case to an agent (human routing desk). */
export function assignCase(caseId: string, agent: AgentName, actor: string, note = "") {
  const cases = getCases();
  const idx = cases.findIndex((c) => c.case_id === caseId);
  if (idx < 0) return null;
  const c = cases[idx]!;
  const now = new Date().toISOString();
  const previous = c.assigned_agent;
  const updated: CaseRecord = {
    ...c,
    assigned_agent: agent,
    updated_at: now,
    traces: [
      ...c.traces,
      {
        trace_id: `TRC-${c.case_id}-ROUTE-${c.traces.length}`,
        case_id: c.case_id,
        event_at: now,
        state_before: c.status,
        state_after: c.status,
        actor,
        reason: `Manually routed to ${agent}${note ? ` — ${note}` : ""}`,
      },
    ],
  };
  cases[idx] = updated;
  setCases(cases);
  logAudit({
    actor,
    action: "case_routed",
    case_id: caseId,
    details: { from: previous, to: agent, note },
  });
  return updated;
}

/* ------------------------- customer / manual intake ----------------------- */

export interface IntakeForm {
  channel: CaseRecord["source_channel"];
  product: string;
  narrative: string;
  customer_token?: string;
  language?: string;
  incident_date?: string | null;
  amount?: number | null;
  attachment_refs?: string[];
  authority_status?: string;
  consent_status?: string;
}

let intakeSeq = 0;

/** Build a raw case from a webform / intake submission. */
export function buildRawFromForm(form: IntakeForm, prefix = "UCN-WEB"): RawCase {
  intakeSeq += 1;
  const stamp = `${Date.now().toString(36).slice(-5).toUpperCase()}${intakeSeq}`;
  const amountLine =
    form.amount && form.amount > 0 ? ` The disputed amount is INR ${Math.round(form.amount)}.` : "";
  return {
    case_id: `${prefix}-${stamp}`,
    source_channel: form.channel,
    received_at: new Date().toISOString(),
    customer_token: form.customer_token?.trim() || `CUS-${stamp}`,
    language: form.language ?? "en",
    product: form.product,
    narrative: `${form.narrative.trim()}${amountLine}`,
    incident_date: form.incident_date ?? null,
    attachment_refs: form.attachment_refs ?? [],
    authority_status: form.authority_status ?? "confirmed",
    consent_status: form.consent_status ?? "consent-given",
  };
}

/* ------------------------- agent workbench decisions ---------------------- */

export interface AgentDecisionInput {
  stage: "intake" | "gho";
  classification: Classification;
  severity: Severity;
  redress_amount?: number;
  decision?: string;
  note: string;
  hitl_required?: boolean;
}

function appendTrace(
  c: CaseRecord,
  next: CaseStatus,
  actor: string,
  reason: string,
  offset: number,
): CaseRecord["traces"][number] {
  return {
    trace_id: `TRC-${c.case_id}-M${c.traces.length + offset}`,
    case_id: c.case_id,
    event_at: new Date(Date.now() + offset).toISOString(),
    state_before: c.status,
    state_after: next,
    actor,
    reason,
  };
}

/**
 * A human agent records their own classification / severity / redress and the
 * case moves to the next pipeline state automatically.
 */
export function submitAgentDecision(caseId: string, input: AgentDecisionInput, actor: string) {
  const cases = getCases();
  const idx = cases.findIndex((c) => c.case_id === caseId);
  if (idx < 0) return null;
  const c = cases[idx]!;
  const now = new Date().toISOString();
  const traces = [...c.traces];
  let status: CaseStatus = c.status;
  const step = (next: CaseStatus, reason: string) => {
    traces.push(appendTrace({ ...c, status, traces }, next, actor, reason, traces.length));
    status = next;
  };

  const INTAKE_STAGES: CaseStatus[] = ["NEW", "RECEIVED", "VALIDATED", "CLASSIFIED"];
  const GHO_STAGES: CaseStatus[] = ["TRIAGED", "INVESTIGATING", "DECISION_DRAFTED", "QA_REVIEW"];
  // Guard: reject decisions submitted against a state the stage cannot act on.
  const allowed = input.stage === "intake" ? INTAKE_STAGES : GHO_STAGES;
  if (!allowed.includes(status)) return null;

  const isComplaint = input.classification === "complaint" || input.classification === "ambiguous";
  let assigned = c.assigned_agent;

  if (input.stage === "intake") {
    if (status === "NEW") step("RECEIVED", "Case received at desk");
    if (status === "RECEIVED") step("VALIDATED", "Schema and consent validated by agent");
    if (status === "VALIDATED")
      step("CLASSIFIED", `Agent classification: ${input.classification} (${input.severity})`);
    if (isComplaint) {
      if (status === "CLASSIFIED") step("TRIAGED", "Routed to Grievance Handling Officer");
      if (status === "TRIAGED") step("INVESTIGATING", "GHO investigation opened");
      assigned = "gho";
    } else {
      if (status === "CLASSIFIED") step("TRIAGED", "Information response path");
      if (status === "TRIAGED") step("EMAIL_READY", "Information response drafted by agent");
      step("CLOSED_DEMO", "Closed after information response");
    }
  } else {
    if (status === "TRIAGED") step("INVESTIGATING", "GHO investigation opened");
    if (status === "INVESTIGATING")
      step(
        "DECISION_DRAFTED",
        `GHO decision: ${input.decision ?? "uphold"} · redress INR ${Math.round(input.redress_amount ?? 0)}`,
      );
    if (status === "DECISION_DRAFTED") step("QA_REVIEW", "QA review of drafted decision");
    if (status === "QA_REVIEW") {
      if (input.hitl_required ?? true) step("HITL_REQUIRED", "Human-in-the-loop approval requested");
      else {
        step("EMAIL_READY", "Auto-approved by officer authority");
        step("CLOSED_DEMO", "Closed after officer approval");
      }
    }
    assigned = "gho";
  }

  const outputs = [...c.agent_outputs];
  const last = outputs[outputs.length - 1];
  if (last) {
    outputs[outputs.length - 1] = {
      ...last,
      classification: input.classification,
      severity: input.severity,
      log_safe_summary: `${actor} (manual): ${input.classification} / ${input.severity}`,
      ...(input.stage === "gho" && last.redress
        ? {
            redress: {
              ...last.redress,
              calculated_amount: Math.round(input.redress_amount ?? last.redress.calculated_amount),
              components: [
                ...last.redress.components,
                ...(input.redress_amount !== undefined &&
                Math.round(input.redress_amount) !== last.redress.calculated_amount
                  ? [
                      {
                        label: `Officer adjustment by ${actor}`,
                        amount: Math.round(input.redress_amount) - last.redress.calculated_amount,
                        rule: "BANK-CCP-2026 §5 — officer discretion",
                      },
                    ]
                  : []),
              ],
            },
          }
        : {}),
      ...(last.resolution
        ? {
            resolution: {
              ...last.resolution,
              ...(input.decision ? { decision: input.decision as never } : {}),
              rationale: `${last.resolution.rationale} Officer note: ${input.note}`,
            },
          }
        : {}),
    };
  }

  const deadline =
    input.severity === "pending_human" ? c.deadline : buildDeadline(c.received_at, input.severity, c.product);

  cases[idx] = {
    ...c,
    status,
    classification: input.classification,
    severity: input.severity,
    deadline,
    assigned_agent: assigned,
    hitl_required: status === "HITL_REQUIRED",
    agent_outputs: outputs,
    traces,
    updated_at: now,
    closed_at: status === "CLOSED_DEMO" ? now : c.closed_at,
  };
  setCases(cases);
  logAudit({
    actor,
    action: input.stage === "intake" ? "agent_intake_decision" : "agent_gho_decision",
    case_id: caseId,
    details: {
      classification: input.classification,
      severity: input.severity,
      redress: input.redress_amount ?? null,
      decision: input.decision ?? null,
      note: input.note,
      to: status,
    },
  });
  return cases[idx]!;
}

export function applyHitlDecision(
  caseId: string,
  decision: HITLDecision,
) {
  const cases = getCases();
  const idx = cases.findIndex((c) => c.case_id === caseId);
  if (idx < 0) return;
  const c = cases[idx]!;
  // Guard: only a case actually parked for human review may be decided here.
  if (c.status !== "HITL_REQUIRED") return;
  const now = new Date().toISOString();
  const traces = [
    ...c.traces,
    {
      trace_id: `TRC-${c.case_id}-H${c.traces.length}`,
      case_id: c.case_id,
      event_at: now,
      state_before: c.status,
      state_after: "EMAIL_READY" as const,
      actor: decision.reviewer,
      reason: decision.decision === "approved" ? "HITL approved" : `HITL override: ${decision.alternative ?? ""}`,
    },
    {
      trace_id: `TRC-${c.case_id}-H${c.traces.length + 1}`,
      case_id: c.case_id,
      event_at: now,
      state_before: "EMAIL_READY" as const,
      state_after: "CLOSED_DEMO" as const,
      actor: "system",
      reason: "Demo closed after human review",
    },
  ];
  cases[idx] = {
    ...c,
    status: "CLOSED_DEMO",
    hitl_required: false,
    hitl_decision: decision,
    traces,
    closed_at: now,
    updated_at: now,
  };
  setCases(cases);
  logAudit({
    actor: decision.reviewer,
    action: decision.decision === "approved" ? "hitl_approved" : "hitl_overridden",
    case_id: caseId,
    details: { comment: decision.comment, alternative: decision.alternative ?? null },
  });
}

/* ---------------------------------- hooks --------------------------------- */

export function useStoreVersion() {
  const [, setV] = useState(0);
  useEffect(() => {
    const l = () => setV((v) => v + 1);
    listeners.add(l);
    const onStorage = () => l();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
}

export function useHydratedCases(): { cases: CaseRecord[]; ready: boolean; refresh: () => void } {
  const [cases, setLocal] = useState<CaseRecord[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setLocal(getCases());
  }, []);

  useEffect(() => {
    setLocal(ensureSeeded());
    setReady(true);
    const l = () => setLocal(getCases());
    listeners.add(l);
    window.addEventListener("storage", l);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", l);
    };
  }, []);

  return { cases, ready, refresh };
}

export function useSession(): { user: User | null; ready: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setUser(getSession());
    setReady(true);
    const l = () => setUser(getSession());
    listeners.add(l);
    window.addEventListener("storage", l);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", l);
    };
  }, []);
  return { user, ready };
}

export function useAudit(): AuditEntry[] {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  useEffect(() => {
    setAudit(getAudit());
    const l = () => setAudit(getAudit());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return audit;
}

/** Role-based case visibility. */
export function visibleCases(cases: CaseRecord[], user: User | null): CaseRecord[] {
  if (!user) return [];
  switch (user.role) {
    case "branch":
      return cases.filter((c) => c.source_channel === "mock_branch_webform");
    case "cc":
      return cases.filter((c) => c.source_channel === "mock_email");
    case "digital":
      return cases.filter((c) => c.source_channel === "mock_digital_webform");
    case "gho":
      return cases.filter((c) => c.classification === "complaint" || c.assigned_agent === "gho");
    case "hitl":
      return cases.filter((c) => c.status === "HITL_REQUIRED" || c.hitl_decision);
    default:
      return cases;
  }
}

export { USERS };
