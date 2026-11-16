'use client';
import {useState} from 'react';
import type {Card,KnowledgeState} from '../lib/model';
import {starredCards} from '../lib/starred-cards';
import {nodeLabel} from '../lib/knowledge-tree';
import {matchingNote,noteExcerpt} from '../lib/card-search';
import StarButton from './star-button';

export default function StarredCards({data,busy,onOpen,onToggle}:{data:KnowledgeState;busy:boolean;onOpen:(card:Card,cards:Card[])=>void;onToggle:(card:Card)=>void}) {
  const [query,setQuery]=useState(''),[node,setNode]=useState('');
  const all=starredCards(data),cards=starredCards(data,query,node);
  return <section className="starred-library" aria-label="星标卡片列表">
    <div className="section-head"><h2>星标卡片 <span>{cards.length}</span></h2><p className="hint">共 {all.length} 张重点知识</p></div>
    <div className="starred-filters">
      <label>搜索星标卡片<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索问题、答案、标签或备注…"/></label>
      <label>知识目录<select value={node} onChange={e=>setNode(e.target.value)}><option value="">全部目录</option>{data.nodes.map(n=><option key={n.id} value={n.id}>{nodeLabel(data.nodes,n.id)}</option>)}</select></label>
    </div>
    <div className="card-grid starred-grid">{cards.map(card=><article className="starred-card" key={card.id}>
      <div className="starred-card-top"><span className="topic">{card.tags[0]||'重点知识'}</span><StarButton starred disabled={busy} onToggle={()=>onToggle(card)}/></div>
      <button className="starred-card-read" onClick={()=>onOpen(card,cards)}><h3>{card.front}</h3><p>{card.back}</p>{matchingNote(card,query)&&<p className="note-search-match">备注匹配：{noteExcerpt(matchingNote(card,query)!,query)}</p>}<span>{nodeLabel(data.nodes,card.node)} · 查看详情 →</span></button>
    </article>)}</div>
    {!cards.length&&<div className="empty"><h3>{all.length?'没有匹配的星标卡片':'还没有星标卡片'}</h3><p>{all.length?'试试其他关键词或目录。':'在卡片上点击「星标」，重点知识就会集中显示在这里。'}</p>{(query||node)&&<button className="secondary" onClick={()=>{setQuery('');setNode('')}}>清除搜索与目录筛选</button>}</div>}
  </section>;
}
