'use client';
import {useState} from 'react';
import type {Card,KnowledgeState} from '../lib/model';
export default function KnowledgeNetwork({cards,links,suggestions,busy,onDiscover,onOpen,onAccept,onIgnore,onDelete}:{cards:Card[];links:KnowledgeState['links'];suggestions:KnowledgeState['links'];busy:boolean;onDiscover:()=>void;onOpen:(c:Card)=>void;onAccept:(id:string)=>void;onIgnore:(id:string)=>void;onDelete:(id:string)=>void}){
 const [query,setQuery]=useState(''),[focus,setFocus]=useState('');
 const ids=new Set(cards.map(c=>c.id)),byId=new Map(cards.map(c=>[c.id,c]));
 const scoped=links.filter(l=>ids.has(l.from)&&ids.has(l.to));
 const pending=suggestions.filter(l=>ids.has(l.from)&&ids.has(l.to));
 const visible=scoped.filter(l=>(!focus||l.from===focus||l.to===focus)&&`${byId.get(l.from)?.front} ${byId.get(l.to)?.front} ${l.reason}`.includes(query));
 return <section className="network"><div className="section-head"><div><h2>知识关联 <span>{scoped.length} 条</span></h2><p className="hint">当前范围 {cards.length} 张卡片；本次分析前 {Math.min(60,cards.length)} 张。逐条核对后采纳。</p></div><button className="secondary" disabled={busy||cards.length<2} onClick={onDiscover}>{busy?'正在分析…':'发现关联'}</button></div><div className="network-filters"><label>搜索关联<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="问题或关联理由"/></label><label>查看某张卡片的关联<select value={ids.has(focus)?focus:''} onChange={e=>setFocus(e.target.value)}><option value="">当前范围全部关联</option>{cards.map(c=><option value={c.id} key={c.id}>{c.front}</option>)}</select></label></div>
 {pending.length>0&&<section><h3>待核对 · {pending.length} 条</h3>{pending.map(l=><article className="relation" key={l.id}><div className="relation-pair"><button onClick={()=>onOpen(byId.get(l.from)!)}>{byId.get(l.from)?.front}</button><span aria-hidden="true">↔</span><button onClick={()=>onOpen(byId.get(l.to)!)}>{byId.get(l.to)?.front}</button></div><p>{l.reason}</p><div className="actions"><button className="primary" disabled={busy} onClick={()=>onAccept(l.id)}>采纳关联</button><button className="secondary" onClick={()=>onIgnore(l.id)}>忽略</button></div></article>)}</section>}
 {!scoped.length&&<div className="empty"><h3>这个范围还没有关联</h3><p>{cards.length<2?'至少需要两张卡片才能分析关联。':'点击「发现关联」，核对 AI 给出的联系和理由后加入。'}</p></div>}
 {scoped.length>0&&!visible.length&&<div className="empty"><p>没有匹配的关联</p><button className="secondary" onClick={()=>{setQuery('');setFocus('')}}>清除筛选</button></div>}
 {visible.map(l=><article className="relation" key={l.id}><div className="relation-pair"><button onClick={()=>onOpen(byId.get(l.from)!)}>{byId.get(l.from)?.front}</button><span aria-hidden="true">↔</span><button onClick={()=>onOpen(byId.get(l.to)!)}>{byId.get(l.to)?.front}</button></div><p>{l.reason}</p><button className="danger" disabled={busy} onClick={()=>{if(confirm('删除这条关联？卡片内容将保留。'))onDelete(l.id)}}>删除关联</button></article>)}
 </section>;
}
