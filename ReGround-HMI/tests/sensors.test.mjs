import { test } from "node:test";
import assert from "node:assert/strict";
import { reducer, initialState, canRelease } from "../src/hmi.ts";
import { createInitialSensorData, simulateNextSensorData } from "../src/sensorSimulator.ts";
import { checks, withinProfile } from "../src/conformance.ts";
import { receiverProfile } from "../src/receiverProfile.ts";
const live = () => reducer(structuredClone(initialState), {type:"LOAD"});
test("demo mode changes no reading or decision until a simulated sample arrives",()=>{
 const s=live();const mode=reducer(s,{type:"DEMO",mode:"HOLD"});
 assert.deepEqual(mode.measurements,s.measurements);assert.equal(mode.held,false);
 const next=reducer(mode,{type:"SENSOR_TICK",seconds:1});assert.equal(next.held,true);
 assert.equal(next.screen,"HOLD");assert.ok(next.measurements.moisture>22);
 assert.deepEqual(checks(next.measurements).map(c=>c.pass),[false,true,true]);
});
test("profile input controls thresholds, including all inclusive boundaries",()=>{
 const m=createInitialSensorData("PASS");assert.equal(withinProfile(m),true);
 const custom=structuredClone(receiverProfile);custom.acceptance.moisture.max=18;
 assert.equal(withinProfile(m,custom),false);
 for(const moisture of [14,22])assert.equal(withinProfile({...m,moisture,fineFraction:70,oversize:5}),true);
 for(const moisture of [NaN,Infinity,13.9,22.1])assert.equal(withinProfile({...m,moisture}),false);
});
test("simulation mass uses dt; pauses take fresh readings without mass; route screen remains open",()=>{
 const m=createInitialSensorData("PASS");const n=simulateNextSensorData(m,"PASS",1,()=>.5);
 assert.equal(n.processedMass,13.8/3600);
 let s=reducer(live(),{type:"PAUSE_FEED"});const mass=s.mass;
 s=reducer(s,{type:"DEMO",mode:"HOLD"});s=reducer(s,{type:"SENSOR_TICK",seconds:1});assert.equal(s.mass,mass);
 s=reducer(s,{type:"ROUTE"});s=reducer(s,{type:"SENSOR_TICK",seconds:1});assert.equal(s.screen,"ROUTE");
});
test("release snapshot stays immutable, next batch resets sensor mass",()=>{
 let s=reducer(live(),{type:"SENSOR_TICK",seconds:1});const measurements={...s.measurements};
 s=reducer(s,{type:"RELEASE",timestamp:"2026-10-04T00:00:00Z"});
 assert.deepEqual(s.release.measurements,measurements);const snapshot=structuredClone(s.release);
 assert.deepEqual(reducer(s,{type:"SENSOR_TICK",seconds:1}).release,snapshot);
 s=reducer(s,{type:"NEXT"});assert.equal(s.batch,38);assert.equal(s.measurements.processedMass,0);assert.equal(s.mass,0);
 assert.equal(canRelease(s),false);
});
test("retest selects PASS simulation but cannot approve a pending receiver route",()=>{
 let s=reducer(live(),{type:"DEMO",mode:"HOLD"});s=reducer(s,{type:"SENSOR_TICK",seconds:1});
 s=reducer(s,{type:"BAY_AVAILABLE",available:true});s=reducer(s,{type:"ISOLATE"});
 s=reducer(s,{type:"REQUEST_ROUTE"});s=reducer(s,{type:"RETEST"});assert.equal(s.demo,"PASS");
 s=reducer(s,{type:"RETEST_RESULT",measurements:createInitialSensorData("PASS")});
 assert.equal(s.held,true);assert.equal(s.isolated,true);assert.equal(canRelease(s),false);
});
