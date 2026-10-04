# ReGround HMI workflow

React + Vite + TypeScript demo in the existing HMI project.

## Run and checks

Use a supported modern Node runtime. Run `npm run dev`, `npm run build`, `npm run lint`, and `node --test tests/*.mjs`.

## Material and process states

Material HOLD is a batch disposition state, independent of a machine fault or emergency stop. The header shows PROCESS RUNNING / FEED PAUSED / MACHINE FAULT / EMERGENCY STOP; the material indicator and batch card show conformance and isolation separately.

1. LOAD JOB starts batch #037 with seeded batch mass 20.4 t and total 126.4 t. Live simulated readings arrive every 1.5 seconds.
2. DEMO HOLD latches the current material batch on HOLD. Feed pauses initially while segregation is unresolved; this does not represent a site-wide excavation shutdown or machine failure.
3. Confirm `HOLD BAY A has safe segregation capacity`, then ISOLATE BATCH. The action is replaced by BATCH #… ISOLATED / HOLD BAY A, RETEST, REQUEST ROUTE REVIEW, and CONTINUE WITH BATCH #… . No space means feed remains paused.
4. REQUEST ROUTE REVIEW records a local demo request and shows: `ROUTE REVIEW REQUESTED. Batch #… remains isolated. Do not release until a valid receiver pathway is confirmed.` There is no dispatch, email, external service, or receiver approval.
5. RETEST requires isolation. Select demo PASS then retest for a sample within the original profile. A passing retest clears the material hold only if no route review is pending. Feed remains paused until explicitly resumed. A pending route review is not cleared by a passing sample.
6. CONTINUE WITH BATCH #… keeps the original batch and mass in a separate isolated-batch record and starts the next batch at zero mass. Processed total is retained. It assumes the operator has physically segregated the previous material and the next stream can use a separate path. Material HOLD and PROCESS RUNNING can appear together.
7. The demo models one HOLD bay. While the earlier batch occupies it, another HOLD cannot reuse it and pauses feed. The isolated record remains visible and can request route review independently of the active batch. Receiver approval, stored-batch retesting/release and bay clearance are not implemented; there is no automatic clearance of these records.
8. PASS material with a positive batch mass can be released to the original profile if there is no current hold, pending current-batch route review, machine fault or emergency stop. Release freezes the batch summary. NEXT preserves all isolated records.
9. Demo machine condition can independently simulate MACHINE FAULT or EMERGENCY STOP. Both freeze mass accumulation and block release/continuation. Reset changes the process only to FEED PAUSED, never automatically to RUNNING. This UI is not a physical safety controller.

State and requests are in memory and reset on reload. No hardware, persistent audit log or external requests are connected. Site/material calibration and receiver acceptance remain outside this demo.

## Files

- `src/hmi.ts`: state transitions, gates and simulation.
- `src/App.tsx`: screens, controls and simulation timers.
- `src/App.css`: HMI layout and state/isolated-batch cards.
- `tests/hmi.test.mjs`, `tests/isolation.test.mjs`: 11 tests for thresholds, hold/retest/release, mass isolation, bay capacity, pending route review and machine stops.


## Functional simulated sensor prototype
`receiverProfile.ts` is the local planning JSON contract. `conformance.ts` checks
moisture 14–22%, fines >=70%, oversize <=5% (inclusive; invalid readings fail).
`sensorSimulator.ts` produces fresh readings each second; PASS/HOLD controls select
sensor ranges only. The reducer derives material conformance from readings. HOLD
stays latched until an isolated batch successfully retests; pending route review
still blocks release. RETEST deliberately samples PASS for the demo.
Feed-paused samples do not accumulate mass. Release freezes the current readings,
mass, profile, receiver and release timestamp. Next batch resets batch sensor mass;
the cumulative processed total retains its existing demo opening balance.
Visual consistency remains in sensor data, without adding a new UI row.

Test: Load Job → observe PASS → Release → Next Batch → HOLD demo → wait one second
→ confirm bay capacity → Isolate → Retest → PASS. In a separate held batch, Isolate
→ Request Route Review → Return to Live; no route approval is inferred.
Run `node --test tests/*.test.mjs`, `npm run build`, `npm run dev`.
Sensors, machine actuation, material flow and trucks remain simulated. No hardware,
PLC, MQTT, receiver API or backend integration is implemented. No merge to main.
