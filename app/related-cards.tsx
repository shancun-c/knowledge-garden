'use client';
import type {Card,KnowledgeState} from '../lib/model';
import {relatedCards,type KnowledgeLink} from '../lib/knowledge-links';
import {nodeLabel} from '../lib/knowledge-tree';
export default function RelatedCards({state,card,busy,onOpen,onAdd,onEdit,onDelete}:{state:KnowledgeState;card:Card;busy:boolean;onOpen:(card:Card)=>void;onAdd:()=>void;onEdit:(link:KnowledgeLink)=>void;onDelete:(id:string)=>void}){
 const related=relatedCards(state,card.id);
 return <section className="related-cards" aria-label="相关卡片"><div className="section-head"><h3>相关卡片 <span>{related.length}</span></h3><button className="secondary" disabled={busy} onClick={onAdd}>添加关联</button></div>{!related.length&&<p className="hint">还没有关联，连接另一个知识点，让理解更完整。</p>}{related.map(({link,card:other})=><article key={link.id}><button className="related-title" disabled={busy} onClick={()=>onOpen(other)}>{other.front}<span aria-hidden="true">↗</span></button><small>{nodeLabel(state.nodes,other.node)}</small><p>{link.reason}</p><div className="actions"><button disabled={busy} onClick={()=>onEdit(link)}>编辑关联</button><button className="danger" disabled={busy} onClick={()=>onDelete(link.id)}>解除关联</button></div></article>)}</section>;
}
