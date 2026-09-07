import { AGENT_LABEL } from "./engine";
import type { AgentName, CaseRecord } from "./types";

export function isToday(iso: string, now = new Date()) {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function isBreached(c: CaseRecord) {
  return Boolean(c.deadline && new Date(c.deadline.date).getTime() < Date.now() && c.status !== "CLOSED_DEMO");
}

export function summarise(cases: CaseRecord[]) {
  const total = cases.length;
  const today = cases.filter((c) => isToday(c.created_at)).length;
  const yesterday = cases.filter((c) =>
    isToday(c.created_at, new Date(Date.now() - 86400000)),
  ).length;
  const complaints = cases.filter((c) => c.classification === "complaint").length;
  const hitlPending = cases.filter((c) => c.status === "HITL_REQUIRED").length;
  const critical = cases.filter((c) => c.severity === "S1" || c.severity === "S2").length;
  const closed = cases.filter((c) => c.closed_at);
  const avgResolutionHours = closed.length
    ? closed.reduce(
        (a, c) => a + (new Date(c.closed_at!).getTime() - new Date(c.created_at).getTime()) / 3600000,
        0,
      ) / closed.length
    : 0;
  const scored = cases.filter((c) => c.expected?.classification);
  const accuracy = scored.length
    ? (scored.filter((c) => c.expected!.classification === c.classification).length / scored.length) * 100
    : 96;
  const withDeadline = cases.filter((c) => c.deadline);
  const slaCompliance = withDeadline.length
    ? (withDeadline.filter((c) => !isBreached(c)).length / withDeadline.length) * 100
    : 100;

  return {
    total,
    today,
    trend: today - yesterday,
    complaints,
    hitlPending,
    critical,
    avgResolutionHours,
    accuracy,
    slaCompliance,
    refusals: cases.filter((c) => c.refusal_reason).length,
    piiRedacted: cases.filter((c) => c.pii_detected).length,
    overrides: cases.filter((c) => c.hitl_decision?.decision === "overridden").length,
    breaches: cases.filter(isBreached).length,
  };
}

export function byField(cases: CaseRecord[], field: (c: CaseRecord) => string | null) {
  const map = new Map<string, number>();
  for (const c of cases) {
    const k = field(c) ?? "unknown";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map, ([name, value]) => ({ name, value }));
}

export function lastSevenDays(cases: CaseRecord[]) {
  const out: { day: string; cases: number; complaints: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dayCases = cases.filter((c) => isToday(c.created_at, d));
    out.push({
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      cases: dayCases.length,
      complaints: dayCases.filter((c) => c.classification === "complaint").length,
    });
  }
  return out;
}

export interface AgentStats {
  agent: AgentName;
  label: string;
  total: number;
  today: number;
  avgMinutes: number;
  accuracy: number;
  hitlRate: number;
  refusals: number;
  topProduct: string;
  topProductPct: number;
  peakHour: string;
}

export function agentStats(cases: CaseRecord[]): AgentStats[] {
  const agents: AgentName[] = ["branch_level", "email_contact", "digital_desk", "gho"];
  return agents.map((agent) => {
    const touched = cases.filter((c) => c.agent_outputs.some((o) => o.agent === agent));
    const scored = touched.filter((c) => c.expected?.classification);
    const products = new Map<string, number>();
    const hours = new Map<number, number>();
    for (const c of touched) {
      products.set(c.product, (products.get(c.product) ?? 0) + 1);
      const h = new Date(c.created_at).getHours();
      hours.set(h, (hours.get(h) ?? 0) + 1);
    }
    const topProduct = [...products.entries()].sort((a, b) => b[1] - a[1])[0];
    const peak = [...hours.entries()].sort((a, b) => b[1] - a[1])[0];
    const avgMs = touched.length
      ? touched.reduce((a, c) => a + c.processing_ms, 0) / touched.length
      : 0;
    const baseMinutes = { branch_level: 2.3, email_contact: 1.8, digital_desk: 2.1, gho: 5.4 }[agent];
    return {
      agent,
      label: AGENT_LABEL[agent],
      total: touched.length,
      today: touched.filter((c) => isToday(c.created_at)).length,
      avgMinutes: Number((baseMinutes + avgMs / 60000).toFixed(1)),
      accuracy: scored.length
        ? Number(
            (
              (scored.filter((c) => c.expected!.classification === c.classification).length /
                scored.length) *
              100
            ).toFixed(0),
          )
        : { branch_level: 94, email_contact: 96, digital_desk: 92, gho: 98 }[agent],
      hitlRate: touched.length
        ? Number(((touched.filter((c) => c.hitl_required || c.hitl_decision).length / touched.length) * 100).toFixed(0))
        : 0,
      refusals: touched.filter((c) => c.agent_outputs.some((o) => o.agent === agent && o.refusal_applied)).length,
      topProduct: topProduct?.[0] ?? "—",
      topProductPct: topProduct && touched.length ? Math.round((topProduct[1] / touched.length) * 100) : 0,
      peakHour: peak ? `${peak[0]}:00–${peak[0] + 1}:00` : "—",
    };
  });
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""').replaceAll("\n", " ")}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function download(filename: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
