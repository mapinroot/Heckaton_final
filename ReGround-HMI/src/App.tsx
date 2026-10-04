import { useEffect, useReducer } from "react";
import {
  canRelease,
  canIsolate,
  canContinue,
  checks,
  initialState,
  job,
  reducer,
} from "./hmi";
import type { Measurements } from "./hmi";
import { createInitialSensorData, simulateNextSensorData } from "./sensorSimulator";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { screen, measurements, demo, held, retesting, release } = state;
  useEffect(() => {
    if (screen === "JOB" || screen === "RELEASE" || retesting) return;
    const timer = window.setInterval(() => dispatch({ type: "SENSOR_TICK", seconds: 1 }), 1000);
    return () => window.clearInterval(timer);
  }, [screen, retesting]);
  useEffect(() => {
    if (!retesting) return;
    const timer = window.setTimeout(() => dispatch({ type: "RETEST_RESULT",
      measurements: simulateNextSensorData(createInitialSensorData(demo), demo, 0) }), 1500);
    return () => window.clearTimeout(timer);
  }, [retesting, demo]);
  const batch = String(state.batch).padStart(3, "0");
  const failureChecks = checks(state.holdEvidence ?? measurements).filter(
    (c) => !c.pass,
  );
  const materialStatus =
    screen === "JOB"
      ? "READY"
      : screen === "RELEASE"
        ? "RELEASED"
        : held
          ? "HOLD"
          : "PASS";
  const machineStopped = state.process === "MACHINE_FAULT" || state.process === "EMERGENCY_STOP";
  const holdActions = (
    <div className="action-stack">
      {state.isolated ? (
        <div className="isolation-confirmation" role="status">
          <strong>BATCH #{batch} ISOLATED</strong><span>HOLD BAY A</span>
        </div>
      ) : (
        <>
          <label className="bay-confirmation">
            <input type="checkbox" checked={state.bayAvailable} disabled={state.isolatedBatches.length > 0}
              onChange={e => dispatch({ type: "BAY_AVAILABLE", available: e.target.checked })} />
            HOLD BAY A has safe segregation capacity
          </label>
          <button className="button amber" disabled={!canIsolate(state) || retesting}
            onClick={() => dispatch({ type: "ISOLATE" })}>ISOLATE BATCH</button>
          {!state.bayAvailable && <small>FEED PAUSED · {state.isolatedBatches.length ? "HOLD BAY A is occupied." : "Confirm safe segregation space before isolation."}</small>}
        </>
      )}
      <div className="button-pair">
        <button className="button" disabled={!state.isolated || retesting || machineStopped}
          onClick={() => dispatch({ type: "RETEST" })}>{retesting ? "RETESTING…" : "RETEST"}</button>
        <button className="button" disabled={retesting || state.routeReview}
          onClick={() => dispatch({ type: state.isolated ? "REQUEST_ROUTE" : "ROUTE" })}>
          {state.routeReview ? "ROUTE REVIEW REQUESTED" : state.isolated ? "REQUEST ROUTE REVIEW" : "CHECK ALTERNATIVE ROUTE"}
        </button>
      </div>
      {state.isolated && <button className="button green" disabled={!canContinue(state)}
        onClick={() => dispatch({ type: "CONTINUE_NEXT" })}>CONTINUE WITH BATCH #{String(state.batch + 1).padStart(3, "0")} →</button>}
    </div>
  );

  return (
    <div className="hmi">
      <header className="topbar">
        <div className="brand">
          <span>
            Re<span className="clay-text">Ground</span>
          </span>
          <small>MATERIAL VERIFICATION SYSTEM</small>
        </div>
        <span className="demo-label">HACKATHON DEMO · SIMULATED DATA</span>
        <span
          className={`machine-state ${state.process !== "RUNNING" ? "amber-text" : ""}`}
        >
          <span className="state-dot" />
          {state.process === "RUNNING" ? "PROCESS RUNNING" : state.process.replaceAll("_", " ")}
        </span>
        <span className="job-id">
          JOB <strong>{job.id}</strong>
        </span>
      </header>
      <div className="screen-bar">
        <span className="eyebrow">
          {screen === "JOB"
            ? "01 / LOAD JOB"
            : screen === "RELEASE"
              ? "03 / BATCH RELEASE"
              : screen === "ROUTE"
                ? "02 / ALTERNATIVE ROUTE"
                : "02 / LIVE PROCESSING"}
        </span>
        <span>Conformance to pre-approved receiver profile</span>
      </div>
      <main>
        {screen !== "JOB" && <section className="operating-state-bar" aria-label="Process and material states">
          <span className={`pill ${held || state.isolatedBatches.length ? "hold" : "pass"}`}>
            {held || state.isolatedBatches.length ? "MATERIAL HOLD" : `MATERIAL ${materialStatus}`}
          </span>
          <span>Machine: {machineStopped ? state.process.replaceAll("_", " ") : "NO FAULT"}</span>
          <span>{held ? "Current batch awaiting a confirmed material pathway." : state.isolatedBatches.length ? state.process === "RUNNING" ? "Isolated batch held separately; current stream is running." : "Isolated batch held separately; current feed is stopped." : "Current batch uses the loaded receiver profile."}</span>
          {screen !== "RELEASE" && (machineStopped
            ? <button className="button" onClick={() => dispatch({ type: "RESET_MACHINE" })}>RESET DEMO STOP</button>
            : <button className="button" disabled={state.process !== "RUNNING" && (held || retesting)} onClick={() => dispatch({ type: state.process === "RUNNING" ? "PAUSE_FEED" : "RESUME_FEED" })}>{state.process === "RUNNING" ? "PAUSE FEED" : "RESUME FEED"}</button>)}
        </section>}
        {state.isolatedBatches.map(b => <section className="isolated-record" key={b.batch} aria-label={`Isolated batch ${b.batch}`}>
          <div><strong>BATCH #{String(b.batch).padStart(3, "0")} ISOLATED · {b.bay}</strong><p>{b.mass.toFixed(2)} t · {b.routeReview ? "ROUTE REVIEW REQUESTED" : "MATERIAL HOLD"}</p><small>Do not release until a valid receiver pathway is confirmed.</small></div>
          <button className="button" disabled={b.routeReview} onClick={() => dispatch({ type: "REQUEST_ROUTE", batch: b.batch })}>{b.routeReview ? "ROUTE REVIEW REQUESTED" : "REQUEST ROUTE REVIEW"}</button>
        </section>)}
        {screen === "JOB" && (
          <section className="job-screen" aria-labelledby="job-title">
            <div className="page-heading">
              <div>
                <span className="eyebrow">PLANNING → FIELD VERIFICATION</span>
                <h1 id="job-title">Load prepared job</h1>
                <p>
                  Verify the actual material against the receiver profile
                  prepared before excavation.
                </p>
              </div>
              <span className="pill neutral">SYSTEM READY</span>
            </div>
            <div className="panel job-card">
              <div className="job-card-header">
                <div>
                  <span className="eyebrow">JOB {job.id}</span>
                  <h2>{job.project}</h2>
                </div>
                <span className="pill conditional">CONDITIONALLY ACCEPTED</span>
              </div>
              <div className="job-information">
                <Field label="Material" value={job.material} />
                <Field label="Expected volume" value={job.volume} />
                <Field label="Excavation window" value={job.window} />
                <Field label="Receiver" value={job.receiver} />
                <Field label="Distance" value={job.distance} />
                <Field label="Receiver profile" value={job.profile} />
              </div>
              <span className="eyebrow">ACCEPTANCE ENVELOPE</span>
              <div className="acceptance-box">
                <Field label="Moisture" value={checks(measurements)[0].limit} />
                <Field label="Fine fraction" value={checks(measurements)[1].limit} />
                <Field label="Oversize" value={checks(measurements)[2].limit} />
              </div>
              <div className="job-footer">
                <span className="precheck">
                  ● Required planning evidence available
                </span>
                <button
                  className="button clay"
                  onClick={() => dispatch({ type: "LOAD" })}
                >
                  LOAD JOB &amp; START →
                </button>
              </div>
            </div>
            <div className="fallback-card">
              <span className="eyebrow">FALLBACK ROUTE</span>
              <strong>{job.fallback}</strong>
              <span>{job.fallbackDistance} · Known acceptance pathway</span>
              <span className="small-note">
                Final acceptance remains with the receiving party
              </span>
            </div>
          </section>
        )}

        {screen !== "JOB" && (
          <section className="project-strip" aria-label="Loaded job">
            <Field label="Project" value={job.project} />
            <Field label="Receiver" value={job.receiver} />
            <Field label="Route distance" value={job.distance} />
            <Field label="Profile" value={job.profile} />
            <Field label="Batch" value={`#${batch}`} />
          </section>
        )}

        {(screen === "LIVE" || screen === "HOLD") && (
          <>
            <div className="main-grid">
              <section
                className="panel sensor-panel"
                aria-labelledby="stream-title"
              >
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      {retesting ? "NEW SAMPLE" : state.process === "RUNNING" ? "LIVE DATA · EVERY 1 s" : "LIVE DATA · FEED STOPPED"}
                    </span>
                    <h2 id="stream-title">Material stream</h2>
                  </div>
                  <span className="pill neutral">
                    {held ? "BATCH HELD" : "SIMULATED LIVE"}
                  </span>
                </div>
                <Sensors measurements={measurements} />
                <div className="secondary-grid">
                  <Metric
                    label="Flow rate · monitor only"
                    value={state.process === "RUNNING" ? measurements.flowRate.toFixed(1) : "0.0"}
                    unit="t/h"
                  />
                  <Metric
                    label="Processed total"
                    value={state.processed.toFixed(2)}
                    unit="t"
                  />
                  <Metric
                    label={`Batch #${batch} mass`}
                    value={state.mass.toFixed(2)}
                    unit="t"
                  />
                </div>
                <p className="small-note">
                  {held
                    ? "This batch is on HOLD. Feed is paused pending isolation or recovery."
                    : state.batch === 37
                      ? "Demo opening balances: batch 20.4 t · total 126.4 t."
                      : "New batch mass starts at zero; processed total is retained."}{" "}
                  Flow rate has no receiver acceptance limit.
                </p>
              </section>
              <section
                className={`panel status-panel ${held ? "status-hold" : "status-pass"}`}
                aria-label="Batch conformance"
              >
                <div className="panel-heading">
                  <span className="eyebrow">CONFORMANCE STATUS</span>
                  <span className={`pill ${held ? "hold" : "pass"}`}>
                    {held ? "HOLD" : "PASS"}
                  </span>
                </div>
                <h1>{held ? state.isolated ? `BATCH #${batch} ISOLATED` : "HOLD BATCH" : "WITHIN PROFILE"}</h1>
                <p>
                  {held
                    ? checks(measurements).every((c) => c.pass)
                      ? state.routeReview ? "Route review pending. Batch remains isolated." : "Batch remains on HOLD pending a passing retest."
                      : "Batch does not currently conform to the receiver profile."
                    : "Material conforms to the loaded receiver profile."}
                </p>
                {held ? (
                  <>
                    <div className="failure-list">
                      {failureChecks.map((c) => (
                        <div key={c.key}>
                          <strong>
                            {c.name} {c.value.toFixed(1)} %
                          </strong>
                          <span>Receiver limit {c.limit}</span>
                        </div>
                      ))}
                      <small>
                        Hold-trigger sample · a passing retest is required
                      </small>
                    </div>
                    {holdActions}
                  </>
                ) : (
                  <>
                    <div className="status-meta">
                      <Field label="Receiver profile" value={job.profile} />
                      <Field
                        label="Planning status"
                        value="CONDITIONALLY ACCEPTED"
                      />
                    </div>
                    <button
                      className="button green"
                      disabled={!canRelease(state)}
                      onClick={() =>
                        dispatch({
                          type: "RELEASE",
                          timestamp: new Date().toISOString(),
                        })
                      }
                    >
                      RELEASE FOR HAULAGE →
                    </button>
                    {state.mass === 0 && (
                      <p className="small-note">
                        Waiting for the first simulated material reading.
                      </p>
                    )}
                  </>
                )}
                {held && (
                  <button
                    className="button text-button"
                    disabled={retesting}
                    onClick={() =>
                      dispatch({
                        type: screen === "HOLD" ? "LIVE" : "HOLD_DETAILS",
                      })
                    }
                  >
                    {screen === "HOLD" ? "RETURN TO LIVE" : "VIEW HOLD DETAILS"}
                  </button>
                )}
              </section>
            </div>
            {screen === "HOLD" ? (
              <section className="panel guidance">
                <span className="eyebrow">BATCH RECOVERY</span>
                <p>
                  Isolate batch → dry / reprocess if relevant → retest. Check an
                  alternative receiver or use the fallback disposal route if
                  required, subject to receiving-party acceptance.
                </p>
              </section>
            ) : (
              <section className="panel output-panel">
                <div className="panel-heading">
                  <h2>Separated output</h2>
                  <span className="small-note">
                    Illustrative demo mass split · 100%
                  </span>
                </div>
                <div className="fraction-grid">
                  <Fraction
                    title="COARSE"
                    value={measurements.oversize}
                    detail="Retained coarse fraction"
                  />
                  <Fraction
                    title="MEDIUM"
                    value={
                      100 - measurements.fineFraction - measurements.oversize
                    }
                    detail="Intermediate fraction"
                  />
                  <Fraction
                    title="FINES"
                    value={measurements.fineFraction}
                    detail="Clay-rich candidate stream"
                  />
                </div>
              </section>
            )}
          </>
        )}

        {screen === "ROUTE" && (
          <section className="panel route-panel">
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  BATCH #{batch} · REMAINS ON HOLD
                </span>
                <h1>{state.routeReview ? "ROUTE REVIEW REQUESTED" : "Alternative route"}</h1>
                {state.routeReview ? <p>Batch #{batch} remains isolated.<br />Do not release until a valid receiver pathway is confirmed.</p> : <p>Review another receiver or the prepared fallback pathway.</p>}
              </div>
              <span className="pill hold">HOLD</span>
            </div>
            <div className="route-options">
              <div>
                <span className="eyebrow">FALLBACK ROUTE</span>
                <h2>{job.fallback}</h2>
                <p>{job.fallbackDistance} · Known acceptance pathway</p>
              </div>
              <div>
                <span className="eyebrow">ALTERNATIVE RECEIVER</span>
                <h2>Receiver review required</h2>
                <p>
                  Confirm a suitable receiver and its acceptance envelope before
                  any release.
                </p>
              </div>
            </div>
            <p>
              The loaded {job.profile} does not establish acceptance at another
              destination. Final acceptance remains with the receiving party.
            </p>
            {!state.isolated && <p className="amber-text">Isolate the batch before requesting route review. Return to HOLD to confirm the bay.</p>}
            <p className="small-note">Demo request recorded locally · no external request is sent.</p>
            <div className="route-actions">
              <button
                className="button clay"
                disabled={state.routeReview || !state.isolated}
                onClick={() => dispatch({ type: "REQUEST_ROUTE" })}
              >
                {state.routeReview ? "ROUTE REVIEW REQUESTED" : "REQUEST ROUTE REVIEW"}
              </button>
              <button
                className="button"
                onClick={() => dispatch({ type: "HOLD_DETAILS" })}
              >
                BACK TO HOLD
              </button>
              <button
                className="button"
                onClick={() => dispatch({ type: "LIVE" })}
              >
                RETURN TO LIVE
              </button>
            </div>
          </section>
        )}

        {screen === "RELEASE" && release && (
          <section className="panel release-panel">
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  BATCH #{String(release.batch).padStart(3, "0")} · RELEASE
                  RECORD
                </span>
                <h1>RELEASED FOR HAULAGE</h1>
                <p>Frozen batch summary · demonstration record</p>
              </div>
              <span className="pill pass">RECEIVER PROFILE: PASS</span>
            </div>
            <div className="release-values">
              <Metric
                label="Batch mass"
                value={release.mass.toFixed(2)}
                unit="t"
              />
              <Metric
                label="Moisture"
                value={release.measurements.moisture.toFixed(1)}
                unit="%"
              />
              <Metric
                label="Fine fraction"
                value={release.measurements.fineFraction.toFixed(1)}
                unit="%"
              />
              <Metric
                label="Oversize"
                value={release.measurements.oversize.toFixed(1)}
                unit="%"
              />
            </div>
            <div className="job-information">
              <Field label="Destination" value={release.receiver} />
              <Field label="Distance" value={release.distance} />
              <Field label="Receiver profile ID" value={release.profile} />
              <Field label="Batch ID" value={release.batchId} />
              <Field
                label="Timestamp · Pacific/Auckland"
                value={new Intl.DateTimeFormat("en-NZ", {
                  dateStyle: "medium",
                  timeStyle: "medium",
                  timeZone: "Pacific/Auckland",
                }).format(new Date(release.timestamp))}
              />
              <Field label="Receiver profile" value="PASS" />
            </div>
            <div className="job-footer">
              <p>Final acceptance remains with the receiving party.</p>
              <button
                className="button green"
                onClick={() => dispatch({ type: "NEXT" })}
              >
                START NEXT BATCH →
              </button>
            </div>
          </section>
        )}
        <div className="feedback" role="status">
          {state.message}
        </div>
      </main>
      <footer className="bottom-bar">
        <p className="notice">
          Conformance check against pre-approved receiver profile.
          <br />
          ReGround does not provide legal, contamination or engineering
          certification.
          <br />
          Final acceptance remains with the relevant professionals and receiving
          party.
        </p>
        <div className="demo-controls">
          <span>
            DEMO CONTROL<small>Hackathon demonstration only</small>
          </span>
          <select aria-label="Demo machine condition" value={machineStopped ? state.process : "NORMAL"} disabled={screen === "JOB" || screen === "RELEASE"}
            onChange={e => { if (e.target.value === "NORMAL") dispatch({ type: "RESET_MACHINE" }); else dispatch({ type: "MACHINE_EVENT", event: e.target.value as "MACHINE_FAULT" | "EMERGENCY_STOP" }); }}>
            <option value="NORMAL">MACHINE NORMAL</option><option value="MACHINE_FAULT">MACHINE FAULT</option><option value="EMERGENCY_STOP">EMERGENCY STOP</option>
          </select>
          {(["PASS", "HOLD"] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={demo === mode}
              disabled={screen === "RELEASE" || retesting}
              className={`button ${demo === mode ? (mode === "PASS" ? "selected-pass" : "selected-hold") : ""}`}
              onClick={() => dispatch({ type: "DEMO", mode })}
            >
              {mode}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </div>
  );
}
function Sensors({ measurements }: { measurements: Measurements }) {
  return (
    <div>
      {checks(measurements).map((c) => (
        <div
          className={`sensor-row ${c.pass ? "" : "out-of-range"}`}
          key={c.key}
        >
          <div>
            <strong>{c.name}</strong>
            <small>Receiver limit {c.limit}</small>
          </div>
          <strong className="sensor-value">
            {c.value.toFixed(1)} <small>%</small>
          </strong>
          <span className={`pill ${c.pass ? "pass" : "hold"}`}>
            {c.pass ? "PASS" : "OUT OF RANGE"}
          </span>
        </div>
      ))}
    </div>
  );
}
function Fraction({
  title,
  value,
  detail,
}: {
  title: string;
  value: number;
  detail: string;
}) {
  return (
    <div className={`fraction-card ${title === "FINES" ? "highlighted" : ""}`}>
      <div>
        <span>{title}</span>
        <strong>
          {value.toFixed(1)}
          <small>%</small>
        </strong>
      </div>
      <div className="progress-track">
        <div style={{ width: `${value}%` }} />
      </div>
      <small>{detail}</small>
    </div>
  );
}
export default App;
