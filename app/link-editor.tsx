'use client';
import {useState} from 'react';
import type {KnowledgeState} from '../lib/model';
import {findLink,type KnowledgeLink} from '../lib/knowledge-links';
import {nodeLabel} from '../lib/knowledge-tree';
import Modal from './modal';
export default function LinkEditor({state,initial,fixedFrom,busy,onSave,onClose}:{state:KnowledgeState;initial?:KnowledgeLink;fixedFrom?:string;busy:boolean;onSave:(link:KnowledgeLink)=>Promise<boolean>;onClose:()=>void}){
 const [from,setFrom]=useState(initial?.from||fixedFrom||''),[to,setTo]=useState(initial?.to||''),[reason,setReason]=useState(initial?.reason||''),[search,setSearch]=useState(''),[error,setError]=useState('');
 const [id]=useState(()=>initial?.id||crypto.randomUUID());
 const duplicate=findLink(state.links,from,to);
 const choices=state.cards.filter(c=>`${c.front} ${nodeLabel(state.nodes,c.node)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 const dirty=from!==(initial?.from||fixedFrom||'')||to!==(initial?.to||'')||reason!==(initial?.reason||'');
 const close=()=>{if(!busy&&(!dirty||confirm('放弃未保存的关联修改？')))onClose()};
 function picker(label:string,value:string,set:(id:string)=>void,disabled:boolean,exclude:string){
  const selected=state.cards.find(c=>c.id===value),options=choices.filter(c=>c.id!==exclude);
  if(selected&&!options.some(c=>c.id===value))options.unshift(selected);
  return <label>{label}<select aria-label={label} value={value} disabled={disabled||busy} onChange={e=>{set(e.target.value);setError('')}}><option value="">请选择卡片</option>{options.map(c=><option key={c.id} value={c.id}>{c.front.slice(0,100)} · {nodeLabel(state.nodes,c.node)}</option>)}</select>{selected&&<small>{selected.front}</small>}</label>;
 }
 return <Modal label={initial?'编辑关联':'建立关联'} onClose={close}><form className="dialog link-editor" onSubmit={async e=>{e.preventDefault();setError('');if(from===to){setError('不能关联同一张卡片');return}if(await onSave({id,from,to,reason}))onClose();else setError('关联未保存，请核对提示后重试；输入已保留。')}}><div className="dialog-head"><h2>{initial?'编辑关联':'建立关联'}</h2><button type="button" aria-label="关闭关联编辑" disabled={busy} onClick={close}>×</button></div><p className="hint">连接两个知识点，写下它们为什么相关。</p>{!initial&&<label>搜索卡片或目录<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="输入关键词，缩小下方选择范围"/></label>}{picker('第一张卡片',from,setFrom,!!initial||!!fixedFrom,to)}{picker('第二张卡片',to,setTo,!!initial,from)}<label>关联理由<textarea required maxLength={1000} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)} placeholder="例如：前者解释原因，后者展示实际应用。"/></label><small>{reason.length} / 1000</small>{duplicate&&duplicate.id!==id&&<p role="alert">这两张卡片已有关联：{duplicate.reason}。请在相关卡片或关联列表中编辑已有关系。</p>}{error&&<p role="alert">{error}</p>}<div className="actions"><button type="button" className="secondary" disabled={busy} onClick={close}>取消</button><button className="primary" disabled={busy||!from||!to||from===to||!reason.trim()||!!duplicate&&duplicate.id!==id}>{busy?'正在保存…':'保存关联'}</button></div></form></Modal>;
}
