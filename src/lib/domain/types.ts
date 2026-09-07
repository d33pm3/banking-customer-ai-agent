export type Channel = "mock_branch_webform" | "mock_email" | "mock_digital_webform";
export type Classification = "complaint" | "request" | "query" | "ambiguous";
export type Severity = "S1" | "S2" | "S3" | "S4" | "pending_human";
export type AgentName = "branch_level" | "email_contact" | "digital_desk" | "gho";

export type CaseStatus =
  | "NEW"
  | "RECEIVED"
  | "VALIDATED"
  | "CLASSIFIED"
  | "TRIAGED"
  | "INVESTIGATING"
  | "DECISION_DRAFTED"
  | "QA_REVIEW"
  | "HITL_REQUIRED"
  | "EMAIL_READY"
  | "CLOSED_DEMO"
  | "RCA_CAPA_FLAGGED"
  | "ERROR_SAFE_HOLD"
  | "PRIVACY_REDACTION_HOLD";

export interface Allegation {
  id: string;
  text: string;
  risk: "low" | "medium" | "high";
}

export interface DeadlineInfo {
  date: string;
  source_rule: string;
  calculated_by: string;
  severity: Severity;
  days: number;
}

export interface RedressComponent {
  label: string;
  amount: number;
  rule: string;
}

export interface RedressWorking {
  label: string;
  amount: number;
  rule: string;
  formula: string;
  working: string;
}

export interface RedressEstimate {
  event_type: string;
  product?: string | undefined;
  amount_claimed: number;
  calculated_amount: number;
  currency: "INR";
  components: RedressComponent[];
  workings?: RedressWorking[] | undefined;
  rules_applied?: { rule_id: string; clause: string; label: string; formula: string }[] | undefined;
  citations?: string[] | undefined;
  basis: string;
  policy_version: string;
  binding: false;
  requires_approval: boolean;
  note: string;
}

export type ResolutionDecision =
  | "uphold"
  | "partially_uphold"
  | "reject"
  | "refer_human"
  | "information_only";

export interface ResolutionDraft {
  decision: ResolutionDecision;
  rationale: string;
  next_actions: string[];
  draft_reply: string;
}

export interface AgentOutput {
  case_id: string;
  agent: AgentName;
  sub_agent: string;
  classification: Classification;
  allegations: Allegation[];
  regulatory_markers: string[];
  severity: Severity;
  deadline: DeadlineInfo | null;
  evidence_index: { ref: string; type: string; status: string }[];
  recommendation: string;
  citations: string[];
  confidence: number;
  pii_detected: boolean;
  refusal_applied: boolean;
  refusal_reason?: string | null | undefined;
  duplicate_of?: string | null | undefined;
  hitl_required?: boolean | undefined;
  tool_calls?: ToolCall[] | undefined;
  redress?: RedressEstimate | null | undefined;
  resolution?: ResolutionDraft | null | undefined;
  log_safe_summary: string;
}


export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  result: unknown;
  at: string;
}

export interface Trace {
  trace_id: string;
  case_id: string;
  event_at: string;
  state_before: CaseStatus | null;
  state_after: CaseStatus;
  actor: string;
  reason: string;
}

export interface HITLDecision {
  decision: "approved" | "overridden";
  reviewer: string;
  comment: string;
  alternative?: string | undefined;
  at: string;
}

export interface ExpectedResult {
  classification?: Classification | undefined;
  route?: string | undefined;
  refusal?: boolean | undefined;
  refusal_reason?: string | undefined;
  tool?: string | undefined;
  state?: CaseStatus | undefined;
  hitl?: boolean | undefined;
  severity?: Severity | undefined;
  deadline_days?: number | null | undefined;
  regulatory_markers?: string[] | undefined;
  duplicate_of?: string | undefined;
  ambiguous?: boolean | undefined;
  tool_result?: string | undefined;
}

export interface CaseRecord {
  case_id: string;
  source_channel: Channel;
  received_at: string;
  customer_token: string;
  language: string;
  product: string;
  narrative: string;
  incident_date: string | null;
  attachment_refs: string[];
  authority_status: string;
  consent_status: string;
  expected?: ExpectedResult | undefined;

  status: CaseStatus;
  raw_input_hash: string;
  classification: Classification | null;
  severity: Severity | null;
  deadline: DeadlineInfo | null;
  assigned_agent: AgentName | null;
  hitl_required: boolean;
  hitl_decision?: HITLDecision | null | undefined;
  agent_outputs: AgentOutput[];
  traces: Trace[];
  pii_detected: boolean;
  refusal_reason: string | null;
  duplicate_of: string | null;
  processing_ms: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  starred?: boolean | undefined;
}

export type Role = "branch" | "cc" | "digital" | "gho" | "hitl" | "admin";

export interface User {
  user_id: string;
  role: Role;
  display_name: string;
  view_filter: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  case_id: string | null;
  details: Record<string, unknown>;
  ip: string;
}
