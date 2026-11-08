'use client';
import {useState} from 'react';
import type {CardImage} from '../lib/card-images';
import {imageUrl} from '../lib/card-images';
import Modal from './modal';
export default function CardImages({images,side}:{images?:CardImage[];side:'front'|'back'}){
 const [selected,setSelected]=useState<CardImage|null>(null),[zoom,setZoom]=useState(1);
 return <div className="card-images">{images?.filter(i=>i.side===side).map(i=><figure key={i.id}><button type="button" className="image-open" onClick={e=>{e.stopPropagation();setZoom(1);setSelected(i)}} onKeyDown={e=>e.stopPropagation()} aria-label="放大查看配图"><img src={imageUrl(i)} alt={i.caption||'知识卡片配图'} loading="lazy"/><span>点击放大查看</span></button>{i.caption&&<figcaption>{i.caption}</figcaption>}</figure>)}{selected&&<Modal label="配图查看器" onClose={()=>setSelected(null)}><section className="dialog image-viewer"><div className="dialog-head"><h2>配图</h2><div className="actions"><button onClick={()=>setZoom(z=>Math.max(1,z-.5))} disabled={zoom<=1}>缩小</button><button onClick={()=>setZoom(z=>Math.min(3,z+.5))} disabled={zoom>=3}>放大</button><button onClick={()=>setZoom(1)}>适应宽度</button><button aria-label="关闭配图" onClick={()=>setSelected(null)}>关闭</button></div></div><div className="image-pan"><img style={{width:`${zoom*100}%`,maxWidth:'none'}} src={imageUrl(selected)} alt={selected.caption||'知识卡片配图'}/></div><p>{selected.caption}</p></section></Modal>}</div>;
}
