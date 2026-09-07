import { Link } from "@tanstack/react-router";
import { Gauge, Pause, Play, Plus, Radio, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Chip, StatusChip } from "@/components/app/atoms";
import { AGENT_LABEL, CHANNEL_ICON, CHANNEL_LABEL } from "@/lib/domain/engine";
import {
  injectCaseNow,
  resetSimulationCounters,
  setSimConfig,
  toggleSimulation,
  useSimulation,
} from "@/lib/domain/simulation";
import type { AgentName } from "@/lib/domain/types";

const SPEEDS = [1, 2, 4, 8];

export function SimulationPanel() {
  const sim = useSimulation();

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio
            className={sim.running ? "size-5 animate-pulse text-destructive" : "size-5 text-muted-foreground"}
          />
          <div>
            <h2 className="text-sm font-bold">Live simulation</h2>
            <p className="text-xs text-muted-foreground">
              {sim.running
                ? `Replaying a real case every ~${Math.round(sim.arrivalSeconds / sim.speed)}s and streaming it through the agents`
                : "Switch on to replay the 12 real prototype cases through the four-agent pipeline in real time"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">{sim.generated} generated</Chip>
          <Chip tone="success">{sim.closed} closed</Chip>
          <Chip tone="warning">{sim.hitl} to HITL</Chip>
          <Button variant="outline" size="sm" onClick={() => { injectCaseNow(); toast.success("Case injected into the pipeline"); }}>
            <Plus className="size-4" /> Inject case
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetSimulationCounters();
              toast.success("Simulation counters reset");
            }}
          >
            <RotateCcw className="size-4" /> Counters
          </Button>
          <Button
            size="sm"
            variant={sim.running ? "destructive" : "default"}
            onClick={() => toggleSimulation(!sim.running)}
          >
            {sim.running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {sim.running ? "Stop" : "Start"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Gauge className="size-4" /> Speed
          </div>
          <div className="flex gap-1">
            {SPEEDS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={sim.speed === s ? "default" : "outline"}
                onClick={() => setSimConfig({ speed: s })}
              >
                {s}x
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Arrival interval</span>
            <span className="mono">{sim.arrivalSeconds}s @1x</span>
          </div>
          <Slider
            min={4}
            max={60}
            step={2}
            value={[sim.arrivalSeconds]}
            onValueChange={(v) => setSimConfig({ arrivalSeconds: v[0] ?? 12 })}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
          <div>
            <p className="text-xs font-semibold">Auto-clear HITL queue</p>
            <p className="text-[11px] text-muted-foreground">Simulated reviewer approves escalations</p>
          </div>
          <Switch checked={sim.autoHitl} onCheckedChange={(v) => setSimConfig({ autoHitl: v })} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            In-flight cases ({sim.inFlight.length})
          </p>
          <div className="max-h-56 space-y-2 overflow-auto pr-1">
            {sim.inFlight.length === 0 && (
              <p className="text-xs text-muted-foreground">No cases in flight.</p>
            )}
            {sim.inFlight.map((c) => (
              <div key={c.case_id} className="rounded-md border border-border p-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <Link to="/cases/$caseId" params={{ caseId: c.case_id }} className="mono font-bold hover:underline">
                    {CHANNEL_ICON[c.channel]} {c.case_id}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{AGENT_LABEL[c.agent as AgentName]}</span>
                    <StatusChip status={c.status} />
                  </div>
                </div>
                <Progress className="mt-2 h-1.5" value={Math.round((c.step / Math.max(1, c.total)) * 100)} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Live event stream</p>
          <div className="max-h-56 space-y-1 overflow-auto pr-1">
            {sim.events.length === 0 && <p className="text-xs text-muted-foreground">Waiting for events…</p>}
            {sim.events.map((e) => (
              <div key={e.id} className="flex items-start gap-2 border-b border-border/60 py-1 text-xs">
                <span className="mono text-muted-foreground">
                  {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <Link to="/cases/$caseId" params={{ caseId: e.case_id }} className="mono font-semibold hover:underline">
                  {e.case_id}
                </Link>
                <span className="flex-1 text-muted-foreground">{e.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Channels in rotation: {Object.values(CHANNEL_LABEL).join(" · ")} — metrics, charts and queues above update automatically.
      </p>
    </div>
  );
}
