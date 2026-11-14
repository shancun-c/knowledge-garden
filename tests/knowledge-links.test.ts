import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sampleState,studyCards} from '../lib/model.ts';
import {putLink,relatedCards,newSuggestions,networkScope,graphPositions} from '../lib/knowledge-links.ts';
import {FileStore,RevisionConflict} from '../lib/file-store.ts';
import {stateChanges} from '../lib/state-changes.ts';
test('manual links are bidirectional, editable and reject duplicate/self/dangling pairs',()=>{
 const s=sampleState(),link={id:'manual',from:'active',to:'first',reason:'  原理与实践  '};
 const next=putLink(s,link);assert.equal(next.links.at(-1)?.reason,'原理与实践');
 assert.equal(relatedCards(next,'first')[0].card.id,'active');assert.ok(relatedCards(next,'active').some(x=>x.card.id==='first'));
 const edited=putLink(next,{...link,reason:'修订理由'});assert.equal(edited.links.length,next.links.length);assert.equal(edited.links.at(-1)?.reason,'修订理由');
 for(const bad of [{...link,id:'other',from:'first',to:'active'},{...link,from:'active',to:'active'},{...link,to:'missing'},{...link,reason:' '},{...link,reason:'x'.repeat(1001)}])assert.throws(()=>putLink(next,bad));
 assert.throws(()=>putLink(next,{...link,to:'chunk'}));
});
test('AI candidates are scope-bound, deduplicated in both directions and capped',()=>{
 const s=sampleState(),candidates=[{from:'active',to:'first',reason:'新的联系'},{from:'first',to:'active',reason:'反向'},{from:'active',to:'spacing',reason:'已有'},{from:'active',to:'active',reason:'自身'},{from:'active',to:'missing',reason:'不存在'},{from:'first',to:'chunk',reason:' '},null];
 assert.equal(newSuggestions(s.cards,s.links,candidates).length,1);assert.equal(newSuggestions(studyCards(s,'learning'),s.links,candidates).length,0);assert.deepEqual(newSuggestions(s.cards,s.links,{}),[]);
 const many=Array.from({length:20},(_,i)=>({...s.cards[0],id:String(i)}));assert.equal(newSuggestions(many,[],many.slice(1).map(c=>({from:'0',to:c.id,reason:'联系'}))).length,12);
});
test('scope expansion is exactly one hop, with explicit focus and isolated cards',()=>{
 let s=sampleState();s=putLink(s,{id:'cross',from:'active',to:'first',reason:'跨主题'});s=putLink(s,{id:'outside',from:'first',to:'load',reason:'第二跳'});
 const scope=studyCards(s,'method');assert.equal(networkScope(s.cards,s.links,scope,false,false).cards.length,0);
 const cross=networkScope(s.cards,s.links,scope,true,false);assert.deepEqual(cross.cards.map(c=>c.id).sort(),['active','first','spacing']);assert.equal(cross.links.length,2);assert.ok(!cross.cards.some(c=>c.id==='load'));
 assert.equal(networkScope(s.cards,s.links,scope,false,true).cards.length,2);assert.equal(networkScope(s.cards,s.links,scope,true,false,'feynman').cards.length,1);
 const points=graphPositions(s.cards);assert.equal(points.size,s.cards.length);assert.equal(new Set([...points.values()].map(p=>`${p.x},${p.y}`)).size,s.cards.length);
});
test('writes persist, reject stale/duplicate relations, and unlink preserves cards',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'knowledge-links-'));
 try{const store=new FileStore(dir),s={...sampleState(),schedulerVersion:3 as const};await store.write('test',s,0);
 const next=putLink(s,{id:'manual',from:'active',to:'first',reason:'跨主题'});await store.writeChanges('test',stateChanges(s,next),1);
 assert.deepEqual((await new FileStore(dir).read('test')).state.links,next.links);
 await assert.rejects(store.writeChanges('test',stateChanges(s,next),1),RevisionConflict);
 const duplicate={...next,links:[...next.links,{id:'other',from:'first',to:'active',reason:'重复'}]};
 await assert.rejects(store.writeChanges('test',stateChanges(next,duplicate),2),/已有关联/);await assert.rejects(store.writeSnapshot('test',duplicate,2),/已有关联/);
 const removed={...next,links:next.links.filter(l=>l.id!=='manual')};await store.writeChanges('test',stateChanges(next,removed),2);
 const saved=await store.read('test');assert.deepEqual(saved.state.cards,s.cards);assert.deepEqual(saved.state.links,s.links);
 }finally{await rm(dir,{recursive:true,force:true})}
});
