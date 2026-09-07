import type { Channel } from "./types";

export const PRODUCTS: { value: string; label: string; group: string }[] = [
  { value: "upi", label: "UPI / IMPS / NEFT payment", group: "Payments" },
  { value: "cards", label: "Debit or credit card", group: "Cards" },
  { value: "deposit", label: "Savings / deposit account", group: "Accounts" },
  { value: "loan", label: "Loan, EMI or recovery", group: "Loans" },
  { value: "cheque", label: "Cheque / statement service", group: "Accounts" },
  { value: "deceased_claim", label: "Deceased depositor claim", group: "Accounts" },
  { value: "other", label: "Other banking service", group: "Other" },
];

export const PRODUCT_LABEL: Record<string, string> = Object.fromEntries(
  PRODUCTS.map((p) => [p.value, p.label]),
);

export const CHANNELS: { value: Channel; label: string; hint: string }[] = [
  { value: "mock_branch_webform", label: "Branch", hint: "Raised at, or about, a branch" },
  { value: "mock_email", label: "Email / Contact centre", hint: "Written to the contact centre" },
  { value: "mock_digital_webform", label: "Internet / mobile banking", hint: "Raised on a digital channel" },
];

/** Complaint categories offered on the customer portal, mapped to internal products. */
export const PORTAL_CATEGORIES: {
  id: string;
  label: string;
  product: string;
  examples: string[];
}[] = [
  {
    id: "payments",
    label: "Funds transfer / UPI",
    product: "upi",
    examples: ["Amount debited but not credited", "Failed UPI or IMPS transfer", "Delayed reversal"],
  },
  {
    id: "cards",
    label: "Debit / credit card",
    product: "cards",
    examples: ["Unauthorised transaction", "Wrong fee or charge", "Card closure not done"],
  },
  {
    id: "accounts",
    label: "Accounts & deposits",
    product: "deposit",
    examples: ["Statement not received", "Interest not credited", "Account service delay"],
  },
  {
    id: "loans",
    label: "Loans & recovery",
    product: "loan",
    examples: ["Double EMI debit", "Recovery agent conduct", "Foreclosure delay"],
  },
  {
    id: "deceased",
    label: "Deceased depositor claim",
    product: "deceased_claim",
    examples: ["Nominee claim delayed", "Excess documents demanded"],
  },
  {
    id: "other",
    label: "Other",
    product: "other",
    examples: ["Any other grievance"],
  },
];
