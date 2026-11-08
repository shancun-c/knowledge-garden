'use client';
import {useState} from 'react';
import type {KnowledgeState} from '../lib/model';
import {studyCards} from '../lib/model';
import {nodeLabel} from '../lib/knowledge-tree';
import Modal from './modal';
export default function StudyScopePicker({nodes,cards,scope,disabled,onChange}:{nodes:KnowledgeState['nodes'];cards:KnowledgeState['cards'];scope:string;disabled:boolean;onChange:(id:string)=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');
 const options=[{id:'',label:'全部知识'},...nodes.map(n=>({id:n.id,label:nodeLabel(nodes,n.id)}))];
 return <div className="scope-picker"><span>学习范围</span><button className="secondary" disabled={disabled} onClick={()=>{setQuery('');setOpen(true)}}>{options.find(o=>o.id===scope)?.label||'全部知识'} <span>更换</span></button><small>包含子节点，仅学习到期卡片</small>{open&&<Modal label="选择学习范围" onClose={()=>setOpen(false)}><section className="dialog"><div className="dialog-head"><h2>选择学习范围</h2><button aria-label="关闭范围选择" onClick={()=>setOpen(false)}>关闭</button></div><label>搜索主题或节点<input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="输入名称或路径"/></label><div className="scope-options">{options.filter(o=>o.label.includes(query.trim())).map(o=><button key={o.id} aria-pressed={scope===o.id} onClick={()=>{onChange(o.id);setOpen(false)}}><span>{o.label}</span><small>{studyCards({nodes,cards,links:[]},o.id).filter(c=>c.due<=Date.now()).length} 张待学</small></button>)}</div></section></Modal>}</div>;
}
