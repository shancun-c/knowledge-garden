import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {default_w,fsrs,createEmptyCard} from 'ts-fsrs';
import {FileStore,RevisionConflict} from '../lib/file-store.ts';
import {Optimizer,OptimizationBlocked} from '../lib/fsrs-optimizer.ts';
import {trainingData} from '../lib/fsrs-training-data.ts';
import {improves,weightsSchema} from '../lib/fsrs-personalization.ts';
import {historyFixture} from './fixtures/fsrs-history.ts';
import {previewDue,schedule,stateSchema} from '../lib/model.ts';
const metrics=(n:number)=>({logLoss:n,rmseBins:n/2});
const result={weights:[...default_w],defaultMetrics:metrics(.8),currentMetrics:metrics(.8),candidateMetrics:metrics(.6)};
test('dataset uses chronological full prefixes, excludes same-day endpoints and invalid histories',()=>{
 const state=historyFixture(),d=trainingData(state);
 assert.equal(d.stats.totalLogs,650);assert.equal(d.stats.eligibleSamples,600);assert.equal(d.stats.canTrain,true);
 assert.ok(Math.max(...d.train.map(i=>i.at))<Math.min(...d.validation.map(i=>i.at)));
 assert.equal(d.train[0].reviews[0].deltaT,0);
 const c=state.cards[0];c.reviewLog![1].review=c.reviewLog![0].review+60000;
 assert.equal(trainingData(state).stats.sameDay,1);
 c.reviewLog![1].review=c.reviewLog![0].review;
 assert.equal(trainingData(state).stats.excludedLogs,13);
 const empty=trainingData({...state,cards:[]});assert.equal(empty.stats.canTrain,false);
 const one={...state,cards:state.cards.slice(0,1)};assert.equal(trainingData(one).stats.canTrain,false);
 const remembered=historyFixture();for(const c of remembered.cards)for(const l of c.reviewLog!)l.rating=3;
 assert.equal(trainingData(remembered).stats.canTrain,false);
});
test('parameter policy validates ranges and requires holdout improvement',()=>{
 assert.equal(improves(metrics(.5),metrics(.8),metrics(.7)),true);
 assert.equal(improves(metrics(.8),metrics(.8),metrics(.7)),false);
 assert.equal(weightsSchema.safeParse([1,2]).success,false);
 assert.equal(weightsSchema.safeParse(default_w.map(()=>9999)).success,false);
});
test('personal profile previews and reviews replay real history without changing due early',()=>{
 const card=historyFixture().cards[1],before=JSON.stringify(card),weights=[...default_w];weights[8]=3;
 const profile={id:'fsrs6-personal-test',weights,createdAt:Date.now()},now=Date.now();
 const f=fsrs({w:weights,enable_fuzz:false});let memory=createEmptyCard(new Date(card.reviewLog![0].review));
 for(const l of card.reviewLog!)memory=f.next(memory,new Date(l.review),l.rating).card;
 memory.due=new Date(card.due);
 const expected=f.next(memory,new Date(now),3).card;
 assert.equal(previewDue(card,2,now,profile),expected.due.getTime());assert.equal(JSON.stringify(card),before);
 const next=schedule(card,2,now,profile);assert.equal(next.fsrs?.profile,profile.id);assert.equal(next.reviewLog!.at(-1)!.profile,profile.id);
 assert.equal(next.due,expected.due.getTime());assert.equal(stateSchema.safeParse({...historyFixture(),cards:[next],links:[]}).success,true);
 assert.ok(Number.isFinite(previewDue(next,2,next.due)));
});
test('optimizer applies once, preserves concurrent reviews, isolates owners and supports reset',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fsrs-opt-'));try{
  const store=new FileStore(dir);await store.mutate('a',()=>historyFixture());
  let release!:(r:typeof result)=>void;
  const service=new Optimizer(store,()=>new Promise(resolve=>{release=resolve}));
  const work=service.optimize('a');
  while(!release)await new Promise(r=>setTimeout(r,1));
  assert.equal((await service.status('a')).optimization.lastRun?.status,'running');
  await assert.rejects(service.optimize('b'),OptimizationBlocked);
  await store.mutate('a',p=>({...p.state,cards:p.state.cards.map((c,i)=>i===0?{...c,front:'并发编辑保留'}:c)}));
  release(result);const status=await work;
  assert.equal(status.optimization.lastRun?.status,'applied');assert.equal(status.optimization.profiles.length,1);
  const saved=await store.read('a');assert.equal(saved.state.cards[0].front,'并发编辑保留');
  assert.equal((await service.status('b')).optimization.active,undefined);
  await assert.rejects(service.optimize('a'),OptimizationBlocked);
  const stale={...saved.state,optimization:undefined};await store.write('a',stale,saved.revision);
  assert.ok((await store.read('a')).state.optimization?.active);
  await assert.rejects(store.write('a',stale,saved.revision),RevisionConflict);
  await service.reset('a');assert.equal((await service.status('a')).optimization.active,undefined);
  assert.equal((await service.status('a')).optimization.lastRun?.status,'applied');
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('insufficient data, non-improvement, failure and interrupted jobs never replace active parameters',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fsrs-opt-errors-'));try{
  const store=new FileStore(dir);let calls=0;
  const service=new Optimizer(store,async()=>{calls++;throw Error('测试训练失败')});
  await assert.rejects(service.optimize('empty'),OptimizationBlocked);assert.equal(calls,0);
  const state=historyFixture();state.optimization={profiles:[],active:{id:'fsrs6-personal-existing',weights:[...default_w],createdAt:1}};
  await store.mutate('a',()=>state);
  const failed=await service.optimize('a');assert.equal(failed.optimization.lastRun?.status,'failed');assert.ok(failed.optimization.active);
  const worse=new Optimizer(store,async()=>({...result,candidateMetrics:metrics(.9)}));
  const skipped=await worse.optimize('a');assert.equal(skipped.optimization.lastRun?.status,'not_improved');assert.equal(skipped.optimization.active?.id,'fsrs6-personal-existing');
  await store.mutate('a',p=>({...p.state,optimization:{...p.state.optimization!,lastRun:{...p.state.optimization!.lastRun!,status:'running',startedAt:Date.now()-80000}}}));
  assert.equal((await worse.status('a')).optimization.lastRun?.status,'failed');
 }finally{await rm(dir,{recursive:true,force:true})}
});
