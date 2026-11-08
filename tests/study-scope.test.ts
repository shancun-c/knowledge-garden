import {test} from 'node:test';
import assert from 'node:assert/strict';
import {studyCards, schedule, type KnowledgeState} from '../lib/model.ts';
const state:KnowledgeState={nodes:[{id:'root',name:'主题',parent:null},{id:'child',name:'章节',parent:'root'},{id:'leaf',name:'节点',parent:'child'},{id:'other',name:'其他',parent:null},{id:'empty',name:'空节点',parent:'root'}],cards:['root','child','leaf','other'].map((node,i)=>({id:node,node,front:node,back:'答案',tags:[],due:i===2?200:0,interval:0,ease:2.5,reps:0,reviews:0})),links:[]};
test('study scope includes self and descendants and excludes other topics',()=>{
 assert.deepEqual(studyCards(state,'').map(c=>c.id),['root','child','leaf','other']);
 assert.deepEqual(studyCards(state,'root').map(c=>c.id),['root','child','leaf']);
 assert.deepEqual(studyCards(state,'child').map(c=>c.id),['child','leaf']);
 assert.deepEqual(studyCards(state,'leaf').map(c=>c.id),['leaf']);
 assert.deepEqual(studyCards(state,'empty'),[]);
 assert.deepEqual(studyCards(state,'missing'),[]);
});
test('scoped due queue and recheck respect scheduling without modifying other cards',()=>{
 const due=(s:KnowledgeState,id:string)=>studyCards(s,id).filter(c=>c.due<=100).map(c=>c.id);
 assert.deepEqual(due(state,'child'),['child']);
 const next={...state,cards:state.cards.map(c=>c.id==='child'?schedule(c,2,100):c)};
 assert.deepEqual(due(next,'child'),[]);
 assert.deepEqual(due(next,'root'),['root']);
 assert.deepEqual(due(next,'other'),['other']);
 assert.equal(state.cards[1].reviews,0);
});
