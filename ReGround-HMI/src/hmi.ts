import { receiverProfile } from "./receiverProfile.ts";
import { checks, withinProfile } from "./conformance.ts";
import { createInitialSensorData, simulateNextSensorData } from "./sensorSimulator.ts";
import type { SensorData, SensorMode } from "./sensorSimulator.ts";
export { checks, withinProfile };
export type DemoMode = SensorMode;
export type Measurements = SensorData;
export type Screen = "JOB" | "LIVE" | "HOLD" | "ROUTE" | "RELEASE";
export const job = { project: receiverProfile.project, id: receiverProfile.jobId,
  material: receiverProfile.material, volume: "500 t", window: "14–18 Oct",
  receiver: receiverProfile.receiver, distance: `${receiverProfile.distanceKm} km`,
  profile: receiverProfile.profileId, fallback: "Existing Cleanfill", fallbackDistance: "71 km" };
export const baseline = { ...createInitialSensorData("PASS"), processedMass: 20.4 };
export const sample = (mode: DemoMode, previous: Measurements) => simulateNextSensorData(previous, mode, 0);
export type ReleaseRecord = {
  batch: number;
  batchId: string;
  mass: number;
  measurements: Measurements;
  timestamp: string;
  profile: string;
  receiver: string;
  distance: string;
};
export type ProcessState = "RUNNING" | "FEED_PAUSED" | "MACHINE_FAULT" | "EMERGENCY_STOP";
export type IsolatedBatch = {
  batch: number; mass: number; bay: string; measurements: Measurements;
  routeReview: boolean;
};
export type HmiState = {
  screen: Screen; demo: DemoMode; measurements: Measurements;
  batch: number; mass: number; processed: number; held: boolean;
  holdEvidence: Measurements | null; isolated: boolean; retesting: boolean;
  routeReview: boolean; release: ReleaseRecord | null; message: string;
  process: ProcessState; bayAvailable: boolean; isolatedBatches: IsolatedBatch[];
};
export const initialState: HmiState = {
  screen: "JOB", demo: "PASS", measurements: baseline, batch: 37,
  mass: 20.4, processed: 126.4, held: false, holdEvidence: null,
  isolated: false, retesting: false, routeReview: false, release: null,
  message: "", process: "FEED_PAUSED", bayAvailable: false, isolatedBatches: [],
};
export type Action =
  | { type: "LOAD" | "ISOLATE" | "RETEST" | "NEXT" | "LIVE" | "HOLD_DETAILS" | "ROUTE" | "CONTINUE_NEXT" | "PAUSE_FEED" | "RESUME_FEED" | "RESET_MACHINE" }
  | { type: "REQUEST_ROUTE"; batch?: number }
  | { type: "BAY_AVAILABLE"; available: boolean }
  | { type: "MACHINE_EVENT"; event: "MACHINE_FAULT" | "EMERGENCY_STOP" }
  | { type: "DEMO"; mode: DemoMode }
  | { type: "SENSOR_TICK"; seconds: number }
  | { type: "TICK"; measurements: Measurements; seconds: number }
  | { type: "RETEST_RESULT"; measurements: Measurements }
  | { type: "RELEASE"; timestamp: string };
const stopped = (s: HmiState) => s.process === "MACHINE_FAULT" || s.process === "EMERGENCY_STOP";
const pause = (s: HmiState): ProcessState => stopped(s) ? s.process : "FEED_PAUSED";
export const canIsolate = (s: HmiState) => s.held && !s.isolated && s.bayAvailable && s.isolatedBatches.length === 0;
export const canContinue = (s: HmiState) => s.held && s.isolated && !s.retesting && !stopped(s);
export const canRelease = (s: HmiState) => s.screen === "LIVE" && !s.held && !s.routeReview && !s.retesting && !stopped(s) && s.mass > 0 && withinProfile(s.measurements);
// All new-batch status comes from sampled values, never from the demo mode label.
function freshBatch(s: HmiState) {
  const measurements = createInitialSensorData(s.demo);
  const held = !withinProfile(measurements);
  return { measurements, held, holdEvidence: held ? { ...measurements } : null,
    screen: held ? "HOLD" as const : "LIVE" as const,
    process: held ? "FEED_PAUSED" as const : "RUNNING" as const };
}
export function reducer(s: HmiState, a: Action): HmiState {
  switch (a.type) {
    case "LOAD":
      return s.screen === "JOB" ? { ...s, screen: "LIVE", process: withinProfile(s.measurements) ? "RUNNING" : "FEED_PAUSED", held: !withinProfile(s.measurements), holdEvidence: withinProfile(s.measurements) ? null : s.measurements } : s;
    case "BAY_AVAILABLE":
      return s.isolated || s.isolatedBatches.length ? s : { ...s, bayAvailable: a.available };
    case "MACHINE_EVENT":
      return s.screen === "JOB" || s.screen === "RELEASE" || (s.process === "EMERGENCY_STOP" && a.event === "MACHINE_FAULT") ? s : { ...s, process: a.event, message: "Demo machine stop. Material batch status is unchanged." };
    case "RESET_MACHINE":
      return stopped(s) ? { ...s, process: "FEED_PAUSED", message: "Demo stop reset. Feed remains paused until explicitly resumed." } : s;
    case "PAUSE_FEED":
      return s.screen === "JOB" || s.screen === "RELEASE" ? s : { ...s, process: pause(s) };
    case "RESUME_FEED":
      return s.screen !== "JOB" && s.screen !== "RELEASE" && !s.held && !s.retesting && !stopped(s) ? { ...s, process: "RUNNING", message: "Feed resumed. Isolated batches remain on HOLD." } : s;
    case "DEMO":
      return s.screen === "RELEASE" || s.retesting ? s : { ...s, demo: a.mode };
    case "SENSOR_TICK": {
      if (s.screen === "JOB" || s.screen === "RELEASE" || s.retesting || stopped(s)) return s;
      const moving = s.process === "RUNNING" && !s.held;
      const measurements = simulateNextSensorData({ ...s.measurements, processedMass: s.mass }, s.demo, moving ? a.seconds : 0);
      return reducer(s, { type: "TICK", measurements, seconds: a.seconds });
    }
    case "TICK": {
      if (s.screen === "JOB" || s.screen === "RELEASE" || s.retesting || stopped(s)) return s;
      const failed = !withinProfile(a.measurements);
      const amount = s.process === "RUNNING" && !s.held && !failed && Number.isFinite(a.measurements.flowRate) && Number.isFinite(a.seconds) ? Math.max(0,a.measurements.flowRate)*Math.max(0,Math.min(a.seconds,2))/3600 : 0;
      return { ...s, measurements: { ...a.measurements, processedMass: s.mass+amount }, mass: s.mass+amount, processed: s.processed+amount,
        held: s.held || failed, holdEvidence: failed ? (s.holdEvidence ?? a.measurements) : s.holdEvidence,
        process: failed ? pause(s) : s.process, screen: failed && !s.held && s.screen === "LIVE" ? "HOLD" : s.screen };
    }
    case "ISOLATE":
      return canIsolate(s) ? { ...s, isolated: true, bayAvailable: false, screen: "HOLD", process: pause(s), message: `Batch #${String(s.batch).padStart(3,"0")} isolated in HOLD BAY A. Feed remains paused until the next batch is started.` } : s;
    case "CONTINUE_NEXT":
      return canContinue(s) ? { ...s, isolatedBatches: [...s.isolatedBatches, { batch: s.batch, mass: s.mass, bay: "HOLD BAY A", measurements: { ...(s.holdEvidence ?? s.measurements) }, routeReview: s.routeReview }], batch: s.batch+1, mass: 0, isolated: false, routeReview: false, release: null, message: "Next batch started on a separate material path. Previous batch remains isolated; HOLD BAY A is occupied.", ...freshBatch(s) } : s;
    case "RETEST":
      return s.held && s.isolated && !s.retesting && !stopped(s) ? { ...s, retesting: true, demo: "PASS", screen: "HOLD", message: "Taking a new simulated sample…" } : s;
    case "RETEST_RESULT": {
      if (!s.retesting) return s;
      const pass=withinProfile(a.measurements); const clear=pass && !s.routeReview;
      return { ...s, retesting:false, measurements:{...a.measurements,processedMass:s.mass}, held:!clear, isolated:clear ? false : s.isolated,
        holdEvidence:clear ? null : a.measurements, screen:clear ? "LIVE" : "HOLD",
        message: clear ? "Retest PASS for the loaded receiver profile. Feed remains paused; review the batch before release or resume." : pass ? "Retest PASS. Route review is still pending; batch remains isolated. Do not release until a valid receiver pathway is confirmed." : "Retest HOLD. Batch remains isolated." };
    }
    case "RELEASE":
      return canRelease(s) ? { ...s, screen:"RELEASE", process:"FEED_PAUSED", release:{ batch:s.batch,batchId:`${job.id}-${String(s.batch).padStart(3,"0")}`,mass:s.mass,measurements:{...s.measurements},timestamp:a.timestamp,profile:job.profile,receiver:job.receiver,distance:job.distance },message:"" } : s;
    case "NEXT":
      return s.screen === "RELEASE" ? { ...s,batch:s.batch+1,mass:0,release:null,isolated:false,retesting:false,routeReview:false,message:"New batch started. Previous isolated batches remain on HOLD.", ...freshBatch(s) } : s;
    case "LIVE":
      return s.screen !== "JOB" && s.screen !== "RELEASE" && !s.retesting ? { ...s,screen:"LIVE" } : s;
    case "HOLD_DETAILS": return s.held ? { ...s,screen:"HOLD" } : s;
    case "ROUTE": return s.held && !s.retesting ? { ...s,screen:"ROUTE" } : s;
    case "REQUEST_ROUTE": {
      if (a.batch !== undefined && a.batch !== s.batch) {
        if (!s.isolatedBatches.some(b=>b.batch===a.batch)) return s;
        return { ...s, isolatedBatches:s.isolatedBatches.map(b=>b.batch===a.batch ? {...b,routeReview:true} : b), message:`ROUTE REVIEW REQUESTED — Batch #${String(a.batch).padStart(3,"0")} remains isolated. Do not release until a valid receiver pathway is confirmed.` };
      }
      return s.held && s.isolated && !s.retesting ? { ...s,routeReview:true,screen:"ROUTE",message:`ROUTE REVIEW REQUESTED — Batch #${String(s.batch).padStart(3,"0")} remains isolated. Do not release until a valid receiver pathway is confirmed.` } : s;
    }
    default: return s;
  }
}
