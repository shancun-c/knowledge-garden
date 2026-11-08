'use client';
import {useState} from 'react';
import {cardNotes,noteExcerpt} from '../lib/card-search';
import {studyCards,type Card,type KnowledgeState} from '../lib/model';
import {nodeLabel} from '../lib/knowledge-tree';
export default function LearningNotebook({data,onOpen}:{data:KnowledgeState;onOpen:(card:Card,cards:Card[])=>void}){
 const [query,setQuery]=useState(''),[scope,setScope]=useState(''),[oldest,setOldest]=useState(false);
 const cards=studyCards(data,scope),q=query.trim().toLocaleLowerCase();
 const notes=cards.flatMap(card=>cardNotes(card).map(note=>({card,note}))).filter(({card,note})=>!q||`${card.front} ${card.tags.join(' ')} ${note.text}`.toLocaleLowerCase().includes(q)).sort((a,b)=>(oldest?1:-1)*(a.note.createdAt-b.note.createdAt));
 return <section className="learning-notebook"><div className="section-head"><div><h2>我的学习笔记</h2><p className="hint">回看自己的思考，点击笔记返回原卡片。</p></div><span>{notes.length} 条备注</span></div><div className="notebook-filters"><label>搜索笔记<input aria-label="搜索学习笔记" placeholder="备注、问题或标签…" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>知识范围<select value={scope} onChange={e=>setScope(e.target.value)}><option value="">全部知识</option>{data.nodes.map(n=><option key={n.id} value={n.id}>{nodeLabel(data.nodes,n.id)}</option>)}</select></label><label>排列<select value={oldest?'old':'new'} onChange={e=>setOldest(e.target.value==='old')}><option value="new">最近记录优先</option><option value="old">最早记录优先</option></select></label></div><div className="notebook-list">{notes.map(({card,note})=><button key={`${card.id}:${note.id}`} onClick={()=>onOpen(card,cards)}><strong>{card.front}</strong><small>{nodeLabel(data.nodes,card.node)} · {note.createdAt?new Date(note.createdAt).toLocaleString('zh-CN'):'原有备注'}</small><p>{q?noteExcerpt(note.text,q):note.text}</p><span>查看原卡片 →</span></button>)}</div>{!notes.length&&<div className="empty"><p>{q?'没有找到匹配的笔记':'这个范围还没有学习备注'}</p></div>}</section>;
}
