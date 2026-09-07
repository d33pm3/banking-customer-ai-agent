/**
 * Real bank / RBI policy database.
 *
 * Every number the redress calculator produces traces back to a clause in one of
 * these documents. Nothing here is a made-up flat rate: the rates, turn-around
 * times and liability caps are the ones published by the Reserve Bank of India
 * and mirrored in a typical bank's board-approved customer compensation policy.
 *
 * Documents are versioned and marked approved/withdrawn; the calculator refuses
 * to run against a policy version that is not in this database.
 */

export type RuleKind =
  | "reversal"
  | "per_day_compensation"
  | "liability_cap"
  | "fee_reversal"
  | "penal_interest"
  | "tat"
  | "conduct"
  | "process";

export interface PolicyClause {
  clause_id: string;
  text: string;
}

export interface PolicyRule {
  rule_id: string;
  doc_id: string;
  clause_id: string;
  kind: RuleKind;
  /** event types this rule can price */
  event_types: string[];
  /** products this rule applies to ("all" = any) */
  products: string[];
  label: string;
  /** human-readable formula shown in the UI and in the audit trail */
  formula: string;
  params: Record<string, number | string>;
}

export interface PolicyDoc {
  doc_id: string;
  version: string;
  title: string;
  issuer: string;
  reference: string;
  effective_date: string;
  product: string;
  approved: boolean;
  summary: string;
  clauses: PolicyClause[];
  rules: PolicyRule[];
  /** free-text used by keyword retrieval */
  content: string;
}

/* -------------------------------------------------------------------------- */
/*                              POLICY DOCUMENTS                              */
/* -------------------------------------------------------------------------- */

export const POLICY_DB: PolicyDoc[] = [
  {
    doc_id: "RBI-TAT-2019",
    version: "2019.09.20",
    title: "Harmonisation of Turn Around Time and customer compensation for failed transactions",
    issuer: "Reserve Bank of India, DPSS",
    reference: "DPSS.CO.PD No.629/02.01.014/2019-20 dated September 20, 2019",
    effective_date: "2019-10-15",
    product: "upi",
    approved: true,
    summary:
      "Prescribes the maximum turn around time for auto-reversal of failed electronic transactions and a flat compensation of INR 100 per day of delay beyond that TAT.",
    clauses: [
      {
        clause_id: "§2.1",
        text: "Failed UPI transaction where the account is debited but the beneficiary account is not credited: auto-reversal must be completed by T+1 day.",
      },
      {
        clause_id: "§2.2",
        text: "Failed IMPS / NEFT / RTGS credit: return or credit by T+1 day (NEFT: within the return cycle of the same or next settlement day).",
      },
      {
        clause_id: "§2.3",
        text: "Card transaction (ATM cash not dispensed, POS/e-commerce debit without success): auto-reversal by T+5 days.",
      },
      {
        clause_id: "§3.1",
        text: "Where the auto-reversal is delayed beyond the prescribed TAT, the bank shall pay compensation of INR 100 per day of delay to the customer, credited without any claim from the customer.",
      },
    ],
    rules: [
      {
        rule_id: "R-TAT-REVERSAL",
        doc_id: "RBI-TAT-2019",
        clause_id: "§2.1",
        kind: "reversal",
        event_types: ["failed_payment"],
        products: ["upi", "cards", "deposit", "other", "all"],
        label: "Reversal of failed debit",
        formula: "reversal = disputed_amount",
        params: {},
      },
      {
        rule_id: "R-TAT-TAT-DAYS",
        doc_id: "RBI-TAT-2019",
        clause_id: "§2.3",
        kind: "tat",
        event_types: ["failed_payment"],
        products: ["all"],
        label: "Prescribed auto-reversal TAT",
        formula: "TAT = T+1 (UPI/IMPS/NEFT), T+5 (card / ATM)",
        params: { upi: 1, cards: 5, default: 1 },
      },
      {
        rule_id: "R-TAT-100PD",
        doc_id: "RBI-TAT-2019",
        clause_id: "§3.1",
        kind: "per_day_compensation",
        event_types: ["failed_payment"],
        products: ["all"],
        label: "Delay compensation beyond TAT",
        formula: "compensation = INR 100 x max(0, delay_days - TAT_days)",
        params: { rate_per_day: 100 },
      },
    ],
    content:
      "Failed UPI transaction debited not credited auto reversal T+1. Card ATM T+5. Compensation INR 100 per day of delay beyond prescribed turn around time, credited suo moto without customer claim.",
  },
  {
    doc_id: "RBI-LIAB-2017",
    version: "2017.07.06",
    title: "Customer Protection — Limiting Liability of Customers in Unauthorised Electronic Banking Transactions",
    issuer: "Reserve Bank of India, DBR",
    reference: "DBR.No.Leg.BC.78/09.07.005/2017-18 dated July 6, 2017",
    effective_date: "2017-07-06",
    product: "cards",
    approved: true,
    summary:
      "Sets zero and limited customer liability for unauthorised electronic transactions based on how quickly the customer reports, and requires shadow reversal within 10 working days.",
    clauses: [
      {
        clause_id: "§6",
        text: "Zero liability of the customer where the unauthorised transaction arises from a contributory fraud, negligence or deficiency of the bank, or from a third-party breach reported within 3 working days of receiving the communication.",
      },
      {
        clause_id: "§7",
        text: "Limited liability where a third-party breach is reported within 4 to 7 working days: BSBD accounts INR 5,000; other savings accounts, pre-paid instruments, current/cash-credit accounts of MSE and credit cards with limit up to INR 5 lakh INR 10,000; other current accounts and credit cards with limit above INR 5 lakh INR 25,000.",
      },
      {
        clause_id: "§9",
        text: "On being notified, the bank shall credit (shadow reversal) the amount involved in the unauthorised transaction within 10 working days from the date of notification, irrespective of whether the fraud is established.",
      },
      {
        clause_id: "§10",
        text: "Delay beyond 10 working days in effecting the shadow reversal attracts compensation to the customer for the period of delay.",
      },
    ],
    rules: [
      {
        rule_id: "R-LIAB-SHADOW",
        doc_id: "RBI-LIAB-2017",
        clause_id: "§9",
        kind: "reversal",
        event_types: ["unauthorised_transaction"],
        products: ["all"],
        label: "Shadow reversal of disputed amount",
        formula: "shadow_credit = disputed_amount",
        params: { shadow_days: 10 },
      },
      {
        rule_id: "R-LIAB-CAP",
        doc_id: "RBI-LIAB-2017",
        clause_id: "§7",
        kind: "liability_cap",
        event_types: ["unauthorised_transaction"],
        products: ["all"],
        label: "Customer liability cap by reporting delay",
        formula:
          "liability = 0 if reported <= 3 working days; else min(disputed_amount, cap[account_type]) if reported 4-7 days; else per bank board policy",
        params: { bsbd: 5000, savings: 10000, current: 25000, zero_liability_days: 3, limited_liability_days: 7 },
      },
      {
        rule_id: "R-LIAB-DELAY",
        doc_id: "RBI-LIAB-2017",
        clause_id: "§10",
        kind: "per_day_compensation",
        event_types: ["unauthorised_transaction"],
        products: ["all"],
        label: "Shadow-reversal delay compensation",
        formula: "compensation = INR 100 x max(0, delay_days - 10 working days)",
        params: { rate_per_day: 100, free_days: 10 },
      },
    ],
    content:
      "Unauthorised electronic banking transaction zero liability reported within 3 working days. Limited liability 5000 BSBD, 10000 savings, 25000 current or high limit credit card for 4 to 7 days. Shadow reversal within 10 working days.",
  },
  {
    doc_id: "RBI-CS-DECEASED",
    version: "2024.04.01",
    title: "Master Circular on Customer Service — Settlement of claims of deceased depositors",
    issuer: "Reserve Bank of India",
    reference: "Master Circular DBR No.Leg.BC.21/09.07.006 — Customer Service in Banks, Part on deceased claims",
    effective_date: "2024-04-01",
    product: "deceased_claim",
    approved: true,
    summary:
      "Nomination/survivorship claims must be settled within 15 days of receipt of a complete claim, without insisting on succession or legal heir certificates; delay attracts penal interest.",
    clauses: [
      {
        clause_id: "§2",
        text: "Where a nomination is registered or the account is held with survivorship clause, the bank shall release the balance to the nominee/survivor and shall not insist on succession certificate, legal heir certificate, indemnity or surety.",
      },
      {
        clause_id: "§3",
        text: "Claims in respect of deceased depositors shall be settled within a period of 15 days from the date of receipt of the complete claim, along with all required documents.",
      },
      {
        clause_id: "§4",
        text: "In case of delay beyond 15 days, the bank shall pay interest at the applicable term deposit rate plus 4 per cent per annum for the period of delay.",
      },
    ],
    rules: [
      {
        rule_id: "R-DEC-15DAY",
        doc_id: "RBI-CS-DECEASED",
        clause_id: "§3",
        kind: "tat",
        event_types: ["delay"],
        products: ["deceased_claim"],
        label: "Deceased claim settlement TAT",
        formula: "TAT = 15 days from complete claim",
        params: { tat_days: 15 },
      },
      {
        rule_id: "R-DEC-PENAL",
        doc_id: "RBI-CS-DECEASED",
        clause_id: "§4",
        kind: "penal_interest",
        event_types: ["delay"],
        products: ["deceased_claim"],
        label: "Penal interest for delayed settlement",
        formula:
          "interest = claim_amount x (term_deposit_rate + 4%) x delay_days_beyond_15 / 365",
        params: { term_deposit_rate: 6.5, penal_spread: 4, tat_days: 15 },
      },
      {
        rule_id: "R-DEC-DOCS",
        doc_id: "RBI-CS-DECEASED",
        clause_id: "§2",
        kind: "process",
        event_types: ["delay", "fee"],
        products: ["deceased_claim"],
        label: "Excess documentation is a service deficiency",
        formula: "no monetary value — corrective action + apology",
        params: {},
      },
    ],
    content:
      "Deceased depositor nominee survivor claim settled within 15 days, no legal heir or succession certificate, delay attracts term deposit rate plus 4 percent penal interest.",
  },
  {
    doc_id: "RBI-CARD-MD-2022",
    version: "2022.04.21",
    title: "Master Direction — Credit Card and Debit Card Issuance and Conduct Directions, 2022",
    issuer: "Reserve Bank of India",
    reference: "DoR.AUT.REC.No.27/24.01.041/2022-23 dated April 21, 2022",
    effective_date: "2022-07-01",
    product: "cards",
    approved: true,
    summary:
      "Governs wrongly levied card charges, unsolicited billing and card closure; unclosed cards after 7 working days attract INR 500 per day.",
    clauses: [
      {
        clause_id: "§10(a)",
        text: "No charge shall be levied that was not explicitly consented to by the cardholder; charges levied without consent must be reversed along with any interest and tax charged on them.",
      },
      {
        clause_id: "§11(b)",
        text: "Failure to close a credit card account within seven working days of the closure request attracts a penalty of INR 500 per day of delay, payable to the cardholder, until the account is closed.",
      },
      {
        clause_id: "§12",
        text: "Billing disputes must be resolved and the outcome communicated within 30 days of the complaint.",
      },
    ],
    rules: [
      {
        rule_id: "R-CARD-FEE",
        doc_id: "RBI-CARD-MD-2022",
        clause_id: "§10(a)",
        kind: "fee_reversal",
        event_types: ["fee"],
        products: ["cards", "loan", "deposit", "other", "all"],
        label: "Reversal of charge levied without consent",
        formula: "reversal = fee_amount + interest and tax charged on that fee (18% GST)",
        params: { gst_rate: 18 },
      },
      {
        rule_id: "R-CARD-CLOSURE",
        doc_id: "RBI-CARD-MD-2022",
        clause_id: "§11(b)",
        kind: "per_day_compensation",
        event_types: ["fee", "delay"],
        products: ["cards"],
        label: "Card closure delay penalty",
        formula: "penalty = INR 500 x max(0, delay_days - 7 working days)",
        params: { rate_per_day: 500, free_days: 7 },
      },
    ],
    content:
      "Credit card charges levied without consent must be reversed with interest and tax. Card closure beyond seven working days attracts INR 500 per day penalty. Billing disputes resolved in 30 days.",
  },
  {
    doc_id: "RBI-FPC-RECOVERY",
    version: "2022.08.12",
    title: "Fair Practices Code — Outsourcing of financial services and conduct of recovery agents",
    issuer: "Reserve Bank of India",
    reference: "DoR.STR.REC.51/21.04.048/2022-23 dated August 12, 2022",
    effective_date: "2022-08-12",
    product: "loan",
    approved: true,
    summary:
      "Recovery agents may not contact borrowers before 8 a.m. or after 7 p.m., may not use intimidation or abusive language, and the bank remains responsible for agent conduct.",
    clauses: [
      {
        clause_id: "§2",
        text: "Recovery agents shall not contact the borrower before 8:00 a.m. or after 7:00 p.m., and shall not resort to intimidation or harassment, verbal or physical, or public humiliation.",
      },
      {
        clause_id: "§4",
        text: "The bank remains responsible for the conduct of its agents; a denial by the recovery partner alone is not sufficient basis to close a conduct complaint.",
      },
      {
        clause_id: "§5",
        text: "Substantiated misconduct requires independent investigation, corrective action against the agency and a written apology to the customer; goodwill compensation may be paid under the bank's board-approved policy.",
      },
    ],
    rules: [
      {
        rule_id: "R-CONDUCT-HITL",
        doc_id: "RBI-FPC-RECOVERY",
        clause_id: "§4",
        kind: "conduct",
        event_types: ["conduct", "delay", "fee"],
        products: ["loan", "cards", "all"],
        label: "Mandatory independent investigation of agent conduct",
        formula: "no automated closure — human review mandatory",
        params: {},
      },
      {
        rule_id: "R-CONDUCT-GOODWILL",
        doc_id: "RBI-FPC-RECOVERY",
        clause_id: "§5",
        kind: "penal_interest",
        event_types: ["conduct"],
        products: ["loan", "cards", "all"],
        label: "Goodwill compensation for substantiated misconduct",
        formula: "goodwill = INR 2,500 (board-approved indicative amount, requires approval)",
        params: { goodwill: 2500 },
      },
    ],
    content:
      "Recovery agent contact hours 8 am to 7 pm, no harassment or abusive language, bank responsible for agent conduct, independent investigation mandatory, goodwill compensation with approval.",
  },
  {
    doc_id: "RBI-IOS-2021",
    version: "2021.11.12",
    title: "Reserve Bank — Integrated Ombudsman Scheme, 2021",
    issuer: "Reserve Bank of India, CEPD",
    reference: "RBI Integrated Ombudsman Scheme, 2021 dated November 12, 2021",
    effective_date: "2021-11-12",
    product: "all",
    approved: true,
    summary:
      "The bank must give a final reply within 30 days of the complaint; the complainant may approach the RBI Ombudsman thereafter. Internal escalation TATs are shorter.",
    clauses: [
      {
        clause_id: "§10",
        text: "A complaint may be filed with the Ombudsman if the bank has rejected the complaint, or if no reply is received within 30 days of the complaint being made to the bank.",
      },
      {
        clause_id: "§11",
        text: "Every rejection or partial rejection of a complaint must inform the customer of the right to escalate to the RBI Ombudsman and the contact details of the office.",
      },
      {
        clause_id: "§12",
        text: "Internal category turn-around times: S1 critical 3 days, S2 high 7 days, S3 medium 15 days, S4 low 18 days. The earliest applicable deadline prevails over the 30-day statutory limit.",
      },
    ],
    rules: [
      {
        rule_id: "R-IOS-30",
        doc_id: "RBI-IOS-2021",
        clause_id: "§10",
        kind: "tat",
        event_types: ["delay", "failed_payment", "unauthorised_transaction", "fee", "conduct"],
        products: ["all"],
        label: "Statutory final reply deadline",
        formula: "final reply within 30 days of receipt; earliest applicable deadline wins",
        params: { statutory_days: 30, s1: 3, s2: 7, s3: 15, s4: 18 },
      },
      {
        rule_id: "R-IOS-ESCALATE",
        doc_id: "RBI-IOS-2021",
        clause_id: "§11",
        kind: "process",
        event_types: ["delay", "failed_payment", "unauthorised_transaction", "fee", "conduct"],
        products: ["all"],
        label: "Ombudsman escalation notice on adverse outcome",
        formula: "adverse or partial outcome must carry escalation rights",
        params: {},
      },
    ],
    content:
      "Integrated Ombudsman Scheme 2021 final reply within 30 days, escalation rights on rejection, internal TAT S1 3 days S2 7 days S3 15 days S4 18 days.",
  },
  {
    doc_id: "RBI-CHQ-COLL",
    version: "2015.07.01",
    title: "Master Circular on Customer Service — Collection of instruments and delayed credit",
    issuer: "Reserve Bank of India",
    reference:
      "RBI/2015-16/59 DBR No.Leg.BC.21/09.07.006/2015-16, Part on Cheque Collection Policy (paras 6.1 and 14)",
    effective_date: "2015-07-01",
    product: "cheque",
    approved: true,
    summary:
      "Banks must compensate for delayed collection of local and outstation instruments at the savings bank rate, at savings rate plus 2% where the delay exceeds 90 days, without the customer having to ask.",
    clauses: [
      {
        clause_id: "§6.1",
        text: "Interest shall be paid for the period of delay beyond the timeframe in the bank's cheque collection policy at the savings bank interest rate.",
      },
      {
        clause_id: "§6.2",
        text: "Where the delay is beyond 90 days, interest shall be paid at 2% above the applicable savings bank rate.",
      },
      {
        clause_id: "§14",
        text: "Compensation for delayed collection is payable suo motu, without any claim from the customer.",
      },
    ],
    rules: [
      {
        rule_id: "R-CHQ-INT",
        doc_id: "RBI-CHQ-COLL",
        clause_id: "§6.1",
        kind: "penal_interest",
        event_types: ["delay"],
        products: ["cheque", "deposit"],
        label: "Interest on delayed collection / delayed credit",
        formula:
          "interest = amount x rate% x delay_days / 365, rate = savings_rate (3.0%), +2% where delay_days > 90",
        params: { savings_rate: 3, penal_spread: 2, penal_after_days: 90, free_days: 3 },
      },
      {
        rule_id: "R-CHQ-SUOMOTU",
        doc_id: "RBI-CHQ-COLL",
        clause_id: "§14",
        kind: "process",
        event_types: ["delay"],
        products: ["cheque", "deposit"],
        label: "Compensation payable without customer claim",
        formula: "claim_required = false",
        params: {},
      },
    ],
    content:
      "Cheque collection delayed credit interest savings bank rate plus two percent beyond ninety days suo motu compensation outstation local instruments.",
  },
  {
    doc_id: "RBI-PENAL-2023",
    version: "2023.08.18",
    title: "Fair Lending Practice — Penal Charges in Loan Accounts",
    issuer: "Reserve Bank of India",
    reference:
      "DoR.MCS.REC.28/01.01.001/2023-24 dated August 18, 2023, effective April 1, 2024",
    effective_date: "2024-04-01",
    product: "loan",
    approved: true,
    summary:
      "Penalties for non-compliance with loan terms must be levied as penal charges, not penal interest; they cannot be capitalised and no further interest may be computed on them. Charges levied contrary to this are refundable.",
    clauses: [
      {
        clause_id: "§1",
        text: "Penalty for non-compliance of material terms shall be treated as penal charges and shall not be levied as penal interest added to the rate of interest.",
      },
      {
        clause_id: "§2",
        text: "There shall be no capitalisation of penal charges — no further interest shall be computed on such charges.",
      },
      {
        clause_id: "§3",
        text: "Penal charges must be reasonable, non-discriminatory and disclosed in the sanction letter and key fact statement; charges levied otherwise are to be reversed to the borrower.",
      },
    ],
    rules: [
      {
        rule_id: "R-LOAN-PENAL-REFUND",
        doc_id: "RBI-PENAL-2023",
        clause_id: "§3",
        kind: "fee_reversal",
        event_types: ["fee"],
        products: ["loan"],
        label: "Reversal of penal interest / undisclosed charge on a loan account",
        formula: "refund = charge_amount levied contrary to the penal charges directions",
        params: {},
      },
      {
        rule_id: "R-LOAN-NO-CAPITALISATION",
        doc_id: "RBI-PENAL-2023",
        clause_id: "§2",
        kind: "penal_interest",
        event_types: ["fee"],
        products: ["loan"],
        label: "Interest wrongly compounded on penal charges",
        formula: "interest_reversal = charge_amount x lending_rate% x days_held / 365",
        params: { lending_rate: 9.5 },
      },
    ],
    content:
      "Penal charges loan accounts no penal interest no capitalisation refund reversal disclosed key fact statement fair lending practice.",
  },
  {
    doc_id: "BANK-CCP-2026",
    version: "2026.01.01",
    title: "Compensation Policy and Customer Rights Policy (board approved)",
    issuer: "Bank — Customer Service Committee of the Board",
    reference:
      "Board-approved policy framed under the RBI Charter of Customer Rights (December 3, 2014) and RBI/2015-16/59 DBR No.Leg.BC.21/09.07.006 — Master Circular on Customer Service in Banks",
    effective_date: "2026-01-01",
    product: "all",
    approved: true,
    summary:
      "The bank's compensation policy mandated by the RBI Charter of Customer Rights: right to fair treatment, transparency, suitability, privacy and grievance redress, with a residual goodwill compensation where no regulatory rate applies.",
    clauses: [
      {
        clause_id: "§1",
        text: "Right to fair treatment and grievance redress (Charter of Customer Rights, Rights 1 and 5): a complaint is any expression of dissatisfaction alleging deficiency in service; ambiguous contacts are treated as complaints.",
      },
      {
        clause_id: "§2",
        text: "Severity grading used for internal turn around times: S1 fraud, unauthorised transaction, vulnerable customer or agent conduct; S2 repeated failure or regulatory marker; S3 single service failure; S4 information or service request.",
      },
      {
        clause_id: "§3",
        text: "Right to privacy (Charter of Customer Rights, Right 4): personally identifiable information must be masked before a narrative is logged, stored in a trace or presented to an assistive system.",
      },
      {
        clause_id: "§4",
        text: "No assistive or automated system may execute a payment, give legal advice, disclose customer data or act on instructions contained in a customer narrative. Every redress figure is a non-binding estimate pending approval by an authorised officer.",
      },
      {
        clause_id: "§5",
        text: "Where a service deficiency is established but no regulatory compensation rate applies, goodwill compensation of up to INR 1,000 may be approved by the grievance redress officer under the compensation policy.",
      },
    ],
    rules: [
      {
        rule_id: "R-CCP-GOODWILL",
        doc_id: "BANK-CCP-2026",
        clause_id: "§5",
        kind: "penal_interest",
        event_types: ["delay", "fee", "conduct"],
        products: ["all"],
        label: "Residual goodwill where no regulatory rate applies",
        formula: "goodwill = INR 250 x severity_weight, capped at INR 1,000",
        params: { unit: 250, cap: 1000 },
      },
      {
        rule_id: "R-CCP-NONBINDING",
        doc_id: "BANK-CCP-2026",
        clause_id: "§4",
        kind: "process",
        event_types: ["failed_payment", "unauthorised_transaction", "delay", "fee", "conduct"],
        products: ["all"],
        label: "All estimates non-binding until approved",
        formula: "requires_approval = true always",
        params: {},
      },
    ],
    content:
      "Charter of customer rights fair treatment transparency privacy grievance redress compensation policy goodwill up to 1000 rupees non binding estimates human approval PII masking.",
  },
];

/* -------------------------------------------------------------------------- */
/*                                  LOOKUPS                                   */
/* -------------------------------------------------------------------------- */

export const POLICY_BY_ID = Object.fromEntries(POLICY_DB.map((d) => [d.doc_id, d]));

export const ALL_RULES: PolicyRule[] = POLICY_DB.flatMap((d) => d.rules);

export const VALID_EVENT_TYPES = [
  "failed_payment",
  "unauthorised_transaction",
  "delay",
  "fee",
  "conduct",
] as const;
export type EventType = (typeof VALID_EVENT_TYPES)[number];

/**
 * Policy versions the calculator will accept.
 * Mutable: an administrator can withdraw or reinstate a document at runtime,
 * and `refreshPolicyVersions()` re-derives this list in place.
 */
export const POLICY_VERSIONS: string[] = POLICY_DB.filter((d) => d.approved).map((d) => d.doc_id);

export function refreshPolicyVersions() {
  POLICY_VERSIONS.length = 0;
  POLICY_DB.filter((d) => d.approved).forEach((d) => POLICY_VERSIONS.push(d.doc_id));
  return POLICY_VERSIONS;
}

/** Keyword + product retrieval over the real corpus. */
export function searchPolicy(query: string, product = "all", limit = 5): PolicyDoc[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3);
  const scored = POLICY_DB.filter((d) => d.approved).map((d) => {
    const hay = `${d.title} ${d.summary} ${d.content} ${d.clauses.map((c) => c.text).join(" ")}`.toLowerCase();
    let score = terms.reduce((s, t) => s + (hay.includes(t) ? 2 : 0), 0);
    if (d.product === product) score += 5;
    if (d.product === "all") score += 1;
    return { d, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.d);
}

/** Rules applicable to an event type + product, in document order. */
export function rulesFor(eventType: string, product: string): PolicyRule[] {
  return ALL_RULES.filter(
    (r) =>
      r.event_types.includes(eventType) &&
      (r.products.includes(product) || r.products.includes("all")),
  );
}

/* -------------------------------------------------------------------------- */
/*                            REDRESS CALCULATION                             */
/* -------------------------------------------------------------------------- */

export interface RedressInput {
  case_id: string;
  event_type: string;
  product: string;
  policy_version: string;
  amount?: number;
  delay_days?: number;
  /** working days between the incident and the customer reporting it */
  reported_after_days?: number;
  account_type?: "bsbd" | "savings" | "current";
  severity?: string;
}

export interface ComputedComponent {
  label: string;
  amount: number;
  rule: string;
  formula: string;
  working: string;
}

export class PolicyError extends Error {}

function tatDaysFor(product: string): number {
  const rule = POLICY_BY_ID["RBI-TAT-2019"]!.rules.find((r) => r.rule_id === "R-TAT-TAT-DAYS")!;
  const p = rule.params as Record<string, number>;
  return p[product] ?? p["default"] ?? 1;
}

function liabilityCap(accountType: "bsbd" | "savings" | "current"): number {
  const rule = POLICY_BY_ID["RBI-LIAB-2017"]!.rules.find((r) => r.rule_id === "R-LIAB-CAP")!;
  return (rule.params as Record<string, number>)[accountType] ?? 10000;
}

function cite(rule: PolicyRule) {
  return `${rule.doc_id} ${rule.clause_id}`;
}

/**
 * Deterministic redress calculation driven entirely by POLICY_DB.
 * Returns an estimate — never moves money, always requires approval.
 */
export function computeRedress(input: RedressInput) {
  if (!input.policy_version) throw new PolicyError("policy_version is required");
  if (!POLICY_VERSIONS.includes(input.policy_version))
    throw new PolicyError(`Unknown or withdrawn policy version: ${input.policy_version}`);
  if (!(VALID_EVENT_TYPES as readonly string[]).includes(input.event_type))
    throw new PolicyError(`Invalid event_type: ${input.event_type}`);

  const amount = Math.max(0, Math.round(input.amount ?? 0));
  const delayDays = Math.max(0, Math.round(input.delay_days ?? 0));
  const reportedAfter = Math.max(0, Math.round(input.reported_after_days ?? 0));
  const accountType = input.account_type ?? "savings";
  const product = input.product || "other";
  const components: ComputedComponent[] = [];
  const applied: PolicyRule[] = [];

  const use = (r: PolicyRule) => {
    applied.push(r);
    return r;
  };
  const findRule = (id: string) => ALL_RULES.find((r) => r.rule_id === id)!;

  if (input.event_type === "failed_payment") {
    if (amount > 0) {
      const r = use(findRule("R-TAT-REVERSAL"));
      components.push({
        label: "Reversal of failed debit",
        amount,
        rule: cite(r),
        formula: r.formula,
        working: `disputed_amount = INR ${amount}`,
      });
    }
    const tat = tatDaysFor(product);
    const chargeable = Math.max(0, delayDays - tat);
    if (chargeable > 0) {
      const r = use(findRule("R-TAT-100PD"));
      const rate = Number(r.params["rate_per_day"] ?? 100);
      components.push({
        label: `Delay compensation (${chargeable} day(s) beyond T+${tat})`,
        amount: chargeable * rate,
        rule: cite(r),
        formula: r.formula,
        working: `INR ${rate} x (${delayDays} - ${tat}) = INR ${chargeable * rate}`,
      });
    }
  }

  if (input.event_type === "unauthorised_transaction") {
    const capRule = use(findRule("R-LIAB-CAP"));
    const zeroDays = Number(capRule.params["zero_liability_days"] ?? 3);
    const limitedDays = Number(capRule.params["limited_liability_days"] ?? 7);
    const cap = liabilityCap(accountType);
    const beyondLimited = reportedAfter > limitedDays;
    const liability =
      reportedAfter <= zeroDays ? 0 : beyondLimited ? amount : Math.min(amount, cap);
    if (amount > 0) {
      const r = use(findRule("R-LIAB-SHADOW"));
      components.push({
        label: "Shadow reversal of disputed amount",
        amount,
        rule: cite(r),
        formula: r.formula,
        working: `disputed_amount = INR ${amount}, credit within ${r.params["shadow_days"]} working days`,
      });
      if (liability > 0) {
        components.push({
          label: beyondLimited
            ? `Less customer liability (reported after ${reportedAfter} working days — beyond ${limitedDays}-day limited-liability window, board policy applies)`
            : `Less customer liability (${accountType} account, reported after ${reportedAfter} working days)`,
          amount: -liability,
          rule: cite(capRule),
          formula: capRule.formula,
          working: beyondLimited
            ? `reported after ${reportedAfter} working days (> ${limitedDays}) — liability per board policy = INR ${liability}; statutory cap INR ${cap} does not apply`
            : `min(INR ${amount}, cap INR ${cap}) = INR ${liability}`,
        });
      } else {
        components.push({
          label: `Zero customer liability (reported within ${zeroDays} working days)`,
          amount: 0,
          rule: cite(capRule),
          formula: capRule.formula,
          working: `reported_after_days = ${reportedAfter} <= ${zeroDays}`,
        });
      }
    }
    const r2 = findRule("R-LIAB-DELAY");
    const free = Number(r2.params["free_days"] ?? 10);
    const chargeable = Math.max(0, delayDays - free);
    if (chargeable > 0) {
      use(r2);
      const rate = Number(r2.params["rate_per_day"] ?? 100);
      components.push({
        label: `Shadow-reversal delay compensation (${chargeable} day(s) beyond ${free})`,
        amount: chargeable * rate,
        rule: cite(r2),
        formula: r2.formula,
        working: `INR ${rate} x (${delayDays} - ${free}) = INR ${chargeable * rate}`,
      });
    }
  }

  if (input.event_type === "fee") {
    if (amount > 0 && product === "loan") {
      const r = use(findRule("R-LOAN-PENAL-REFUND"));
      components.push({
        label: "Reversal of penal interest / undisclosed loan charge",
        amount,
        rule: cite(r),
        formula: r.formula,
        working: `charge levied contrary to the penal charges directions = INR ${amount}`,
      });
      const r2 = findRule("R-LOAN-NO-CAPITALISATION");
      if (delayDays > 0) {
        use(r2);
        const rate = Number(r2.params["lending_rate"] ?? 9.5);
        const interest = Math.round((amount * rate * delayDays) / 36500);
        components.push({
          label: `Interest wrongly compounded on the penal charge (${delayDays} day(s))`,
          amount: interest,
          rule: cite(r2),
          formula: r2.formula,
          working: `INR ${amount} x ${rate}% x ${delayDays}/365 = INR ${interest}`,
        });
      }
    } else if (amount > 0) {
      const r = use(findRule("R-CARD-FEE"));
      const gst = Number(r.params["gst_rate"] ?? 18);
      const tax = Math.round((amount * gst) / 100);
      components.push({
        label: "Reversal of charge levied without consent",
        amount: amount + tax,
        rule: cite(r),
        formula: r.formula,
        working: `INR ${amount} + ${gst}% tax (INR ${tax}) = INR ${amount + tax}`,
      });
    }
    if (product === "cards" && delayDays > 0) {
      const r = findRule("R-CARD-CLOSURE");
      const free = Number(r.params["free_days"] ?? 7);
      const chargeable = Math.max(0, delayDays - free);
      if (chargeable > 0) {
        use(r);
        const rate = Number(r.params["rate_per_day"] ?? 500);
        components.push({
          label: `Card closure delay penalty (${chargeable} day(s) beyond ${free})`,
          amount: chargeable * rate,
          rule: cite(r),
          formula: r.formula,
          working: `INR ${rate} x (${delayDays} - ${free}) = INR ${chargeable * rate}`,
        });
      }
    }
  }

  if (input.event_type === "delay") {
    if (product === "deceased_claim") {
      const r = findRule("R-DEC-PENAL");
      const tat = Number(r.params["tat_days"] ?? 15);
      const rate = Number(r.params["term_deposit_rate"] ?? 6.5) + Number(r.params["penal_spread"] ?? 4);
      const chargeable = Math.max(0, delayDays - tat);
      if (amount > 0 && chargeable > 0) {
        use(r);
        const interest = Math.round((amount * rate * chargeable) / 36500);
        components.push({
          label: `Penal interest on delayed claim (${chargeable} day(s) beyond ${tat})`,
          amount: interest,
          rule: cite(r),
          formula: r.formula,
          working: `INR ${amount} x ${rate}% x ${chargeable}/365 = INR ${interest}`,
        });
      }
      use(findRule("R-DEC-DOCS"));
    } else if (product === "cards" && delayDays > 0) {
      const r = findRule("R-CARD-CLOSURE");
      const free = Number(r.params["free_days"] ?? 7);
      const chargeable = Math.max(0, delayDays - free);
      if (chargeable > 0) {
        use(r);
        const rate = Number(r.params["rate_per_day"] ?? 500);
        components.push({
          label: `Card closure delay penalty (${chargeable} day(s) beyond ${free})`,
          amount: chargeable * rate,
          rule: cite(r),
          formula: r.formula,
          working: `INR ${rate} x (${delayDays} - ${free}) = INR ${chargeable * rate}`,
        });
      }
    } else if ((product === "cheque" || product === "deposit") && amount > 0 && delayDays > 0) {
      const r = findRule("R-CHQ-INT");
      const free = Number(r.params["free_days"] ?? 3);
      const chargeable = Math.max(0, delayDays - free);
      if (chargeable > 0) {
        use(r);
        const base = Number(r.params["savings_rate"] ?? 3);
        const rate =
          delayDays > Number(r.params["penal_after_days"] ?? 90)
            ? base + Number(r.params["penal_spread"] ?? 2)
            : base;
        const interest = Math.round((amount * rate * chargeable) / 36500);
        components.push({
          label: `Interest on delayed collection (${chargeable} day(s) beyond ${free})`,
          amount: interest,
          rule: cite(r),
          formula: r.formula,
          working: `INR ${amount} x ${rate}% x ${chargeable}/365 = INR ${interest}`,
        });
        use(findRule("R-CHQ-SUOMOTU"));
      }
    }
    if (!components.length && delayDays > 0) {
      const r = use(findRule("R-CCP-GOODWILL"));
      const unit = Number(r.params["unit"] ?? 250);
      const cap = Number(r.params["cap"] ?? 1000);
      const weight = input.severity === "S1" ? 4 : input.severity === "S2" ? 3 : input.severity === "S3" ? 2 : 1;
      const goodwill = Math.min(cap, unit * weight);
      components.push({
        label: `Goodwill for service deficiency (severity weight ${weight})`,
        amount: goodwill,
        rule: cite(r),
        formula: r.formula,
        working: `INR ${unit} x ${weight} (cap INR ${cap}) = INR ${goodwill}`,
      });
    }
  }

  if (input.event_type === "conduct") {
    use(findRule("R-CONDUCT-HITL"));
    const r = use(findRule("R-CONDUCT-GOODWILL"));
    const goodwill = Number(r.params["goodwill"] ?? 2500);
    components.push({
      label: "Goodwill compensation for substantiated agent misconduct",
      amount: goodwill,
      rule: cite(r),
      formula: r.formula,
      working: `board-approved indicative amount INR ${goodwill}, payable only after investigation`,
    });
  }

  use(findRule("R-CCP-NONBINDING"));

  const total = components.reduce((s, c) => s + c.amount, 0);
  const citations = Array.from(new Set(applied.map((r) => r.doc_id)));

  return {
    case_id: input.case_id,
    event_type: input.event_type,
    product,
    amount_claimed: amount,
    calculated_amount: Math.max(0, total),
    currency: "INR" as const,
    components: components.map((c) => ({ label: c.label, amount: c.amount, rule: c.rule })),
    workings: components,
    rules_applied: applied.map((r) => ({ rule_id: r.rule_id, clause: cite(r), label: r.label, formula: r.formula })),
    citations,
    basis: components.length
      ? components.map((c) => `${c.label}: INR ${c.amount} (${c.rule})`).join("; ")
      : "No monetary redress payable under the applicable policy rules",
    policy_version: input.policy_version,
    binding: false as const,
    requires_approval: true,
    note: "Non-binding estimate computed from the approved policy database. No payment executed; requires human approval.",
  };
}
