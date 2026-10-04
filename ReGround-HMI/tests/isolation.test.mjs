import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reducer as reduceHmi, baseline, canRelease, canContinue } from '../src/hmi.ts';
// A demo click alone is not a sample. Advance one sensor tick for these workflow scenarios.
const reducer = (s, a) => {
  const next = reduceHmi(s, a);
  return a.type === "DEMO" ? reduceHmi(next, { type: "SENSOR_TICK", seconds: 1 }) : next;
};
const live = () => reducer(structuredClone(initialState), { type:'LOAD' });
const hold = () => reducer(live(), {type:'DEMO',mode:'HOLD'});
const isolate = () => reducer(reducer(hold(), {type:'BAY_AVAILABLE',available:true}),{type:'ISOLATE'});
test('no bay capacity: hold pauses feed without fault and cannot isolate or continue',()=>{
 const s=hold(); assert.equal(s.process,'FEED_PAUSED'); assert.equal(s.held,true);
 assert.equal(reducer(s,{type:'ISOLATE'}),s); assert.equal(reducer(s,{type:'CONTINUE_NEXT'}),s);
 assert.equal(reducer(s,{type:'REQUEST_ROUTE'}),s); assert.equal(reducer(s,{type:'RESUME_FEED'}),s);
});
test('isolation persists while next batch runs; bay cannot be assigned twice',()=>{
 const s=reducer(isolate(),{type:'DEMO',mode:'PASS'}); assert.equal(canContinue(s),true);
 let n=reducer(s,{type:'CONTINUE_NEXT'}); assert.equal(n.batch,38); assert.equal(n.mass,0); assert.equal(n.process,'RUNNING');
 assert.equal(n.isolatedBatches[0].batch,37); assert.equal(n.isolatedBatches[0].mass,s.mass);
 n=reducer(n,{type:'DEMO',mode:'PASS'}); n=reducer(n,{type:'TICK',measurements:baseline,seconds:1.5});
 assert.ok(n.mass>0); assert.equal(n.isolatedBatches[0].mass,s.mass);
 n=reducer(n,{type:'REQUEST_ROUTE',batch:37}); assert.equal(n.isolatedBatches[0].routeReview,true); assert.equal(n.routeReview,false);
 n=reducer(n,{type:'DEMO',mode:'HOLD'}); assert.equal(n.process,'FEED_PAUSED');
 assert.equal(reducer(n,{type:'BAY_AVAILABLE',available:true}),n); assert.equal(reducer(n,{type:'ISOLATE'}),n);
});
test('route review does not clear isolation, and passing retest cannot bypass pending pathway',()=>{
 let s=reducer(isolate(),{type:'REQUEST_ROUTE'});
 s=reducer(s,{type:'DEMO',mode:'PASS'});s=reducer(s,{type:'RETEST'});s=reducer(s,{type:'RETEST_RESULT',measurements:baseline});
 assert.equal(s.held,true);assert.equal(s.isolated,true);assert.equal(canRelease(s),false);
 assert.equal(reducer(s,{type:'LIVE'}).routeReview,true);
});
test('fault and emergency stop preserve material state, stop mass, and reset only to paused',()=>{
 for(const event of ['MACHINE_FAULT','EMERGENCY_STOP']){
  let s=reducer(live(),{type:'MACHINE_EVENT',event});assert.equal(s.held,false);assert.equal(canRelease(s),false);
  assert.equal(reducer(s,{type:'TICK',measurements:baseline,seconds:1.5}),s);
  s=reducer(s,{type:'RESET_MACHINE'});assert.equal(s.process,'FEED_PAUSED');
  s=reducer(s,{type:'RESUME_FEED'});assert.equal(s.process,'RUNNING');
 }
 let s=reducer(isolate(),{type:'MACHINE_EVENT',event:'EMERGENCY_STOP'});
 assert.equal(canContinue(s),false);s=reducer(s,{type:'MACHINE_EVENT',event:'MACHINE_FAULT'});assert.equal(s.process,'EMERGENCY_STOP');
});
test('invalid tick duration cannot corrupt totals',()=>{
 const s=live();const n=reducer(s,{type:'TICK',measurements:baseline,seconds:NaN}); assert.equal(n.mass,s.mass);
});
