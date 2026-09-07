import { useEffect, useState } from "react";
import { processCase } from "./engine";
import { generateLiveCase, type RawCase } from "./seed";
import { addCaseRecord, applyHitlDecision, getCases, logAudit, upsertCase } from "./store";
import type { CaseRecord, CaseStatus } from "./types";

export interface SimConfig {
  running: boolean;
  /** playback multiplier: 1x .. 8x */
  speed: number;
  /** seconds between new case arrivals at 1x */
  arrivalSeconds: number;
  /** simulated reviewer auto-clears HITL queue */
  autoHitl: boolean;
}

export interface SimEvent {
  id: string;
  at: string;
  case_id: string;
  label: string;
  status: CaseStatus;
}

export interface InFlight {
  case_id: string;
  status: CaseStatus;
  step: number;
  total: number;
  channel: string;
  agent: string;
  severity: string | null;
  waiting: boolean;
  source_case_id: string | null;
}

export interface SimState extends SimConfig {
  inFlight: InFlight[];
  events: SimEvent[];
  generated: number;
  closed: number;
  hitl: number;
  startedAt: string | null;
}

const CONFIG_KEY = "acrs.sim.v1";
const STAGE_MS = 1600;

const defaultConfig: SimConfig = { running: false, speed: 2, arrivalSeconds: 12, autoHitl: false };

interface Track {
  full: CaseRecord;
  step: number;
  nextAt: number;
  waiting: boolean;
}

const tracks = new Map<string, Track>();
const listeners = new Set<() => void>();

let config: SimConfig = { ...defaultConfig };
let events: SimEvent[] = [];
let generated = 0;
let closed = 0;
let hitlCount = 0;
let startedAt: string | null = null;
let nextArrivalAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let hydrated = false;

function emit() {
  listeners.forEach((l) => l());
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (raw) config = { ...defaultConfig, ...(JSON.parse(raw) as Partial<SimConfig>), running: false };
  } catch {
    /* ignore */
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...config, running: false }));
  } catch {
    /* ignore */
  }
}

function pushEvent(caseId: string, label: string, status: CaseStatus) {
  events = [
    { id: `${caseId}-${status}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), case_id: caseId, label, status },
    ...events,
  ].slice(0, 60);
}

/** Build the partially-processed snapshot of a case at trace index `step`. */
function snapshot(full: CaseRecord, step: number): CaseRecord {
  const traces = full.traces.slice(0, step + 1);
  const status = traces[traces.length - 1]!.state_after;
  const seen = new Set(traces.map((t) => t.state_after));
  const intakeVisible = seen.has("CLASSIFIED") || seen.has("PRIVACY_REDACTION_HOLD");
  const ghoVisible = seen.has("DECISION_DRAFTED");
  const outputs = full.agent_outputs.filter((o, i) => (i === 0 ? intakeVisible : ghoVisible));
  const last = outputs[outputs.length - 1];
  const nowIso = new Date().toISOString();
  return {
    ...full,
    status,
    traces,
    agent_outputs: outputs,
    classification: last ? last.classification : null,
    severity: last ? last.severity : null,
    deadline: last ? last.deadline : null,
    assigned_agent: ghoVisible ? full.assigned_agent : outputs.length ? full.agent_outputs[0]!.agent : null,
    hitl_required: status === "HITL_REQUIRED",
    pii_detected: outputs.some((o) => o.pii_detected),
    refusal_reason: last ? (last.refusal_reason ?? null) : null,
    updated_at: nowIso,
    closed_at: status === "CLOSED_DEMO" ? nowIso : null,
  };
}

const sourceOf = new Map<string, string>();
const pendingQueue: string[] = [];

function spawnCase(sourceCaseId?: string): CaseRecord {
  const raw = generateLiveCase(new Date(), sourceCaseId);
  raw.received_at = new Date().toISOString();
  const full = processCase(raw);
  if (sourceCaseId) sourceOf.set(full.case_id, sourceCaseId);
  const first = snapshot(full, 0);
  addCaseRecord(first, "simulation");
  tracks.set(full.case_id, { full, step: 0, nextAt: Date.now() + stageDelay(), waiting: false });
  generated += 1;
  pushEvent(full.case_id, "Live arrival · " + full.product + " · " + full.source_channel.replace("mock_", "").replace("_webform", ""), "NEW");
  return first;
}

/** Push an externally-created case (portal / intake form) into the live pipeline. */
export function injectRawCase(raw: RawCase, label = "Customer submission"): CaseRecord {
  hydrate();
  const full = processCase(raw);
  const first = snapshot(full, 0);
  addCaseRecord(first, "intake");
  tracks.set(full.case_id, { full, step: 0, nextAt: Date.now() + stageDelay(), waiting: false });
  generated += 1;
  pushEvent(full.case_id, `${label} · ${full.product} · ${full.source_channel.replace("mock_", "").replace("_webform", "")}`, "NEW");
  if (!config.running) {
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 250);
    nextArrivalAt = Number.MAX_SAFE_INTEGER; // drain only, no synthetic arrivals
  }
  emit();
  return first;
}

function stageDelay() {
  return Math.max(180, STAGE_MS / config.speed);
}

function arrivalDelay() {
  return Math.max(900, (config.arrivalSeconds * 1000) / config.speed);
}

function advance(track: Track) {
  const { full } = track;
  const nextStep = track.step + 1;
  if (nextStep >= full.traces.length) {
    tracks.delete(full.case_id);
    return;
  }
  track.step = nextStep;
  const snap = snapshot(full, nextStep);
  upsertCase(snap);
  const trace = full.traces[nextStep]!;
  pushEvent(full.case_id, trace.reason, trace.state_after);
  if (trace.state_after === "CLOSED_DEMO") {
    closed += 1;
    logAudit({ actor: "simulation", action: "case_closed", case_id: full.case_id, details: { severity: snap.severity } });
    tracks.delete(full.case_id);
    return;
  }
  if (trace.state_after === "HITL_REQUIRED") {
    hitlCount += 1;
    if (config.autoHitl) {
      track.waiting = true;
      track.nextAt = Date.now() + stageDelay() * 3;
    } else {
      tracks.delete(full.case_id);
    }
    return;
  }
  track.nextAt = Date.now() + stageDelay();
}

function tick() {
  const now = Date.now();
  let dirty = false;

  if (now >= nextArrivalAt) {
    spawnCase(pendingQueue.shift());
    nextArrivalAt = now + arrivalDelay();
    dirty = true;
  }

  for (const track of Array.from(tracks.values())) {
    if (now < track.nextAt) continue;
    if (track.waiting) {
      tracks.delete(track.full.case_id);
      applyHitlDecision(track.full.case_id, {
        decision: "approved",
        reviewer: "sim.reviewer",
        comment: "Auto-approved by simulated reviewer (simulation mode)",
        at: new Date().toISOString(),
      });
      closed += 1;
      pushEvent(track.full.case_id, "HITL auto-approved by simulated reviewer", "CLOSED_DEMO");
    } else {
      advance(track);
    }
    dirty = true;
  }

  if (dirty) emit();
}

/** Re-attach tracks for live cases left mid-pipeline (e.g. after a page reload). */
function resumeOrphans() {
  for (const c of getCases()) {
    if (!c.case_id.startsWith("UCN-LIVE-")) continue;
    if (c.status === "CLOSED_DEMO" || c.status === "HITL_REQUIRED") continue;
    if (tracks.has(c.case_id)) continue;
    const full = processCase({
      case_id: c.case_id,
      source_channel: c.source_channel,
      received_at: c.received_at,
      customer_token: c.customer_token,
      language: c.language,
      product: c.product,
      narrative: c.narrative,
      incident_date: c.incident_date,
      attachment_refs: c.attachment_refs,
      authority_status: c.authority_status,
      consent_status: c.consent_status,
      expected: c.expected,
    });
    const step = Math.max(0, full.traces.findIndex((t) => t.state_after === c.status));
    tracks.set(c.case_id, { full, step, nextAt: Date.now() + stageDelay(), waiting: false });
    pushEvent(c.case_id, "Resumed in-flight case after reload", c.status);
  }
}

export function startSimulation() {
  hydrate();
  if (config.running) return;
  config = { ...config, running: true };
  startedAt = new Date().toISOString();
  nextArrivalAt = Date.now() + 1200;
  resumeOrphans();
  if (timer) clearInterval(timer);
  timer = setInterval(tick, 250);
  logAudit({ actor: "simulation", action: "simulation_started", case_id: null, details: { speed: config.speed, arrivalSeconds: config.arrivalSeconds } });
  persist();
  emit();
}

export function stopSimulation() {
  if (timer) clearInterval(timer);
  timer = null;
  if (!config.running) return;
  config = { ...config, running: false };
  // flush in-flight cases to their terminal state so nothing is stuck mid-pipeline
  for (const track of Array.from(tracks.values())) {
    upsertCase(snapshot(track.full, track.full.traces.length - 1));
  }
  tracks.clear();
  logAudit({ actor: "simulation", action: "simulation_stopped", case_id: null, details: { generated, closed } });
  persist();
  emit();
}

export function toggleSimulation(on: boolean) {
  if (on) startSimulation();
  else stopSimulation();
}

export function setSimConfig(patch: Partial<SimConfig>) {
  hydrate();
  config = { ...config, ...patch, running: config.running };
  persist();
  emit();
}

export function injectCaseNow(sourceCaseId?: string): CaseRecord {
  hydrate();
  const rec = spawnCase(sourceCaseId);
  if (!config.running) {
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 250);
    nextArrivalAt = Number.MAX_SAFE_INTEGER; // drain only, no new arrivals
  }
  emit();
  return rec;
}

/** Queue a specific real case to arrive on the next simulated arrival tick. */
export function enqueueRealCase(caseId: string) {
  hydrate();
  pendingQueue.push(caseId);
  emit();
}

export function getPendingQueue(): string[] {
  return [...pendingQueue];
}

export function resetSimulationCounters() {
  generated = 0;
  closed = 0;
  hitlCount = 0;
  events = [];
  emit();
}

export function getSimState(): SimState {
  hydrate();
  const byId = new Map(getCases().map((c) => [c.case_id, c] as const));
  const inFlight: InFlight[] = Array.from(tracks.values()).map((t) => {
    const live = byId.get(t.full.case_id);
    return {
      case_id: t.full.case_id,
      status: (live?.status ?? t.full.status) as CaseStatus,
      step: t.step,
      total: t.full.traces.length - 1,
      channel: t.full.source_channel,
      agent: live?.assigned_agent ?? t.full.agent_outputs[0]?.agent ?? "branch_level",
      severity: live?.severity ?? null,
      waiting: t.waiting,
      source_case_id: sourceOf.get(t.full.case_id) ?? null,
    };
  });
  return { ...config, inFlight, events, generated, closed, hitl: hitlCount, startedAt };
}

export function useSimulation(): SimState {
  const [state, setState] = useState<SimState>(() => ({
    ...defaultConfig,
    inFlight: [],
    events: [],
    generated: 0,
    closed: 0,
    hitl: 0,
    startedAt: null,
  }));

  useEffect(() => {
    const l = () => setState(getSimState());
    listeners.add(l);
    l();
    const poll = setInterval(l, 500);
    return () => {
      listeners.delete(l);
      clearInterval(poll);
    };
  }, []);

  return state;
}
