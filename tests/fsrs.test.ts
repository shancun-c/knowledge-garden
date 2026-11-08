import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEmptyCard, fsrs as library} from 'ts-fsrs';
import {sampleState,schedule,previewDue,intervalLabel,stateSchema} from '../lib/model.ts';
import {FSRS_PROFILE} from '../lib/fsrs.ts';
const now=Date.UTC(2026,9,31,1);
const fresh=()=>({...sampleState().cards[0],due:now});
test('all four ratings match pinned FSRS and preview does not mutate or log',()=>{
 const c=fresh(),before=JSON.stringify(c),f=library({enable_fuzz:false});
 for(const g of [0,1,2,3]){
  const expected=f.next(createEmptyCard(now),now,(g+1) as 1|2|3|4).card;
  assert.equal(previewDue(c,g,now),expected.due.getTime());
  const result=schedule(c,g,now);
  assert.equal(result.due,expected.due.getTime());
  assert.equal(result.fsrs?.memory.stability,expected.stability);
  assert.equal(result.reviewLog?.length,1);
  assert.equal(result.reviewLog?.[0].rating,g+1);
  assert.equal(result.reviewLog?.[0].profile,FSRS_PROFILE);
 }
 assert.equal(JSON.stringify(c),before);
 assert.equal(intervalLabel(c,0,now),'1 分钟后');
 assert.equal(intervalLabel(c,1,now),'6 分钟后');
 assert.equal(intervalLabel(c,2,now),'10 分钟后');
 assert.equal(intervalLabel(c,3,now),'8 天后');
 assert.throws(()=>schedule(c,4,now));
});
test('learning graduates and forgotten reviews enter relearning; history survives JSON round trip',()=>{
 let c=schedule(fresh(),2,now);
 assert.equal(c.fsrs?.memory.state,1);
 c=schedule(c,2,c.due);
 assert.equal(c.fsrs?.memory.state,2);
 const reviewedAt=c.due;
 c=schedule(c,0,reviewedAt);
 assert.equal(c.fsrs?.memory.state,3);
 assert.equal(c.fsrs?.memory.lapses,1);
 assert.equal(c.due,reviewedAt+600000);
 const state={...sampleState(),links:[],cards:[c],schedulerVersion:2};
 const restored=stateSchema.parse(JSON.parse(JSON.stringify(state))).cards[0];
 assert.deepEqual(restored,c);
 assert.deepEqual(schedule(restored,2,c.due),schedule(c,2,c.due));
 assert.equal(c.reviewLog?.length,3);
 assert.equal(c.reviews,3);
 assert.throws(()=>schedule(c,2,reviewedAt-1),/设备时间/);
});
test('legacy cards keep due and summary until actual review; no fabricated history',()=>{
 const old={...fresh(),due:now+86400000,interval:21,ease:2.1,reps:5,reviews:12};
 const parsed=stateSchema.parse({...sampleState(),links:[],cards:[old]}).cards[0];
 assert.deepEqual(parsed,old);
 previewDue(parsed,2,now);
 assert.equal(parsed.fsrs,undefined);
 const next=schedule(parsed,2,old.due);
 assert.equal(next.reviews,13);
 assert.deepEqual(next.fsrs?.legacy,{strategy:'cold-start',due:old.due,interval:21,ease:2.1,reps:5,reviews:12});
 assert.equal(next.reviewLog?.length,1);
 const again=schedule(next,2,next.due);
 assert.deepEqual(again.fsrs?.legacy,next.fsrs?.legacy);
 assert.equal(again.reviewLog?.length,2);
});
test('schema rejects corrupt FSRS state and ratings instead of stripping data',()=>{
 const c=schedule(fresh(),3,now);
 const valid={...sampleState(),links:[],cards:[c]};
 assert.equal(stateSchema.safeParse(valid).success,true);
 const invalid=JSON.parse(JSON.stringify(valid));
 invalid.cards[0].fsrs.memory.stability=-1;
 assert.equal(stateSchema.safeParse(invalid).success,false);
 invalid.cards[0]=JSON.parse(JSON.stringify(c));
 invalid.cards[0].reviewLog[0].rating=0;
 assert.equal(stateSchema.safeParse(invalid).success,false);
});
