import {
  branchLevelAgent,
  caseHash,
  digitalDeskAgent,
  emailContactAgent,
  ghoAgent,
} from "./agents";
import type { RawCase } from "./seed";
import type { AgentName, CaseRecord, CaseStatus, Trace } from "./types";

export const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  NEW: ["RECEIVED"],
  RECEIVED: ["VALIDATED", "PRIVACY_REDACTION_HOLD"],
  VALIDATED: ["CLASSIFIED"],
  CLASSIFIED: ["TRIAGED"],
  TRIAGED: ["INVESTIGATING", "EMAIL_READY"],
  INVESTIGATING: ["DECISION_DRAFTED"],
  DECISION_DRAFTED: ["QA_REVIEW"],
  QA_REVIEW: ["HITL_REQUIRED", "EMAIL_READY"],
  HITL_REQUIRED: ["EMAIL_READY", "RCA_CAPA_FLAGGED"],
  EMAIL_READY: ["CLOSED_DEMO"],
  CLOSED_DEMO: ["RCA_CAPA_FLAGGED"],
  ERROR_SAFE_HOLD: ["RECEIVED", "HITL_REQUIRED"],
  PRIVACY_REDACTION_HOLD: ["RECEIVED", "HITL_REQUIRED"],
  RCA_CAPA_FLAGGED: [],
};

export const ALL_STATUSES = Object.keys(VALID_TRANSITIONS) as CaseStatus[];

export function agentForChannel(channel: string): AgentName {
  if (channel === "mock_branch_webform") return "branch_level";
  if (channel === "mock_email") return "email_contact";
  return "digital_desk";
}

export const AGENT_LABEL: Record<AgentName, string> = {
  branch_level: "Branch Level",
  email_contact: "Contact Centre",
  digital_desk: "Digital Desk",
  gho: "GHO",
};

export const AGENT_ICON: Record<AgentName, string> = {
  branch_level: "🏦",
  email_contact: "📧",
  digital_desk: "💻",
  gho: "⚖️",
};

export const CHANNEL_LABEL: Record<string, string> = {
  mock_branch_webform: "Branch",
  mock_email: "Email",
  mock_digital_webform: "Digital",
};

export const CHANNEL_ICON: Record<string, string> = {
  mock_branch_webform: "🏦",
  mock_email: "📧",
  mock_digital_webform: "💻",
};

/** Deterministic full-workflow execution for one raw case. */
export function processCase(raw: RawCase): CaseRecord {
  const started = Date.now();
  const traces: Trace[] = [];
  let seq = 0;
  let state: CaseStatus = "NEW";
  const baseTime = new Date(raw.received_at).getTime() || Date.now();

  const push = (next: CaseStatus, actor: string, reason: string) => {
    if (!VALID_TRANSITIONS[state].includes(next)) return false;
    seq += 1;
    traces.push({
      trace_id: `TRC-${raw.case_id}-${String(seq).padStart(3, "0")}`,
      case_id: raw.case_id,
      event_at: new Date(baseTime + seq * 30000).toISOString(),
      state_before: state,
      state_after: next,
      actor,
      reason,
    });
    state = next;
    return true;
  };

  traces.push({
    trace_id: `TRC-${raw.case_id}-000`,
    case_id: raw.case_id,
    event_at: new Date(baseTime).toISOString(),
    state_before: null,
    state_after: "NEW",
    actor: "system",
    reason: "Case created",
  });

  push("RECEIVED", "system", "Case received");

  const agentName = agentForChannel(raw.source_channel);
  const ctx = { case_id: raw.case_id, narrative: raw.narrative, product: raw.product };
  const intake =
    agentName === "branch_level"
      ? branchLevelAgent(ctx)
      : agentName === "email_contact"
        ? emailContactAgent(ctx)
        : digitalDeskAgent(ctx);

  const outputs = [intake];
  let hitlRequired = false;
  let assigned: AgentName = agentName;

  if (intake.pii_detected && intake.refusal_reason === "pii_lookup") {
    push("PRIVACY_REDACTION_HOLD", agentName, "PII detected in narrative — privacy hold (KB-PRIVACY-001)");
    push("HITL_REQUIRED", agentName, "Privacy hold requires human review");
    hitlRequired = true;
  } else {
    push("VALIDATED", "system", "Schema and consent validated");
    push("CLASSIFIED", agentName, "Intake classification");

    if (intake.classification === "complaint" || intake.refusal_applied || intake.classification === "ambiguous") {
      push("TRIAGED", "gho", "Triage to Grievance Handling Officer");
      push("INVESTIGATING", "gho", "GHO investigation started");
      const gho = ghoAgent({ ...ctx, received_at: raw.received_at, incident_date: raw.incident_date }, intake);
      outputs.push(gho);
      assigned = "gho";
      hitlRequired = Boolean(gho.hitl_required);
      push("DECISION_DRAFTED", "gho", "Decision drafted (non-binding)");
      push("QA_REVIEW", "gho.qa_escalation", "QA review");
      if (hitlRequired) {
        push("HITL_REQUIRED", "gho.qa_escalation", "Human review required (KB-HITL-001)");
      } else {
        push("EMAIL_READY", "gho", "Auto-approved, reply drafted");
        push("CLOSED_DEMO", "system", "Demo closed");
      }
    } else {
      push("TRIAGED", agentName, "Triage — information response path");
      push("EMAIL_READY", agentName, "Information response drafted");
      push("CLOSED_DEMO", "system", "Demo closed");
    }
  }

  const last = outputs[outputs.length - 1]!;
  const nowIso = new Date().toISOString();

  return {
    ...raw,
    status: state,
    raw_input_hash: caseHash(raw.narrative),
    classification: last.classification,
    severity: last.severity,
    deadline: last.deadline,
    assigned_agent: assigned,
    hitl_required: hitlRequired,
    hitl_decision: null,
    agent_outputs: outputs,
    traces,
    pii_detected: outputs.some((o) => o.pii_detected),
    refusal_reason: last.refusal_reason ?? null,
    duplicate_of: intake.duplicate_of ?? null,
    processing_ms: Math.max(400, Date.now() - started + seq * 90),
    created_at: raw.received_at,
    updated_at: nowIso,
    closed_at: (state as string) === "CLOSED_DEMO" ? new Date(baseTime + seq * 30000).toISOString() : null,
    starred: false,
  };
}

export interface TestResult {
  case_id: string;
  field: string;
  expected: string;
  actual: string;
  pass: boolean;
}

export function evaluateCase(record: CaseRecord): TestResult[] {
  const e = record.expected;
  if (!e) return [];
  const rows: TestResult[] = [];
  const add = (field: string, expected: unknown, actual: unknown) => {
    if (expected === undefined) return;
    rows.push({
      case_id: record.case_id,
      field,
      expected: String(expected),
      actual: String(actual),
      pass: String(expected) === String(actual),
    });
  };
  add("classification", e.classification, record.classification);
  add("severity", e.severity, record.severity);
  add("hitl", e.hitl, record.hitl_required);
  add("refusal", e.refusal, Boolean(record.refusal_reason));
  if (e.refusal_reason) add("refusal_reason", e.refusal_reason, record.refusal_reason);
  if (e.duplicate_of) add("duplicate_of", e.duplicate_of, record.duplicate_of);
  return rows;
}
