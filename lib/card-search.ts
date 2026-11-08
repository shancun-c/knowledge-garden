import type {Card} from './model';
export function cardNotes(card:Card){return [...(card.notes?[{id:'legacy',text:card.notes,createdAt:0}]:[]),...(card.comments||[])];}
export function matchingNote(card:Card,query:string){const q=query.trim().toLocaleLowerCase();return q?cardNotes(card).find(note=>note.text.toLocaleLowerCase().includes(q))?.text:undefined;}
export function cardMatches(card:Card,query:string){const q=query.trim().toLocaleLowerCase();return !q||`${card.front} ${card.back} ${card.tags.join(' ')}`.toLocaleLowerCase().includes(q)||Boolean(matchingNote(card,q));}
export function noteExcerpt(text:string,query:string){const index=text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());const start=Math.max(0,index-24);return `${start?'…':''}${text.slice(start,start+150)}${text.length>start+150?'…':''}`;}
