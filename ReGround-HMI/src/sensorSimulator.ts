export type SensorMode = "PASS" | "HOLD";
export type SensorData = {
  moisture: number; fineFraction: number; oversize: number; flowRate: number;
  processedMass: number; visualConsistency: number; timestamp: string;
};
export function createInitialSensorData(mode: SensorMode): SensorData {
  return { moisture: mode === "PASS" ? 18.4 : 25, fineFraction: 76.1,
    oversize: 2.3, flowRate: 13.8, processedMass: 0, visualConsistency: 96,
    timestamp: new Date().toISOString() };
}
// Units: percentages, tonnes/hour, tonnes. dt=0 samples without moving material.
export function simulateNextSensorData(previous: SensorData, mode: SensorMode,
  dtSeconds: number, random = Math.random): SensorData {
  const drift = (value: number, min: number, max: number, step: number) =>
    Math.round(Math.max(min, Math.min(max, value + (random() - .5) * 2 * step)) * 10) / 10;
  const flowRate = drift(previous.flowRate, 12, 15, .4);
  const seconds = Number.isFinite(dtSeconds) ? Math.max(0, Math.min(dtSeconds, 2)) : 0;
  return { moisture: drift(previous.moisture, mode === "PASS" ? 17 : 23.5, mode === "PASS" ? 20.5 : 26.5, .35),
    fineFraction: drift(previous.fineFraction, 73, 78, .5), oversize: drift(previous.oversize, 1.5, 3.5, .2),
    flowRate, processedMass: previous.processedMass + flowRate * seconds / 3600,
    visualConsistency: drift(previous.visualConsistency, 92, 99, .4), timestamp: new Date().toISOString() };
}
