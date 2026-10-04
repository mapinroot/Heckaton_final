import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baseline,
  canRelease,
  initialState,
  reducer as reduceHmi,
  sample,
  withinProfile,
} from "../src/hmi.ts";
// A demo click alone is not a sample. Advance one sensor tick for these workflow scenarios.
const reducer = (s, a) => {
  const next = reduceHmi(s, a);
  return a.type === "DEMO" ? reduceHmi(next, { type: "SENSOR_TICK", seconds: 1 }) : next;
};
const live = () => reducer(structuredClone(initialState), { type: "LOAD" });
test("profile limits are inclusive; individual violations and missing data HOLD", () => {
  for (const moisture of [14, 22])
    assert.equal(
      withinProfile({ ...baseline, moisture, fineFraction: 70, oversize: 5 }),
      true,
    );
  for (const delta of [
    { moisture: 13.9 },
    { moisture: 22.1 },
    { fineFraction: 69.9 },
    { oversize: 5.1 },
    { moisture: NaN },
  ])
    assert.equal(withinProfile({ ...baseline, ...delta }), false);
});
test("HOLD blocks release and stays latched until a successful retest", () => {
  let s = reducer(live(), { type: "DEMO", mode: "HOLD" });
  assert.equal(s.screen, "HOLD");
  assert.equal(canRelease(s), false);
  const blocked = reducer(s, {
    type: "RELEASE",
    timestamp: "2026-10-03T00:00:00Z",
  });
  assert.equal(blocked.release, null);
  s = reducer(s, { type: "BAY_AVAILABLE", available: true });
  s = reducer(s, { type: "ISOLATE" });
  assert.equal(s.isolated, true);
  s = reducer(s, { type: "DEMO", mode: "PASS" });
  s = reducer(s, { type: "LIVE" });
  assert.equal(canRelease(s), false);
  s = reducer(s, { type: "RETEST" });
  assert.equal(canRelease(s), false);
  s = reducer(s, { type: "RETEST_RESULT", measurements: baseline });
  assert.equal(s.screen, "LIVE");
  assert.equal(canRelease(s), true);
});
test("failed retest retains HOLD and fallback review never authorizes release", () => {
  let s = reducer(live(), { type: "DEMO", mode: "HOLD" });
  s = reducer(s, { type: "BAY_AVAILABLE", available: true });
  s = reducer(s, { type: "ISOLATE" });
  s = reducer(s, { type: "RETEST" });
  s = reducer(s, {
    type: "RETEST_RESULT",
    measurements: { ...baseline, oversize: 7 },
  });
  assert.equal(s.held, true);
  s = reducer(s, { type: "ROUTE" });
  s = reducer(s, { type: "REQUEST_ROUTE" });
  assert.equal(s.routeReview, true);
  assert.equal(canRelease(s), false);
  s = reducer(s, { type: "LIVE" });
  assert.equal(canRelease(s), false);
});
test("release freezes exact readings, mass, identifiers and timestamp; next batch resets only batch mass", () => {
  const s = live();
  const released = reducer(s, {
    type: "RELEASE",
    timestamp: "2026-10-03T00:00:00Z",
  });
  assert.equal(released.release.batchId, "WRK-014-037");
  assert.equal(released.release.mass, s.mass);
  assert.deepEqual(released.release.measurements, s.measurements);
  assert.deepEqual(
    reducer(released, {
      type: "TICK",
      measurements: { ...baseline, moisture: 26 },
      seconds: 1.5,
    }),
    released,
  );
  assert.deepEqual(reducer(released, { type: "DEMO", mode: "HOLD" }), released);
  const next = reducer(released, { type: "NEXT" });
  assert.equal(next.batch, 38);
  assert.equal(next.mass, 0);
  assert.equal(next.processed, s.processed);
  assert.equal(next.release, null);
  assert.equal(canRelease(next), false);
});
test("mass integrates t/h into tonnes and pauses during HOLD", () => {
  const s = live();
  const tick = reducer(s, {
    type: "TICK",
    measurements: baseline,
    seconds: 1.5,
  });
  assert.ok(Math.abs(tick.mass - s.mass - (13.8 * 1.5) / 3600) < 1e-10);
  const held = reducer(s, { type: "DEMO", mode: "HOLD" });
  assert.equal(
    reducer(held, {
      type: "TICK",
      measurements: held.measurements,
      seconds: 1.5,
    }).mass,
    s.mass,
  );
});
test("both demo scenarios stay in their promised ranges through repeated drift", () => {
  for (const mode of ["PASS", "HOLD"]) {
    let m = baseline;
    for (let i = 0; i < 2000; i++) {
      m = sample(mode, m);
      assert.equal(withinProfile(m), mode === "PASS");
      assert.ok(m.flowRate >= 12 && m.flowRate <= 15);
      assert.ok(m.fineFraction >= 73 && m.fineFraction <= 78);
      assert.ok(m.oversize >= 1.5 && m.oversize <= 3.5);
      assert.ok(
        mode === "PASS"
          ? m.moisture >= 17 && m.moisture <= 20.5
          : m.moisture >= 23.5 && m.moisture <= 26.5,
      );
    }
  }
});
