import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sampleState,schedule,type KnowledgeState} from '../lib/model.ts';
import {stateChanges,applyStateChanges,changesSchema,InvalidStateChanges} from '../lib/state-changes.ts';
import {FileStore,RevisionConflict} from '../lib/file-store.ts';
import {NewCardLimitExceeded} from '../lib/study-plan.ts';

test('single-card notes and review changes omit every unchanged card and graph',()=>{
 const s=sampleState();s.schedulerVersion=3;
 const next={...s,cards:s.cards.map((c,i)=>i?c:{...c,comments:[{id:'n',text:'note',createdAt:1}]})};
 const changes=stateChanges(s,next);
 assert.deepEqual(Object.keys(changes),['schedulerVersion','upsert']);
 assert.equal(changes.upsert?.length,1);
 assert.deepEqual(applyStateChanges(s,changes),next);
 const reviewed={...s,cards:s.cards.map((c,i)=>i?c:schedule(c,2,Date.now()))};
 assert.deepEqual(applyStateChanges(s,stateChanges(s,reviewed)),reviewed);
 assert.deepEqual(applyStateChanges(reviewed,stateChanges(reviewed,s)),s);
});

test('incremental create, delete, reorder, node change and import match desired state',()=>{
 const s=sampleState();s.schedulerVersion=3;
 const scenarios:KnowledgeState[]=[
  {...s,cards:[...s.cards,{...s.cards[0],id:'new'}]},
  {...s,cards:s.cards.slice(1),links:s.links.filter(l=>l.from!==s.cards[0].id&&l.to!==s.cards[0].id)},
  {...s,cards:[...s.cards].reverse()},
  {...s,nodes:s.nodes.map((n,i)=>i?n:{...n,name:'renamed'}),studySettings:{dailyNewLimit:4}},
  {schedulerVersion:3,nodes:[],cards:[],links:[]},
 ];
 for(const next of scenarios)assert.deepEqual(applyStateChanges(s,changesSchema.parse(stateChanges(s,next))),next);
 const changes=stateChanges(s,scenarios[2]);assert.equal(changes.upsert,undefined);assert.equal(changes.order?.length,s.cards.length);
});

test('reject malformed or dangling changes, and server-owned fields',()=>{
 const s=sampleState();
 for(const changes of [
  {schedulerVersion:3 as const,order:[s.cards[0].id]},
  {schedulerVersion:3 as const,upsert:[s.cards[0],s.cards[0]]},
  {schedulerVersion:3 as const,upsert:[s.cards[0]],remove:[s.cards[0].id]},
  {schedulerVersion:3 as const,remove:[s.cards[0].id]},
  {schedulerVersion:3 as const,upsert:[{...s.cards[0],node:'missing'}]},
 ])assert.throws(()=>applyStateChanges(s,changes),InvalidStateChanges);
 assert.equal(changesSchema.safeParse({schedulerVersion:3,optimization:{}}).success,false);
 assert.equal(changesSchema.safeParse({schedulerVersion:3,studyDay:{}}).success,false);
});

test('patch persistence keeps conflicts, undo and new-card limits atomic',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'changes-'));
 try{
  const store=new FileStore(dir),s=sampleState();s.schedulerVersion=3;s.studySettings={dailyNewLimit:1};
  await store.write('test',s,0);
  const next={...s,cards:s.cards.map((c,i)=>i?c:schedule(c,2,Date.now()))};
  const race=await Promise.allSettled([store.writeChanges('test',stateChanges(s,next),1),store.writeChanges('test',stateChanges(s,next),1)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
  assert.ok(race.some(r=>r.status==='rejected'&&r.reason instanceof RevisionConflict));
  const saved=await store.read('test');assert.deepEqual(saved.state.cards,next.cards);
  const extra={...saved.state,cards:saved.state.cards.map((c,i)=>i===1?schedule(c,2,Date.now()):c)};
  await assert.rejects(store.writeChanges('test',stateChanges(saved.state,extra),2),NewCardLimitExceeded);
  assert.equal((await store.read('test')).revision,2);
  const undone=await store.writeChanges('test',stateChanges(next,s),2);
  assert.deepEqual(undone.state.cards,s.cards);assert.deepEqual(undone.state.studyDay?.introducedIds,[]);
 }finally{await rm(dir,{recursive:true,force:true})}
});
