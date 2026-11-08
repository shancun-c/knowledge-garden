import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore, RevisionConflict } from '../lib/file-store.ts';
const empty = { nodes: [], cards: [], links: [] };
test('persistent state, revision conflicts and previous backup', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'knowledge-test-'));
  try {
    const store = new FileStore(dir);
    assert.equal((await store.read('owner')).revision, 0);
    await assert.rejects(store.write('owner', empty, 99), RevisionConflict);
    const results = await Promise.allSettled([store.write('owner', empty, 0), store.write('owner', empty, 0)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await new FileStore(dir).read('owner')).revision, 1);
    const state = { ...empty, nodes: [{ id:'test', name:'Test', parent:null }] };
    assert.equal(await store.write('owner', state, 1), 2);
    const persisted=(await new FileStore(dir).read('owner')).state;
    assert.deepEqual({...persisted,studySettings:undefined,studyDay:undefined},{...state,studySettings:undefined,studyDay:undefined});
    assert.equal(persisted.studySettings?.dailyNewLimit,10);
    const backup = (await readdir(dir)).find(n => n.endsWith('.previous'))!;
    assert.equal(JSON.parse(await readFile(join(dir, backup), 'utf8')).revision, 1);
    assert.equal((await store.read('other')).revision, 0);
  } finally { await rm(dir, { recursive:true, force:true }); }
});

test('FSRS memory and logs persist atomically and old writers cannot discard them',async()=>{
 const {sampleState,schedule,stateSchema}=await import('../lib/model.ts');
 const {SchedulerVersionConflict}=await import('../lib/file-store.ts');
 const dir=await mkdtemp(join(tmpdir(),'knowledge-fsrs-'));
 try{
  const store=new FileStore(dir),state=sampleState();
  state.schedulerVersion=2;state.cards[0]=schedule(state.cards[0],2,Date.now());
  await store.write('owner',state,0);
  const restored=await new FileStore(dir).read('owner');
  assert.deepEqual({...stateSchema.parse(restored.state),studySettings:undefined,studyDay:undefined},{...state,studySettings:undefined,studyDay:undefined});
  const {schedulerVersion,...old}=state;
  await assert.rejects(store.write('owner',old,1),SchedulerVersionConflict);
  assert.equal((await store.read('owner')).revision,1);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('notes survive old clients, scheduling and export; explicit empty notes clears',async()=>{
 const {sampleState,stateSchema,schedule}=await import('../lib/model.ts');
 const dir=await mkdtemp(join(tmpdir(),'knowledge-notes-'));
 try{
  const store=new FileStore(dir),s=sampleState();s.cards[0].notes='我的思考\n- 一个例子';
  await store.write('owner',s,0);
  const old=stateSchema.parse(s);delete old.cards[0].notes;
  await store.write('owner',old,1);
  const restored=stateSchema.parse(JSON.parse(JSON.stringify((await store.read('owner')).state)));
  assert.equal(restored.cards[0].notes,s.cards[0].notes);
  assert.equal(schedule(restored.cards[0],2,Date.now()).notes,s.cards[0].notes);
  assert.equal(restored.cards[0].due,s.cards[0].due);assert.equal(restored.cards[0].reviews,0);
  restored.cards[0].notes='';await store.write('owner',restored,2);
  assert.equal((await store.read('owner')).state.cards[0].notes,'');
  restored.cards[0].notes='x'.repeat(12001);assert.equal(stateSchema.safeParse(restored).success,false);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('comment notes append, retry by id without duplicates and survive older clients',async()=>{
 const {sampleState,stateSchema}=await import('../lib/model.ts');
 const dir=await mkdtemp(join(tmpdir(),'knowledge-comments-'));
 try{
  const store=new FileStore(dir),s=sampleState();s.cards[0].notes='原有笔记';
  s.cards[0].comments=[{id:'first',text:'第一次思考',createdAt:1}];await store.write('owner',s,0);
  s.cards[0].comments=[{id:'first',text:'第一次思考补充',createdAt:1},{id:'second',text:'新的思考',createdAt:2}];await store.write('owner',s,1);await store.write('owner',s,2);
  const older=sampleState();await store.write('owner',older,3);
  const c=stateSchema.parse((await store.read('owner')).state).cards[0];
  assert.equal(c.notes,'原有笔记');assert.equal(c.comments?.length,2);assert.equal(c.comments?.[0].text,'第一次思考补充');assert.equal(c.reviews,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('explicit comment edits and deletion persist without changing other notes or schedule',async()=>{
 const {sampleState}=await import('../lib/model.ts');const dir=await mkdtemp(join(tmpdir(),'knowledge-comment-crud-'));
 try{
  const store=new FileStore(dir),s=sampleState(),due=s.cards[0].due;s.cards[0].notes='旧备注';s.cards[0].comments=[{id:'a',text:'A',createdAt:1},{id:'b',text:'B',createdAt:2}];await store.write('owner',s,0);
  s.cards[0].comments[0].text='修改 A';await store.write('owner',s,1);
  assert.equal((await store.read('owner')).state.cards[0].comments?.[0].text,'修改 A');
  s.cards[0].comments=s.cards[0].comments.filter(c=>c.id!=='a');s.cards[0].notes='';await store.write('owner',s,2);
  const c=(await new FileStore(dir).read('owner')).state.cards[0];assert.deepEqual(c.comments,[{id:'b',text:'B',createdAt:2}]);assert.equal(c.notes,'');assert.equal(c.due,due);assert.equal(c.reviews,0);
  s.cards[0].comments=[];await store.write('owner',s,3);assert.deepEqual((await store.read('owner')).state.cards[0].comments,[]);
 }finally{await rm(dir,{recursive:true,force:true})}
});
