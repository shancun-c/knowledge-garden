import {createHash} from 'node:crypto';
import type {KnowledgeState} from './model.ts';
export type TrainingItem={cardId:string;at:number;reviews:{rating:number;deltaT:number}[]};
export const MIN_SAMPLES=500,MIN_CARDS=20,MAX_SAMPLES=5000,MAX_SEQUENCE=200;
const day=(t:number)=>Math.floor(t/86400000); // Same UTC calendar-day delta as ts-fsrs 5.4.2.
export function trainingData(state:KnowledgeState,now=Date.now()){
  let totalLogs=0,excludedLogs=0,sameDay=0;const items:TrainingItem[]=[];
  for(const card of state.cards){
    const logs=card.reviewLog||[];totalLogs+=logs.length;
    if(!logs.length)continue;
    // A partial or inconsistent history cannot be made complete by guessing ratings.
    if(logs[0].state!==0 || logs.some((l,i)=>!Number.isFinite(l.review)||l.review>now||l.review<0||![1,2,3,4].includes(l.rating)||(i>0&&l.review<=logs[i-1].review))){excludedLogs+=logs.length;continue;}
    const sequence:TrainingItem['reviews']=[];
    for(let i=0;i<logs.length;i++){
      const deltaT=i?day(logs[i].review)-day(logs[i-1].review):0;
      sequence.push({rating:logs[i].rating,deltaT});
      if(i && !deltaT)sameDay++;
      if(i && deltaT>0){
        if(sequence.length>MAX_SEQUENCE){excludedLogs++;continue;}
        items.push({cardId:card.id,at:logs[i].review,reviews:sequence.map(r=>({...r}))});
      }
    }
  }
  items.sort((a,b)=>a.at-b.at||a.cardId.localeCompare(b.cardId));
  const selected=items.slice(-MAX_SAMPLES);
  const cutoff=selected[Math.floor(selected.length*0.8)]?.at ?? Infinity;
  const train=selected.filter(i=>i.at<cutoff),validation=selected.filter(i=>i.at>=cutoff);
  const cards=new Set(selected.map(i=>i.cardId)).size;
  const outcomes=(s:TrainingItem[])=>({forgotten:s.filter(i=>i.reviews.at(-1)!.rating===1).length,remembered:s.filter(i=>i.reviews.at(-1)!.rating>1).length});
  const tr=outcomes(train),va=outcomes(validation);const reasons:string[]=[];
  if(selected.length<MIN_SAMPLES)reasons.push(`有效跨日样本还差 ${MIN_SAMPLES-selected.length} 条（至少 ${MIN_SAMPLES} 条）`);
  if(cards<MIN_CARDS)reasons.push(`有跨日样本的卡片还差 ${MIN_CARDS-cards} 张（至少 ${MIN_CARDS} 张）`);
  if(train.length<400||validation.length<100)reasons.push('按时间划分后，训练集需至少 400 条、验证集需至少 100 条');
  if(tr.forgotten<5||tr.remembered<5||va.forgotten<5||va.remembered<5)reasons.push('训练集和验证集各需至少 5 条遗忘及 5 条记住记录，请保持真实评分');
  if(!train.some(i=>i.reviews.filter(r=>r.deltaT>0).length>=2))reasons.push('需要同一卡片有多次跨日复习，以训练长期记忆参数');
  const fingerprint=createHash('sha256').update(JSON.stringify(selected)).digest('hex');
  return {train,validation,fingerprint,stats:{totalLogs,eligibleSamples:items.length,usedSamples:selected.length,cards,sameDay,excludedLogs,
    trainCount:train.length,validationCount:validation.length,forgotten:tr.forgotten+va.forgotten,remembered:tr.remembered+va.remembered,
    canTrain:reasons.length===0,reasons,minSamples:MIN_SAMPLES,minCards:MIN_CARDS}};
}
