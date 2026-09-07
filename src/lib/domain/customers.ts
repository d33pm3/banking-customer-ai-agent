import { useEffect, useState } from "react";
import { logAudit } from "./store";

/**
 * Self-contained customer account registry for the public grievance portal.
 * Every portal complainant gets a unique customer ID and a login, so their
 * submissions are tied to a real account instead of an anonymous demo token.
 */

const KEY_CUSTOMERS = "acrs.customers.v1";
const KEY_CUSTOMER_SESSION = "acrs.customer.session.v1";

export interface CustomerAccount {
  customer_id: string;
  name: string;
  mobile: string;
  email: string;
  pin_hash: string;
  created_at: string;
  case_ids: string[];
}

export type PublicCustomer = Omit<CustomerAccount, "pin_hash">;

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

/** Demo-grade one-way hash (djb2). Not cryptography — no real PII is stored. */
function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i += 1) h = ((h << 5) + h + pin.charCodeAt(i)) >>> 0;
  return `h${h.toString(36)}`;
}

function newCustomerId(existing: CustomerAccount[]): string {
  const seq = (existing.length + 1).toString().padStart(4, "0");
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `CUST-${stamp}-${seq}`;
}

export function getCustomers(): CustomerAccount[] {
  return read<CustomerAccount[]>(KEY_CUSTOMERS, []);
}

function setCustomers(list: CustomerAccount[]) {
  write(KEY_CUSTOMERS, list);
}

function toPublic(a: CustomerAccount): PublicCustomer {
  const { pin_hash: _pin, ...rest } = a;
  return rest;
}

export function findCustomer(identifier: string): CustomerAccount | null {
  const id = identifier.trim().toLowerCase();
  if (!id) return null;
  return (
    getCustomers().find(
      (c) =>
        c.customer_id.toLowerCase() === id ||
        c.mobile.toLowerCase() === id ||
        c.email.toLowerCase() === id,
    ) ?? null
  );
}

export function registerCustomer(input: {
  name: string;
  mobile: string;
  email: string;
  pin: string;
}): { ok: true; customer: PublicCustomer } | { ok: false; error: string } {
  const name = input.name.trim();
  const mobile = input.mobile.trim();
  const email = input.email.trim();
  if (name.length < 3) return { ok: false, error: "Please enter your full name." };
  if (!/^\d{10}$/.test(mobile)) return { ok: false, error: "Enter a 10-digit mobile number." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!/^\d{4,6}$/.test(input.pin)) return { ok: false, error: "PIN must be 4-6 digits." };

  const list = getCustomers();
  if (list.some((c) => c.mobile === mobile || c.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: "An account already exists for this mobile or email. Please sign in." };
  }

  const account: CustomerAccount = {
    customer_id: newCustomerId(list),
    name,
    mobile,
    email,
    pin_hash: hashPin(input.pin),
    created_at: new Date().toISOString(),
    case_ids: [],
  };
  setCustomers([...list, account]);
  write(KEY_CUSTOMER_SESSION, account.customer_id);
  logAudit({
    actor: account.customer_id,
    action: "customer_register",
    case_id: null,
    details: { channel: "portal" },
  });
  return { ok: true, customer: toPublic(account) };
}

export function loginCustomer(
  identifier: string,
  pin: string,
): { ok: true; customer: PublicCustomer } | { ok: false; error: string } {
  const acc = findCustomer(identifier);
  if (!acc) return { ok: false, error: "No account found for that customer ID, mobile or email." };
  if (acc.pin_hash !== hashPin(pin)) return { ok: false, error: "Incorrect PIN." };
  write(KEY_CUSTOMER_SESSION, acc.customer_id);
  logAudit({
    actor: acc.customer_id,
    action: "customer_login",
    case_id: null,
    details: { channel: "portal" },
  });
  return { ok: true, customer: toPublic(acc) };
}

export function logoutCustomer() {
  const cur = getCustomerSession();
  if (cur) {
    logAudit({
      actor: cur.customer_id,
      action: "customer_logout",
      case_id: null,
      details: { channel: "portal" },
    });
  }
  if (isBrowser()) window.localStorage.removeItem(KEY_CUSTOMER_SESSION);
  emit();
}

export function getCustomerSession(): PublicCustomer | null {
  const id = read<string | null>(KEY_CUSTOMER_SESSION, null);
  if (!id) return null;
  const acc = getCustomers().find((c) => c.customer_id === id);
  return acc ? toPublic(acc) : null;
}

/** Attach a newly registered complaint to the customer's account. */
export function linkCaseToCustomer(customerId: string, caseId: string) {
  const list = getCustomers().map((c) =>
    c.customer_id === customerId && !c.case_ids.includes(caseId)
      ? { ...c, case_ids: [caseId, ...c.case_ids] }
      : c,
  );
  setCustomers(list);
}

export function useCustomerSession(): { customer: PublicCustomer | null; ready: boolean } {
  const [customer, setCustomer] = useState<PublicCustomer | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setCustomer(getCustomerSession());
    setReady(true);
    const l = () => setCustomer(getCustomerSession());
    listeners.add(l);
    window.addEventListener("storage", l);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", l);
    };
  }, []);
  return { customer, ready };
}
