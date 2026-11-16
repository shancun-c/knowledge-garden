import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sampleState,stateSchema,schedule} from '../lib/model.ts';
import {stateChanges,changesSchema} from '../lib/state-changes.ts';
import {FileStore} from '../lib/file-store.ts';

test('stars are optional for legacy cards, strictly boolean, and survive review and export',()=>{
 const state=sampleState();
 assert.equal(stateSchema.parse(state).cards[0].starred,undefined);
 state.cards[0].starred=true;
 assert.equal(stateSchema.parse(JSON.parse(JSON.stringify(state))).cards[0].starred,true);
 assert.equal(schedule(state.cards[0],2,Date.now()).starred,true);
 assert.equal(stateSchema.safeParse({...state,cards:[{...state.cards[0],starred:'true'}]}).success,false);
});

test('star and unstar persist through PATCH, reload and older clients without changing card content or schedule',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'knowledge-stars-'));
 try{
  const store=new FileStore(dir),initial=sampleState();initial.schedulerVersion=3;
  await store.write('owner',initial,0);
  const starred={...initial,cards:initial.cards.map((c,i)=>i?c:{...c,starred:true})};
  const changes=changesSchema.parse(stateChanges(initial,starred));
  assert.deepEqual(changes.upsert?.map(c=>c.id),[initial.cards[0].id]);
  await store.writeChanges('owner',changes,1);
  let saved=await new FileStore(dir).read('owner');
  assert.deepEqual(saved.state.cards,starred.cards);
  // A legacy full save and a legacy single-card edit both omit the unknown field.
  await store.write('owner',initial,2);
  await store.writeChanges('owner',{schedulerVersion:3,upsert:[{...initial.cards[0],front:'修改问题'}]},3);
  saved=await store.read('owner');
  assert.equal(saved.state.cards[0].starred,true);
  const unstarred={...saved.state,cards:saved.state.cards.map((c,i)=>i?c:{...c,starred:false})};
  await store.writeChanges('owner',changesSchema.parse(stateChanges(saved.state,unstarred)),4);
  const restored=(await new FileStore(dir).read('owner')).state;
  assert.deepEqual(restored.cards,unstarred.cards);
  assert.deepEqual(restored.cards[0],{...initial.cards[0],front:'修改问题',starred:false});
  assert.deepEqual(restored.links,initial.links);
 }finally{await rm(dir,{recursive:true,force:true})}
});
