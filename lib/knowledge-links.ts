import type {Card, KnowledgeState} from './model.ts';
export type KnowledgeLink = KnowledgeState['links'][number];
export const pairKey = (from:string,to:string) => JSON.stringify([from,to].sort());
export function findLink(links:KnowledgeLink[],from:string,to:string){return links.find(l=>pairKey(l.from,l.to)===pairKey(from,to));}
export function putLink(state:KnowledgeState,link:KnowledgeLink):KnowledgeState {
 const ids=new Set(state.cards.map(c=>c.id));
 if(!ids.has(link.from)||!ids.has(link.to))throw Error('卡片已不存在，请重新选择');
 if(link.from===link.to)throw Error('不能关联同一张卡片');
 const reason=link.reason.trim();
 if(!reason||reason.length>1000)throw Error('请填写 1–1000 字的关联理由');
 if(state.links.some(l=>l.id!==link.id&&pairKey(l.from,l.to)===pairKey(link.from,link.to)))throw Error('这两张卡片已有关联，请编辑已有关系');
 const existing=state.links.find(l=>l.id===link.id);
 if(existing&&pairKey(existing.from,existing.to)!==pairKey(link.from,link.to))throw Error('已有关系不能更换卡片，请新建关联');
 return {...state,links:existing?state.links.map(l=>l.id===link.id?{...link,reason}:l):[...state.links,{...link,reason}]};
}
export function newSuggestions(cards:Card[],existing:KnowledgeLink[],input:unknown):KnowledgeLink[]{
 if(!Array.isArray(input))return [];
 const ids=new Set(cards.map(c=>c.id)),seen=new Set(existing.map(l=>pairKey(l.from,l.to)));
 const result:KnowledgeLink[]=[];
 for(const value of input){
  if(!value||typeof value!=='object')continue;
  const {from,to,reason}=value;
  if(typeof from!=='string'||typeof to!=='string'||typeof reason!=='string'||!reason.trim()||reason.trim().length>1000||from===to||!ids.has(from)||!ids.has(to))continue;
  const key=pairKey(from,to);if(seen.has(key))continue;seen.add(key);
  result.push({id:crypto.randomUUID(),from,to,reason:reason.trim()});if(result.length===12)break;
 }
 return result;
}
export function relatedCards(state:KnowledgeState,id:string){
 const byId=new Map(state.cards.map(c=>[c.id,c]));
 return state.links.flatMap(link=>{const other=link.from===id?link.to:link.to===id?link.from:null;const card=other?byId.get(other):undefined;return card?[{link,card}]:[]});
}
/** One-hop expansion never recursively pulls the whole graph into a topic. */
export function networkScope(all:Card[],links:KnowledgeLink[],scope:Card[],cross:boolean,isolated:boolean,focus=''){
 const base=new Set(scope.map(c=>c.id)),valid=new Set(all.map(c=>c.id));
 let visibleLinks=links.filter(l=>valid.has(l.from)&&valid.has(l.to)&&(cross?(base.has(l.from)||base.has(l.to)):(base.has(l.from)&&base.has(l.to))));
 if(focus)visibleLinks=visibleLinks.filter(l=>l.from===focus||l.to===focus);
 const connected=new Set(visibleLinks.flatMap(l=>[l.from,l.to]));
 return {links:visibleLinks,cards:all.filter(c=>connected.has(c.id)||(!focus&&isolated&&base.has(c.id))||(c.id===focus&&base.has(c.id))),base};
}
/** Stable topic columns, with no quadratic force simulation on large libraries. */
export function graphPositions(cards:Card[]){
 const groups=new Map<string,Card[]>();for(const c of cards){const g=groups.get(c.node)||[];g.push(c);groups.set(c.node,g)}
 const result=new Map<string,{x:number;y:number}>();let column=0;
 for(const group of groups.values()){
  const columns=Math.max(1,Math.ceil(Math.sqrt(group.length/2)));
  group.forEach((c,i)=>result.set(c.id,{x:100+(column+i%columns)*220,y:90+Math.floor(i/columns)*105}));column+=columns;
 }
 return result;
}
