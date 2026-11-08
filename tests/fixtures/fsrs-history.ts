import {schedule,type KnowledgeState} from '../../lib/model.ts';
export function historyFixture():KnowledgeState{
 const base=Date.UTC(2026,0,1),nodes=[{id:'topic',name:'合成训练验证（非真实学习数据）',parent:null}];
 const cards=Array.from({length:50},(_,i)=>{
  let c:KnowledgeState['cards'][number]={id:`card-${i}`,node:'topic',front:`测试卡片 ${i}`,back:'仅用于隔离测试',tags:[],due:0,interval:0,ease:2.5,reps:0,reviews:0};
  for(let j=0;j<13;j++)c=schedule(c,(i+j)%5===0?0:((i+j)%7===0?3:2),base+j*2*86400000+i*60000);
  return c;
 });
 return {schedulerVersion:3,nodes,cards,links:[]};
}
