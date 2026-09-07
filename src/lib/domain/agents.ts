import type {
  Allegation,
  AgentOutput,
  CaseRecord,
  Classification,
  DeadlineInfo,
  RedressEstimate,
  ResolutionDraft,
  Severity,
  ToolCall,
} from "./types";
import { EVIDENCE } from "./seed";
import { computeRedress, searchPolicy, POLICY_BY_ID } from "./policy";
import { getProducts, getThresholds } from "./admin";

/* ------------------------------- redaction ------------------------------- */

const PII_PATTERNS: [RegExp, string][] = [
  [/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, "[ACCOUNT_REDACTED]"],
  [/\b\d{12}\b/g, "[ACCOUNT_REDACTED]"],
  [/\b\d{10}\b/g, "[PHONE_REDACTED]"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL_REDACTED]"],
  [/\bmy name is [A-Z][a-z]+(?: [A-Z][a-z]+)?/g, "my name is [NAME_REDACTED]"],
];

export function redactText(text: string): string {
  if (!text) return text;
  return PII_PATTERNS.reduce((acc, [re, rep]) => acc.replace(re, rep), text);
}

export function detectPII(text: string): boolean {
  if (!text) return false;
  return PII_PATTERNS.some((p) => new RegExp(p[0].source, "g").test(text));
}

/* --------------------------------- tools --------------------------------- */

export class ToolError extends Error {}

const EVIDENCE_BY_CASE = Object.fromEntries(EVIDENCE.map((e) => [e.case_id, e]));

export function evidenceAmountFor(caseId: string): number {
  const e = EVIDENCE_BY_CASE[caseId] as { amount?: number } | undefined;
  return typeof e?.amount === "number" ? e.amount : 0;
}

export function getMockCaseEvidence(caseId: string) {
  const e = EVIDENCE_BY_CASE[caseId];
  if (!e) throw new ToolError(`No evidence found for case ${caseId}`);
  return {
    evidence_id: e.evidence_id,
    case_id: e.case_id,
    type: e.type,
    status: e.status,
    risk_level: e.risk_level ?? "normal",
    summary: e.summary ?? "Evidence available",
  };
}

/** Pull an INR amount out of free text: "Rs. 4,500", "INR 2500", "₹ 999.50". */
export function extractAmount(text: string): number {
  const m = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!m?.[1]) return 0;
  const v = Number(m[1].replaceAll(",", ""));
  return Number.isFinite(v) ? v : 0;
}

/** Pull an elapsed-days figure: "15 days", "3 weeks". */
export function extractDelayDays(text: string): number {
  const w = text.match(/(\d{1,3})\s*weeks?/i);
  if (w?.[1]) return Math.min(90, Number(w[1]) * 7);
  const d = text.match(/(\d{1,3})\s*days?/i);
  if (d?.[1]) return Math.min(90, Number(d[1]));
  return 0;
}

export function inferEventType(narrative: string, markers: string[], product: string): string | null {
  const n = narrative.toLowerCase();
  if (markers.includes("conduct")) return "conduct";
  if (markers.includes("fraud") || n.includes("unauthoris") || n.includes("unauthoriz"))
    return "unauthorised_transaction";
  if (markers.includes("failed_payment") || product === "upi" || n.includes("failed transaction"))
    return "failed_payment";
  if (n.includes("charge") || n.includes("fee") || n.includes("debited twice")) return "fee";
  if (n.includes("delay") || n.includes("not received") || n.includes("pending")) return "delay";
  return null;
}

/** Which approved policy document prices this event type. */
export function policyVersionFor(eventType: string, product: string): string {
  if (eventType === "failed_payment") return "RBI-TAT-2019";
  if (eventType === "unauthorised_transaction") return "RBI-LIAB-2017";
  if (eventType === "conduct") return "RBI-FPC-RECOVERY";
  if (eventType === "fee") return product === "loan" ? "RBI-PENAL-2023" : "RBI-CARD-MD-2022";
  if (eventType === "delay" && product === "deceased_claim") return "RBI-CS-DECEASED";
  if (eventType === "delay" && (product === "cheque" || product === "deposit")) return "RBI-CHQ-COLL";
  return "BANK-CCP-2026";
}

/**
 * Deterministic, non-binding redress engine backed by the real policy database.
 * Never moves money — it returns an estimate that always requires human approval.
 */
export function calculateNonbindingRedress(args: {
  case_id: string;
  event_type: string;
  product?: string;
  policy_version: string;
  amount?: number;
  delay_days?: number;
  reported_after_days?: number;
  account_type?: "bsbd" | "savings" | "current";
  severity?: string;
}): RedressEstimate & { case_id: string } {
  try {
    return computeRedress({
      case_id: args.case_id,
      event_type: args.event_type,
      product: args.product ?? "other",
      policy_version: args.policy_version,
      ...(args.amount === undefined ? {} : { amount: args.amount }),
      ...(args.delay_days === undefined ? {} : { delay_days: args.delay_days }),
      ...(args.reported_after_days === undefined ? {} : { reported_after_days: args.reported_after_days }),
      ...(args.account_type === undefined ? {} : { account_type: args.account_type }),
      ...(args.severity === undefined ? {} : { severity: args.severity }),
    });
  } catch (e) {
    throw new ToolError((e as Error).message);
  }
}

export function retrieveApprovedPolicy(query: string, product = "all") {
  return searchPolicy(query, product).map((d) => ({
    doc_id: d.doc_id,
    title: d.title,
    reference: d.reference,
    content: d.summary,
    approved: d.approved,
  }));
}

export const TOOLS = [
  { name: "get_mock_case_evidence", description: "Read-only mock evidence lookup by case id." },
  { name: "calculate_nonbinding_redress", description: "Deterministic non-binding redress estimate. Never moves money." },
  { name: "retrieve_approved_policy", description: "Retrieve approved knowledge-base policy documents." },
];

/* ------------------------------ classification ---------------------------- */

const STRONG_COMPLAINT = [
  "failed", "wrong", "unauthorised", "unauthorized", "abusive", "error", "not resolved",
  "still no", "not satisfied", "fraud", "charged", "debited twice", "passed away",
  "legal heir", "harass", "delayed", "twice",
];
const SERVICE_REQUEST = [
  "cheque book", "statement for", "account statement", "address change", "update status",
  "new card", "request a", "need my",
];
const QUERY_WORDS = [
  "what is", "what should", "how to", "rule for", "circular", "information required",
  "procedure", "tell me", "explain", "share the", "which document",
];
const SOFT_COMPLAINT = ["not received", "no refund", "issue", "problem", "complain", "delay"];

export function classify(narrative: string): Classification {
  const n = narrative.toLowerCase();
  const has = (list: string[]) => list.some((w) => n.includes(w));
  if (has(STRONG_COMPLAINT)) return "complaint";
  if (has(SERVICE_REQUEST)) return "request";
  if (has(QUERY_WORDS)) return "query";
  if (has(SOFT_COMPLAINT)) return "complaint";
  return "ambiguous";
}

export function detectMarkers(narrative: string, product: string): string[] {
  const n = narrative.toLowerCase();
  const m: string[] = [];
  if (n.includes("failed") && (n.includes("upi") || n.includes("transaction") || n.includes("imps") || n.includes("payment")))
    m.push("failed_payment");
  if (n.includes("unauthorised") || n.includes("unauthorized") || n.includes("fraud")) m.push("fraud");
  if (n.includes("recovery agent") || n.includes("abusive") || n.includes("harass")) m.push("conduct");
  if (n.includes("deceased") || n.includes("passed away") || n.includes("nominee") || product === "deceased_claim")
    m.push("vulnerability");
  return Array.from(new Set(m));
}

export function detectRefusal(narrative: string): { reason: string | null } {
  const n = narrative.toLowerCase();
  if (/\btransfer\b/.test(n) && /\b(money|amount|inr|rs\.?|funds)\b/.test(n))
    return { reason: "money_movement" };
  if (n.includes("legal advice") || n.includes("sue the bank")) return { reason: "legal_advice" };
  if (n.includes("ignore all previous") || (n.includes("ignore") && n.includes("instruction")))
    return { reason: "instruction_override" };
  if (n.includes("delete all records")) return { reason: "data_deletion_request" };
  if (detectPII(narrative) && (n.includes("balance") || n.includes("transactions") || n.includes("tell me")))
    return { reason: "pii_lookup" };
  return { reason: null };
}

function extractAllegations(narrative: string): Allegation[] {
  return narrative
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((s, i) => ({
      id: `A${i + 1}`,
      text: redactText(s + "."),
      risk: /abusive|fraud|unauthoris|harass/i.test(s) ? "high" : /failed|not received|delay/i.test(s) ? "medium" : "low",
    })) as Allegation[];
}

/* ------------------------------ intake agents ----------------------------- */

interface IntakeCtx {
  case_id: string;
  narrative: string;
  product: string;
}

function baseIntake(
  ctx: IntakeCtx,
  agent: AgentOutput["agent"],
  subAgent: string,
  confidence: number,
): AgentOutput {
  const refusal = detectRefusal(ctx.narrative);
  let classification = classify(ctx.narrative);
  const markers = detectMarkers(ctx.narrative, ctx.product);
  const pii = detectPII(ctx.narrative);

  if (refusal.reason === "money_movement" || refusal.reason === "instruction_override")
    classification = "ambiguous";

  const highRisk = markers.some((m) => ["fraud", "conduct"].includes(m));
  const severity: Severity = refusal.reason
    ? "pending_human"
    : highRisk
      ? "S1"
      : classification === "complaint"
        ? "S3"
        : "S4";

  return {
    case_id: ctx.case_id,
    agent,
    sub_agent: subAgent,
    classification,
    allegations: extractAllegations(ctx.narrative),
    regulatory_markers: markers,
    severity,
    deadline: null,
    evidence_index: [],
    recommendation: refusal.reason
      ? "hitl"
      : classification === "complaint"
        ? "investigate"
        : "information_response",
    citations: agent === "digital_desk" ? ["BANK-CCP-2026"] : [],
    confidence,
    pii_detected: pii,
    refusal_applied: Boolean(refusal.reason),
    refusal_reason: refusal.reason,
    resolution: refusal.reason
      ? {
          decision: "refer_human" as const,
          rationale: `Intake guardrail engaged (${refusal.reason}); the agent is not authorised to act.`,
          next_actions: ["Route to human reviewer", "Do not action the request automatically"],
          draft_reply:
            "Dear Customer,\n\nWe are unable to action this request automatically. A member of our team will review it and respond to you.\n\nGrievance Handling Office",
        }
      : classification === "complaint"
        ? null
        : {
            decision: "information_only" as const,
            rationale: `Handled as a ${classification} at intake — no complaint registered.`,
            next_actions: ["Send information response with approved policy extract"],
            draft_reply: `Dear Customer,\n\nThank you for your ${classification} regarding ${ctx.product.replaceAll("_", " ")}. We have shared the approved guidance that applies to your query. If you would like this raised as a formal complaint, please reply and we will register it.\n\nCustomer Service`,
          },
    log_safe_summary: `${agent}: ${classification}, product=${ctx.product}`,
  };
}

export function branchLevelAgent(c: IntakeCtx): AgentOutput {
  return baseIntake(c, "branch_level", "intake_normaliser", 0.85);
}

export function emailContactAgent(c: IntakeCtx): AgentOutput {
  return baseIntake(c, "email_contact", "email_parser", 0.8);
}

export function digitalDeskAgent(c: IntakeCtx): AgentOutput {
  const out = baseIntake(c, "digital_desk", "digital_triage", 0.75);
  const dup = c.narrative.match(/UCN-[A-Z]+-\d{3}/);
  out.duplicate_of = dup ? dup[0] : null;
  return out;
}

/* --------------------------------- GHO ------------------------------------ */

const DEADLINE_DAYS: Record<string, number> = { S1: 3, S2: 7, S3: 15, S4: 18 };

export function ghoAgent(
  caseData: { case_id: string; narrative: string; product: string; received_at: string; incident_date?: string | null },
  prior: AgentOutput,
): AgentOutput {
  const toolCalls: ToolCall[] = [];
  const now = new Date().toISOString();
  const n = caseData.narrative.toLowerCase();

  // Tool 1: evidence
  try {
    const ev = getMockCaseEvidence(caseData.case_id);
    toolCalls.push({ tool: "get_mock_case_evidence", args: { case_id: caseData.case_id }, ok: true, result: ev, at: now });
  } catch (e) {
    toolCalls.push({
      tool: "get_mock_case_evidence",
      args: { case_id: caseData.case_id },
      ok: false,
      result: (e as Error).message,
      at: now,
    });
  }

  // Tool 2: policy retrieval
  const policy = retrieveApprovedPolicy(caseData.product, caseData.product);
  toolCalls.push({ tool: "retrieve_approved_policy", args: { product: caseData.product }, ok: true, result: policy.map((p) => p.doc_id), at: now });

  let refusalReason = prior.refusal_reason ?? null;
  let refusal = prior.refusal_applied;

  // Tool 3: non-binding redress. Runs for any money-impacting event, and
  // strictly re-validates when the customer explicitly asks for a calculation.
  const explicitAsk = n.includes("calculate refund") || n.includes("compensation for");
  const claimedAmount = extractAmount(caseData.narrative) || evidenceAmountFor(caseData.case_id);
  const narrativeDelay = extractDelayDays(caseData.narrative);
  const inferred = inferEventType(caseData.narrative, prior.regulatory_markers, caseData.product);
  const eventType = explicitAsk
    ? n.includes("transfer_funds")
      ? "transfer_funds"
      : (inferred ?? "failed_payment")
    : inferred;
  const policyVersion = n.includes("no policy version") ? "" : policyVersionFor(eventType ?? "delay", caseData.product);
  const reportedAfterDays = reportingLagDays(caseData.incident_date ?? null, caseData.received_at);
  // Delay measured from the incident when the narrative does not state one.
  const delayDays = narrativeDelay || reportedAfterDays;

  let redress: RedressEstimate | null = null;
  if (eventType && (explicitAsk || claimedAmount > 0 || delayDays > 0 || eventType === "conduct")) {
    try {
      const r = calculateNonbindingRedress({
        case_id: caseData.case_id,
        event_type: eventType,
        product: caseData.product,
        policy_version: policyVersion,
        amount: explicitAsk && claimedAmount === 0 ? 2500 : claimedAmount,
        delay_days: delayDays,
        reported_after_days: reportedAfterDays,
        severity: prior.severity,
      });
      redress = r;
      toolCalls.push({
        tool: "calculate_nonbinding_redress",
        args: { event_type: eventType, product: caseData.product, policy_version: policyVersion, amount: r.amount_claimed, delay_days: delayDays, reported_after_days: reportedAfterDays },
        ok: true,
        result: r,
        at: now,
      });
    } catch (e) {
      toolCalls.push({
        tool: "calculate_nonbinding_redress",
        args: { event_type: eventType, policy_version: policyVersion },
        ok: false,
        result: `VALIDATION_ERROR: ${(e as Error).message}`,
        at: now,
      });
      if (explicitAsk) {
        refusal = true;
        refusalReason = "invalid_tool_call";
      }
    }
  }

  const citations = retrievePolicyCitations(caseData.product, caseData.narrative);
  const markers = prior.regulatory_markers;

  const severity: Severity = refusal
    ? "pending_human"
    : markers.some((m) => ["fraud", "conduct", "unauthorised"].includes(m))
      ? "S1"
      : markers.some((m) => ["failed_payment", "vulnerability"].includes(m)) ||
          ["deceased_claim", "loan"].includes(caseData.product)
        ? "S2"
        : prior.classification === "complaint"
          ? "S3"
          : "S4";

  const deadline: DeadlineInfo | null =
    severity === "pending_human" ? null : buildDeadline(caseData.received_at, severity, caseData.product);

  const thresholds = getThresholds();
  const ceilingBreached = (redress?.calculated_amount ?? 0) > thresholds.auto_approve_ceiling;
  const markerReview =
    thresholds.force_review_on_markers &&
    markers.some((m) => ["fraud", "vulnerability", "conduct", "unauthorised"].includes(m));
  const hitlRequired =
    refusal ||
    ceilingBreached ||
    Boolean(markerReview) ||
    thresholds.mandatory_review_severities.includes(severity) ||
    prior.classification === "complaint" ||
    prior.classification === "ambiguous";

  const evidenceCall = toolCalls.find((t) => t.tool === "get_mock_case_evidence");
  const evidenceOk = evidenceCall?.ok;
  const evidence = evidenceOk ? (evidenceCall!.result as { summary?: string; status?: string }) : null;

  const resolution = buildResolution({
    classification: prior.classification,
    severity,
    markers,
    refusalReason,
    redress,
    citations,
    deadline,
    hitlRequired,
    evidenceSummary: evidence?.summary ?? null,
  });

  return {
    case_id: caseData.case_id,
    agent: "gho",
    sub_agent: "evidence_redress",
    classification: prior.classification,
    allegations: prior.allegations,
    regulatory_markers: markers,
    severity,
    deadline,
    evidence_index: evidenceOk
      ? [{ ref: `E-${caseData.case_id}`, type: "mock_evidence", status: (evidence?.status as string) ?? "available" }]
      : [],
    recommendation: hitlRequired ? "hitl" : redress && redress.calculated_amount > 0 ? "redress_offer" : "investigate",
    citations,
    confidence: citations.length ? 0.9 : 0.6,
    pii_detected: prior.pii_detected,
    refusal_applied: refusal,
    refusal_reason: refusalReason,
    hitl_required: hitlRequired,
    tool_calls: toolCalls,
    redress,
    resolution,
    log_safe_summary: `GHO: ${prior.classification}, severity=${severity}, redress=INR ${redress?.calculated_amount ?? 0}`,
  };
}

/** Deterministic decision writer — turns findings into a decision + customer reply. */
function buildResolution(input: {
  classification: Classification;
  severity: Severity;
  markers: string[];
  refusalReason: string | null;
  redress: RedressEstimate | null;
  citations: string[];
  deadline: DeadlineInfo | null;
  hitlRequired: boolean;
  evidenceSummary: string | null;
}): ResolutionDraft {
  const { classification, severity, markers, refusalReason, redress, citations, deadline, hitlRequired } = input;
  const amount = redress?.calculated_amount ?? 0;

  const decision: ResolutionDraft["decision"] = refusalReason
    ? "refer_human"
    : classification !== "complaint"
      ? "information_only"
      : amount > 0
        ? markers.includes("fraud")
          ? "partially_uphold"
          : "uphold"
        : hitlRequired
          ? "refer_human"
          : "reject";

  const rationaleParts = [
    `Classified as ${classification} at severity ${severity}.`,
    input.evidenceSummary ? `Evidence: ${input.evidenceSummary}.` : "No linked evidence record was found.",
    markers.length ? `Regulatory markers: ${markers.join(", ")}.` : "No regulatory markers triggered.",
    amount > 0
      ? `Non-binding redress estimate INR ${amount} (${redress?.event_type}).`
      : "No monetary redress computed under the approved policy.",
    refusalReason ? `Guardrail engaged: ${refusalReason}.` : "",
    deadline ? `Response due ${new Date(deadline.date).toLocaleDateString()} (${deadline.days} days).` : "",
  ].filter(Boolean);

  const nextActions: string[] = [];
  if (refusalReason) nextActions.push("Route to human reviewer — action outside agent authority");
  if (markers.includes("fraud")) nextActions.push("Open fraud investigation and freeze disputed channel");
  if (markers.includes("conduct")) nextActions.push("Refer agent conduct to compliance for RCA/CAPA");
  if (markers.includes("vulnerability")) nextActions.push("Apply vulnerable-customer handling and assign a named officer");
  if (amount > 0) nextActions.push(`Seek approval for non-binding redress of INR ${amount}`);
  if (classification !== "complaint") nextActions.push("Send information response with cited policy extracts");
  if (hitlRequired) nextActions.push("Await human-in-the-loop approval before issuing the reply");
  if (!nextActions.length) nextActions.push("Issue closure reply and record outcome");

  const body =
    classification !== "complaint"
      ? `Thank you for contacting us. We have reviewed your ${classification} and share the relevant approved guidance below. No complaint has been registered; tell us if you would like one raised.`
      : amount > 0
        ? `We have reviewed your complaint and our findings support your account of events. A non-binding redress estimate of INR ${amount} has been calculated under ${redress?.policy_version}. This amount is subject to internal approval before any credit is made.`
        : `We have reviewed your complaint. Based on the evidence and approved policy currently available, no monetary redress is payable, and the case has been referred for further review where required.`;

  const draft_reply = [
    "Dear Customer,",
    "",
    body,
    "",
    `Case severity: ${severity}${deadline ? ` — we will respond fully by ${new Date(deadline.date).toLocaleDateString()}.` : "."}`,
    `Policy references: ${citations.join(", ")}.`,
    "",
    "This communication is generated by an assistive system and reviewed by a grievance officer before it becomes final.",
    "",
    "Grievance Handling Office",
  ].join("\n");

  return { decision, rationale: rationaleParts.join(" "), next_actions: nextActions, draft_reply };
}


function retrievePolicyCitations(product: string, narrative: string): string[] {
  const docs = searchPolicy(narrative, product, 3).map((d) => d.doc_id);
  const set = new Set<string>(docs);
  set.add("RBI-IOS-2021");
  set.add("BANK-CCP-2026");
  return Array.from(set);
}

/** Working days between the incident and the bank receiving the complaint. */
export function reportingLagDays(incidentDate: string | null, receivedAt: string): number {
  if (!incidentDate) return 0;
  const a = new Date(incidentDate).getTime();
  const b = new Date(receivedAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.min(60, Math.round((b - a) / 86400000));
}

/** Clause-level citation text for a policy document id. */
export function policyTitle(docId: string): string {
  return POLICY_BY_ID[docId]?.title ?? docId;
}

export function buildDeadline(receivedAt: string, severity: Severity, product?: string): DeadlineInfo {
  const severityDays = DEADLINE_DAYS[severity] ?? 18;
  // An administrator can set a tighter resolution SLA per product; the tighter
  // of the two always wins so configuration can never weaken the statutory clock.
  const productCfg = product ? getProducts().find((p) => p.value === product) : undefined;
  const days = productCfg ? Math.min(severityDays, productCfg.resolution_sla_days) : severityDays;
  const base = new Date(receivedAt);
  const d = new Date((isNaN(base.getTime()) ? new Date() : base).getTime() + days * 86400000);
  return {
    date: d.toISOString(),
    source_rule: `Severity ${severity} = ${days} days (RBI-IOS-2021 §12; statutory 30-day limit applies)`,
    calculated_by: "deterministic-rule-engine",
    severity,
    days,
  };
}

export function caseHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16).padStart(8, "0");
}

export type { CaseRecord };
