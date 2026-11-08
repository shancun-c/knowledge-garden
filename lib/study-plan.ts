import type {Card,KnowledgeState} from './model';
export const DEFAULT_DAILY_NEW_LIMIT=10;
export function studyDayKey(now:number){return new Date(now+8*3600000).toISOString().slice(0,10)}
export function introducedToday(state:KnowledgeState,now:number){
 const day=studyDayKey(now),ids=new Set(state.studyDay?.day===day?state.studyDay.introducedIds:[]);
 for(const c of state.cards){const first=c.reviewLog?.[0];if(first&&first.state===0&&!(c.fsrs?.legacy?.reviews)&&studyDayKey(first.review)===day)ids.add(c.id)}
 return ids;
}
export function dailyBudget(state:KnowledgeState,now:number){const limit=state.studySettings?.dailyNewLimit??DEFAULT_DAILY_NEW_LIMIT,used=introducedToday(state,now).size;return {limit,used,remaining:Math.max(0,limit-used)}}
export class NewCardLimitExceeded extends Error{}
/** Run inside the serialized store mutation; incoming day counters are never trusted. */
export function applyStudyPolicy(previous:KnowledgeState,next:KnowledgeState,now:number):KnowledgeState{
 const studySettings=next.studySettings??previous.studySettings??{dailyNewLimit:DEFAULT_DAILY_NEW_LIMIT};
 const ids=introducedToday(previous,now),old=new Map(previous.cards.map(c=>[c.id,c]));
 // An undo of the first rating restores its slot. Deleting a card does not.
 for(const c of next.cards){const before=old.get(c.id);if(before&&before.reviews>0&&c.reviews===0&&!c.reviewLog?.length)ids.delete(c.id)}
 const started=next.cards.filter(c=>old.get(c.id)?.reviews===0&&c.reviews>0&&!ids.has(c.id));
 if(started.length>Math.max(0,studySettings.dailyNewLimit-ids.size))throw new NewCardLimitExceeded('今日新卡额度已用完；到期复习仍可继续。请同步最新数据后重试。');
 started.forEach(c=>ids.add(c.id));
 return {...next,studySettings,studyDay:{day:studyDayKey(now),introducedIds:[...ids]}};
}
export function weakCards(cards:Card[]){return cards.flatMap(card=>{
 const logs=(card.reviewLog||[]).slice(-10);
 if(logs.length<2||logs.slice(-3).length===3&&logs.slice(-3).every(l=>l.rating>=3))return [];
 const forgotten=logs.filter(l=>l.rating===1).length,hard=logs.slice(-5).filter(l=>l.rating===2).length;
 if(forgotten<2&&hard<3)return [];
 return [{card,score:forgotten*3+hard,reason:forgotten>=2?`最近 ${logs.length} 次评分中 ${forgotten} 次忘记`:`最近 ${Math.min(5,logs.length)} 次评分中 ${hard} 次困难`}];
}).sort((a,b)=>b.score-a.score||a.card.due-b.card.due||a.card.id.localeCompare(b.card.id))}
export function studyQueue(state:KnowledgeState,cards:Card[],now:number,onlyIds?:string[]){
 const allowed=onlyIds?new Set(onlyIds):null,scope=cards.filter(c=>!allowed||allowed.has(c.id));
 const due=scope.filter(c=>c.due<=now),reviews=due.filter(c=>c.reviews>0).sort((a,b)=>{
 const learning=(c:Card)=>c.fsrs?.memory.state===1||c.fsrs?.memory.state===3?0:1;
 return learning(a)-learning(b)||a.due-b.due||a.id.localeCompare(b.id);
 });
 const fresh=due.filter(c=>c.reviews===0).sort((a,b)=>a.due-b.due||a.id.localeCompare(b.id)).slice(0,dailyBudget(state,now).remaining);
 const waiting=scope.filter(c=>c.reviews>0&&c.due>now&&(c.fsrs?.memory.state===1||c.fsrs?.memory.state===3)).sort((a,b)=>a.due-b.due);
 return {ids:[...reviews,...fresh].map(c=>c.id),reviewCount:reviews.length,newCount:fresh.length,nextDue:waiting[0]?.due,waitingCount:waiting.length};
}
/** Keep the card being read at the front; newly due cards never interrupt recall. */
export function reconcileQueue(previous:string[],eligible:string[]){return previous[0]&&eligible.includes(previous[0])?[previous[0],...eligible.filter(id=>id!==previous[0])]:eligible}
export function waitLabel(due:number,now:number){const seconds=Math.max(1,Math.ceil((due-now)/1000));return seconds<60?`${seconds} 秒`:`${Math.ceil(seconds/60)} 分钟`}
