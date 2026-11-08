import type {Card,KnowledgeState} from './model';
export type ReviewUndo={before:Card;after:Card;revision:number;queue:string[];done:number;expires:number};
/** Revision CAS in the state API also rejects concurrent writes after this local check. */
export function restoreReview(state:KnowledgeState,revision:number,undo:ReviewUndo,now:number):KnowledgeState{
 if(now>undo.expires)throw Error('撤销时间已过，请继续如实评分');
 if(revision!==undo.revision||JSON.stringify(state.cards.find(c=>c.id===undo.after.id))!==JSON.stringify(undo.after))throw Error('数据已更新，不能撤销这次评分');
 return {...state,cards:state.cards.map(c=>c.id===undo.before.id?undo.before:c)};
}
