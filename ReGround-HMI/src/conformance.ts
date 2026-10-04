import { receiverProfile } from "./receiverProfile.ts";
import type { ReceiverProfile } from "./receiverProfile.ts";
import type { SensorData } from "./sensorSimulator.ts";
type Reading = Pick<SensorData, "moisture" | "fineFraction" | "oversize">;
export function checks(m: Reading, profile: ReceiverProfile = receiverProfile) {
  const { moisture, fineFraction, oversize } = profile.acceptance;
  const percent = (v: number) => Number.isFinite(v) && v >= 0 && v <= 100;
  return [
    { key: "moisture", name: "Moisture", value: m.moisture, limit: `${moisture.min}–${moisture.max} %`,
      pass: percent(m.moisture) && m.moisture >= moisture.min && m.moisture <= moisture.max },
    { key: "fineFraction", name: "Fine fraction", value: m.fineFraction, limit: `≥ ${fineFraction.min} %`,
      pass: percent(m.fineFraction) && m.fineFraction >= fineFraction.min },
    { key: "oversize", name: "Oversize", value: m.oversize, limit: `≤ ${oversize.max} %`,
      pass: percent(m.oversize) && m.oversize <= oversize.max },
  ];
}
export const withinProfile = (m: Reading, profile: ReceiverProfile = receiverProfile) => checks(m, profile).every(c => c.pass);
