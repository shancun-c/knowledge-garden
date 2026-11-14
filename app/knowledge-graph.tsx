'use client';
import {useMemo,useRef,useState,type PointerEvent} from 'react';
import type {Card,KnowledgeState} from '../lib/model';
import {graphPositions,type KnowledgeLink} from '../lib/knowledge-links';
function fitView(points:{x:number;y:number}[]){if(!points.length)return {x:0,y:0,k:1};const minX=Math.min(...points.map(p=>p.x))-100,maxX=Math.max(...points.map(p=>p.x))+100,minY=Math.min(...points.map(p=>p.y))-50,maxY=Math.max(...points.map(p=>p.y))+50;const k=Math.min(1.5,820/(maxX-minX),480/(maxY-minY));return {x:450-(minX+maxX)/2*k,y:280-(minY+maxY)/2*k,k}}
const colors=['#3e7056','#527e9a','#a47b38','#8c6492','#a46051','#527e79'];
export default function KnowledgeGraph({cards,links,nodes,base,selected,onSelect,onLink}:{cards:Card[];links:KnowledgeLink[];nodes:KnowledgeState['nodes'];base:Set<string>;selected:string;onSelect:(id:string)=>void;onLink:(link:KnowledgeLink)=>void}){
 const layout=useMemo(()=>graphPositions(cards),[cards]);
 const [moved,setMoved]=useState<Record<string,{x:number;y:number}>>({});
 const positions=new Map([...layout].map(([id,p])=>[id,moved[id]||p]));
 const [view,setView]=useState(()=>fitView([...layout.values()]));
 const svg=useRef<SVGSVGElement>(null);
 const drag=useRef<{pointer:number;x:number;y:number;startX:number;startY:number;id?:string;px:number;py:number;shifted:boolean}|null>(null);
 const suppressClick=useRef(false);
 const signature=cards.map(c=>c.id).join('|');
 const [membership,setMembership]=useState(signature),[lastSelected,setLastSelected]=useState(selected);
 function fit(){setView(fitView([...positions.values()]))}
 if(membership!==signature){setMembership(signature);setView(fitView([...positions.values()]))}
 if(lastSelected!==selected){setLastSelected(selected);const p=positions.get(selected);if(p){const k=Math.max(view.k,.9);setView({k,x:450-p.x*k,y:280-p.y*k})}}
 function point(e:PointerEvent<SVGSVGElement>){const p=new DOMPoint(e.clientX,e.clientY);return p.matrixTransform(svg.current!.getScreenCTM()!.inverse())}
 function start(e:PointerEvent<SVGSVGElement>){if(e.button!==0||drag.current)return;const p=point(e),target=e.target as Element;if(target.closest('[data-edge]'))return;const id=target.closest('[data-node]')?.getAttribute('data-node')||undefined;const position=id?positions.get(id)!:{x:view.x,y:view.y};suppressClick.current=false;drag.current={pointer:e.pointerId,x:p.x,y:p.y,startX:p.x,startY:p.y,id,px:position.x,py:position.y,shifted:false};e.currentTarget.setPointerCapture(e.pointerId)}
 function move(e:PointerEvent<SVGSVGElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const p=point(e),dx=p.x-d.x,dy=p.y-d.y;if(Math.hypot(p.x-d.startX,p.y-d.startY)>4)d.shifted=true;if(!d.shifted)return;if(d.id)setMoved(old=>({...old,[d.id!]:{x:d.px+dx/view.k,y:d.py+dy/view.k}}));else setView(v=>({...v,x:d.px+dx,y:d.py+dy}))}
 function end(e:PointerEvent<SVGSVGElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;suppressClick.current=d.shifted;if(d.id&&!d.shifted&&e.type!=='pointercancel')onSelect(d.id);drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}
 function zoom(factor:number){setView(v=>{const k=Math.max(.04,Math.min(4,v.k*factor));return {k,x:450-(450-v.x)*k/v.k,y:280-(280-v.y)*k/v.k}})}
 const names=new Map(nodes.map(n=>[n.id,n.name])),byId=new Map(cards.map(c=>[c.id,c]));
 return <div className="graph-board"><div className="graph-controls"><button className="secondary" aria-label="放大图谱" onClick={()=>zoom(1.3)}>＋</button><button className="secondary" aria-label="缩小图谱" onClick={()=>zoom(1/1.3)}>−</button><button className="secondary" onClick={fit}>适应画布</button><span>{Math.round(view.k*100)}%</span></div>{!cards.length?<div className="empty"><h3>这里还没有连接</h3><p>建立关联，或开启「显示未关联卡片」。</p></div>:<svg ref={svg} viewBox="0 0 900 560" role="group" aria-label="可视化知识图谱" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={()=>{drag.current=null}}>
 <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
 {links.map(l=>{const a=positions.get(l.from),b=positions.get(l.to);if(!a||!b)return null;return <g key={l.id} data-edge={l.id} role="button" tabIndex={0} aria-label={`关联：${byId.get(l.from)?.front} 与 ${byId.get(l.to)?.front}`} onClick={()=>onLink(l)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onLink(l)}}}><title>{l.reason}</title><path d={`M ${a.x} ${a.y} Q ${(a.x+b.x)/2} ${(a.y+b.y)/2-70} ${b.x} ${b.y}`} fill="none" stroke="transparent" strokeWidth={18}/><path className="graph-edge" d={`M ${a.x} ${a.y} Q ${(a.x+b.x)/2} ${(a.y+b.y)/2-70} ${b.x} ${b.y}`} fill="none" stroke={selected===l.from||selected===l.to?'#3e7056':'#b8c8bb'} strokeWidth={selected===l.from||selected===l.to?3:1.5}/></g>})}
 {cards.map(c=>{const p=positions.get(c.id)!,color=colors[Math.max(0,nodes.findIndex(n=>n.id===c.node))%colors.length];return <g key={c.id} data-node={c.id} transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={0} aria-label={`卡片：${c.front}`} aria-pressed={selected===c.id} onClick={e=>{if(!suppressClick.current&&e.detail===0)onSelect(c.id)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(c.id)}}}><title>{c.front} · {names.get(c.node)}</title><rect x={-90} y={-32} width={180} height={64} rx={12} fill={selected===c.id?'#e9f2e5':'#fffefa'} stroke={color} strokeWidth={selected===c.id?3:1} strokeDasharray={base.has(c.id)?undefined:'5 3'}/><circle cx={-73} cy={-13} r={4} fill={color}/><text x={-62} y={-9} fontSize={10} fill={color}>{(names.get(c.node)||'知识卡片').slice(0,12)}{!base.has(c.id)?' · 外部':''}</text><text x={-74} y={15} fontSize={13} fill="#293a35">{c.front.length>12?c.front.slice(0,12)+'…':c.front}</text></g>})}
 </g></svg>}
 <p className="graph-instructions">拖动节点调整位置 · 拖动空白移动画布 · 点击连线查看理由</p><div className="graph-legend">{[...new Set(cards.map(c=>c.node))].map(id=><span key={id}><i style={{background:colors[Math.max(0,nodes.findIndex(n=>n.id===id))%colors.length]}}/>{names.get(id)||'知识卡片'}</span>)}</div></div>;
}
