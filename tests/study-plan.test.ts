import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sampleState,schedule,studyCards} from '../lib/model.ts';
import {FileStore,RevisionConflict} from '../lib/file-store.ts';
import {applyStudyPolicy,dailyBudget,studyDayKey,studyQueue,reconcileQueue,weakCards,NewCardLimitExceeded} from '../lib/study-plan.ts';
const now=Date.parse('2026-11-03T04:00:00Z');
function seed(){const s=sampleState();s.cards=s.cards.map(c=>({...c,due:now-1000}));return s}
test('daily limit is global across topics and resets at China midnight',()=>{
 let s=seed();s.studySettings={dailyNewLimit:1};const before=s.cards[0];s=applyStudyPolicy(s,{...s,cards:s.cards.map(c=>c.id===before.id?schedule(c,2,now):c)},now);
 assert.deepEqual(dailyBudget(s,now),{limit:1,used:1,remaining:0});
 assert.equal(studyQueue(s,studyCards(s,'thinking'),now).newCount,0);
 assert.equal(dailyBudget(s,Date.parse('2026-11-03T15:59:59Z')).remaining,0);
 assert.equal(dailyBudget(s,Date.parse('2026-11-03T16:00:00Z')).remaining,1);
 assert.equal(studyDayKey(Date.parse('2026-11-03T16:00:00Z')),'2026-11-04');
});
test('relearning automatically returns once due, never early and never duplicated',()=>{
 const s=seed();s.studySettings={dailyNewLimit:0};const c=schedule(s.cards[0],0,now);s.cards=[c];
 const waiting=studyQueue(s,s.cards,now);assert.deepEqual(waiting.ids,[]);assert.equal(waiting.nextDue,c.due);assert.equal(waiting.waitingCount,1);
 assert.deepEqual(studyQueue(s,s.cards,c.due-1).ids,[]);assert.deepEqual(studyQueue(s,s.cards,c.due).ids,[c.id]);
 assert.deepEqual(reconcileQueue([c.id],[c.id]),[c.id]);assert.deepEqual(reconcileQueue(['reading'],['newly-due','reading']),['reading','newly-due']);
});
test('undo releases only first-rating quota; deletion and spoofed counters do not',()=>{
 let s=seed();s.studySettings={dailyNewLimit:1};const original=s.cards[0];const graded={...s,cards:s.cards.map(c=>c.id===original.id?schedule(c,2,now):c)};const saved=applyStudyPolicy(s,graded,now);
 const deleted=applyStudyPolicy(saved,{...saved,cards:saved.cards.filter(c=>c.id!==original.id),studyDay:{day:studyDayKey(now),introducedIds:[]}},now);
 assert.equal(dailyBudget(deleted,now).remaining,0);
 const restored=applyStudyPolicy(saved,{...saved,cards:saved.cards.map(c=>c.id===original.id?original:c)},now);assert.equal(dailyBudget(restored,now).remaining,1);
 assert.throws(()=>applyStudyPolicy(saved,{...saved,cards:saved.cards.map(c=>c.id===s.cards[1].id?schedule(c,2,now):c)},now),NewCardLimitExceeded);
});
test('legacy first FSRS rating is not a new introduction and missing settings preserve prior limit',()=>{
 const s=seed();s.cards=[schedule({...s.cards[0],reviews:12},2,now)];s.studySettings={dailyNewLimit:0};assert.equal(dailyBudget(s,now).used,0);
 const {studySettings,...oldClient}=s;const result=applyStudyPolicy(s,oldClient,now);assert.equal(result.studySettings?.dailyNewLimit,0);
});
test('weak cards use recent evidence, recover after three good ratings, and skip unseen cards',()=>{
 const s=seed();let weak=s.cards[0];weak=schedule(weak,0,now);weak=schedule(weak,0,now+60000);s.cards=[weak,s.cards[1]];
 assert.equal(weakCards(s.cards).length,1);assert.match(weakCards(s.cards)[0].reason,/2 次忘记/);
 for(let i=0;i<3;i++)weak=schedule(weak,2,now+(i+2)*86400000);
 assert.equal(weakCards([weak]).length,0);
 assert.equal(studyQueue(s,s.cards,now,[]).ids.length,0);
});
test('serialized server quota enforcement and revision checks protect two-device writes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'study-policy-'));try{
 const store=new FileStore(dir),s=seed();s.studySettings={dailyNewLimit:1};await store.write('u',s,0);
 const a={...s,cards:s.cards.map((c,i)=>i===0?schedule(c,2,Date.now()):c)};
 const b={...s,cards:s.cards.map((c,i)=>i===1?schedule(c,2,Date.now()):c)};
 const results=await Promise.allSettled([store.write('u',a,1),store.write('u',b,1)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.ok(results.some(r=>r.status==='rejected'&&r.reason instanceof RevisionConflict));
 const latest=await store.read('u');const next={...latest.state,cards:latest.state.cards.map((c,i)=>i===1?schedule(c,2,Date.now()):c)};await assert.rejects(store.write('u',next,latest.revision),NewCardLimitExceeded);
 assert.equal((await store.read('u')).revision,latest.revision);
 }finally{await rm(dir,{recursive:true,force:true})}
});
