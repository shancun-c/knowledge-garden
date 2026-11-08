'use client';
import {useEffect,useRef,useState} from 'react';
import type {PDFDocument} from 'pdf-lib';
import {z} from 'zod';
import {pdfBatches,pdfCardSchema,dedupePDFCards,PDF_MAX_BYTES,PDF_BATCH_BYTES,PDF_MAX_PAGES,type PDFCard} from '../lib/pdf-cards';
import type {KnowledgeState,Card} from '../lib/model';
import type {CardImage} from '../lib/card-images';
import {nodeLabel} from '../lib/knowledge-tree';
import CardContent,{MathText} from './card-content';
import CardImages from './card-images';
type Draft=PDFCard&{id:string;selected:boolean;images?:CardImage[]};
export const pdfDraftKey=(scope:string)=>`knowledge-pdf-drafts:${scope}`;
export default function PDFCardMaker({data,initialNode,scope,onDirty,onSave}:{data:KnowledgeState;initialNode:string;scope:string;onDirty:(value:boolean)=>void;onSave:(cards:Card[])=>Promise<boolean>}){
 const [file,setFile]=useState<File|null>(null),[pages,setPages]=useState(0),[start,setStart]=useState(1),[end,setEnd]=useState(1),[node,setNode]=useState(initialNode),[requirements,setRequirements]=useState(''),[drafts,setDrafts]=useState<Draft[]>([]),[filename,setFilename]=useState(''),[running,setRunning]=useState(false),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[completed,setCompleted]=useState(0),[summaries,setSummaries]=useState<string[]>([]),[imageBusy,setImageBusy]=useState(''),[restored,setRestored]=useState(false);
 const document=useRef<PDFDocument|null>(null),abort=useRef<AbortController|null>(null),pause=useRef(false),mounted=useRef(true),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{mounted.current=true;try{const raw=scope&&localStorage.getItem(pdfDraftKey(scope));if(raw){const saved=JSON.parse(raw);const cards=z.array(pdfCardSchema.extend({id:z.string(),selected:z.boolean()})).max(800).parse(saved.drafts);setDrafts(cards);setFilename(String(saved.filename||''));setRestored(true);setStatus('已恢复本机文字草稿；可编辑并保存。继续分析请重新选择 PDF。')}}catch{setError('本机草稿无法读取，请重新选择文件')}return()=>{mounted.current=false;abort.current?.abort()}},[scope]);
 useEffect(()=>{onDirty(!!file||drafts.length>0||running);},[file,drafts,running,onDirty]);
 useEffect(()=>{if(!scope||!drafts.length)return;try{localStorage.setItem(pdfDraftKey(scope),JSON.stringify({filename,drafts:drafts.map(({images,...d})=>d)}))}catch{setError('本机暂存空间不足，请保持页面打开，核对后保存')}},[drafts,filename,scope]);
 useEffect(()=>{if(!drafts.length&&!running)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[drafts.length,running]);
 async function choose(f?:File){if(!f)return;if(drafts.length&&!confirm('更换 PDF 会清空当前草稿，确定继续？'))return;setError('');setLoading(true);try{
  if(!/\.pdf$/i.test(f.name)||f.size>PDF_MAX_BYTES||!f.size)throw Error('请选择非空 PDF 文件，最大 30 MB');
  const {PDFDocument}=await import('pdf-lib');let doc;try{doc=await PDFDocument.load(await f.arrayBuffer(),{updateMetadata:false})}catch{throw Error('无法读取 PDF；请确认文件完整且未加密')}
  const count=doc.getPageCount();if(count<1||count>PDF_MAX_PAGES)throw Error(`PDF 需为 1–${PDF_MAX_PAGES} 页，请先拆分更长的文件`);
  if(!mounted.current)return;document.current=doc;setFile(f);setFilename(f.name);setPages(count);setStart(1);setEnd(count);setDrafts([]);setCompleted(0);setSummaries([]);setRestored(false);setStatus('文件已就绪，尚未发送给 AI');if(scope)localStorage.removeItem(pdfDraftKey(scope));
 }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'读取失败')}finally{if(mounted.current)setLoading(false)}}
 const validRange=Number.isInteger(start)&&Number.isInteger(end)&&start>=1&&end>=start&&end<=pages;
 const batches=validRange?pdfBatches(start,end):[];
 async function generate(){if(!document.current||!file||!validRange)return;setError('');setRunning(true);pause.current=false;let current=drafts;try{
  const {PDFDocument}=await import('pdf-lib');
  for(let i=completed;i<batches.length;i++){
   if(pause.current||!mounted.current)break;const batch=batches[i];setStatus(`正在分析第 ${batch.start}–${batch.end} 页 · ${i+1}/${batches.length} 批`);
   const pdf=await PDFDocument.create();const copied=await pdf.copyPages(document.current,Array.from({length:batch.end-batch.contextStart+1},(_,j)=>batch.contextStart+j-1));copied.forEach(p=>pdf.addPage(p));
   const bytes=await pdf.save();if(bytes.length>PDF_BATCH_BYTES)throw Error(`第 ${batch.start}–${batch.end} 页超过 5 MB，请压缩文件后重试`);
   const pdfData=await pdf.saveAsBase64({dataUri:true});if(pause.current||!mounted.current)break;abort.current=new AbortController();
   const r=await fetch('/api/pdf-cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...batch,filename:file.name,pdf:pdfData,requirements,previous:current.map(c=>c.front).slice(-300)}),signal:abort.current.signal});
   const b=await r.json() as {error?:string;cards:unknown;summary:string};if(!r.ok)throw Error(b.error||'本批分析失败');if(!mounted.current)return;
   const generated=z.array(pdfCardSchema).parse(b.cards);const unique=dedupePDFCards(generated,current);current=[...current,...unique.map(c=>({...c,id:crypto.randomUUID(),selected:!data.cards.some(old=>dedupePDFCards([c],[old]).length===0)}))];
   setDrafts(current);setCompleted(i+1);setSummaries(old=>[...old,`第 ${batch.start}–${batch.end} 页：${b.summary}（新增 ${unique.length} 张）`]);
   setStatus(i+1===batches.length?`分析完成：共 ${current.length} 张草稿，请核对后保存`:`已完成 ${i+1}/${batches.length} 批，${current.length} 张草稿`);
  }
 }catch(e){if(mounted.current)setError(e instanceof Error&&e.name==='AbortError'?'已停止，完成批次的草稿已保留；继续会重试未完成批次':e instanceof Error?e.message:'分析失败')}finally{if(mounted.current)setRunning(false);abort.current=null}}
 function change(id:string,patch:Partial<Draft>){setDrafts(old=>old.map(d=>d.id===id?{...d,...patch}:d))}
 async function illustrate(d:Draft){setImageBusy(d.id);setError('');try{const r=await fetch('/api/illustrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({front:d.front,back:d.back,prompt:d.imagePrompt})});const b=await r.json() as {error?:string;image:CardImage};if(!r.ok)throw Error(b.error||'配图失败');if(mounted.current)change(d.id,{images:[b.image]})}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'配图失败')}finally{if(mounted.current)setImageBusy('')}}
 const selected=drafts.filter(d=>d.selected),locked=running||loading||saving||!!imageBusy;
 async function save(){if(!node||!selected.length||locked)return;setSaving(true);setError('');try{const cards:Card[]=selected.map(d=>({id:d.id,node,front:d.front,back:d.back,tags:d.tags,images:d.images||[],notes:`来源：${filename} · 第 ${[...new Set(d.sourcePages)].sort((a,b)=>a-b).join('、')} 页（PDF 物理页码）`,due:Date.now(),interval:0,ease:2.5,reps:0,reviews:0}));if(await onSave(cards)){if(scope)localStorage.removeItem(pdfDraftKey(scope))}}catch(e){setError(e instanceof Error?e.message:'保存失败')}finally{if(mounted.current)setSaving(false)}}
 return <section className="pdf-maker">
  <p className="hint">上传教材或讲义，按完整知识点分批制卡。PDF 的文字与页面图表会发送至 OpenAI；使用设置中的模型，需支持 PDF 视觉输入。生成只产生草稿，确认保存后才加入知识库。</p>
  <div className="pdf-upload"><input ref={input} type="file" accept="application/pdf,.pdf" aria-label="上传 PDF 文件" disabled={locked} onChange={e=>{void choose(e.target.files?.[0]);e.target.value=''}}/><strong>{filename||'选择 PDF 教材或讲义'}</strong><span>{pages?`${pages} 页 · ${(file!.size/1024/1024).toFixed(1)} MB`:'单文件最大 30 MB · 最多 200 页'}</span></div>
  {file&&<div className="pdf-options"><label>起始页<input type="number" min={1} max={pages} value={start} disabled={locked||completed>0} onChange={e=>setStart(Number(e.target.value))}/></label><label>结束页<input type="number" min={start} max={pages} value={end} disabled={locked||completed>0} onChange={e=>setEnd(Number(e.target.value))}/></label><span>{validRange?`分 ${batches.length} 批分析，每批最多 4 页；跨页概念附带上一页上下文`:'请输入有效页码'}</span></div>}
  <label>补充要求<textarea maxLength={3000} value={requirements} disabled={locked||completed>0} onChange={e=>setRequirements(e.target.value)} placeholder="例如：重点整理定价逻辑、公式条件与案例，不要把同一概念拆得太碎"/></label>
  <div className="actions"><button className="primary" disabled={locked||!file||!validRange||completed===batches.length} onClick={generate}>{completed?'继续分析剩余页面':'分析 PDF 并生成草稿'}</button>{running&&<button className="secondary" onClick={()=>{pause.current=true;abort.current?.abort()}}>停止分析</button>}</div>
  {status&&<p className="ai-progress" role="status">{status}</p>}{error&&<p role="alert" className="pdf-error">{error}</p>}
  {!!summaries.length&&<details><summary>查看各批次覆盖内容（{completed}/{batches.length}）</summary><ul>{summaries.map((s,i)=><li key={i}>{s}</li>)}</ul></details>}
  {!!drafts.length&&<><div className="pdf-selection"><strong>卡片草稿 · 已选 {selected.length}/{drafts.length}</strong><button disabled={locked} className="secondary" onClick={()=>setDrafts(old=>old.map(d=>({...d,selected:true})))}>全选</button><button disabled={locked} className="secondary" onClick={()=>setDrafts(old=>old.map(d=>({...d,selected:false})))}>全不选</button></div><p className="hint">同题旧卡默认不选中；仍请检查近似重复。文字草稿暂存在本机，配图请在关闭前保存。{restored?'已恢复的草稿不会自动写入知识库。':''}</p>
   {drafts.map((d,i)=><details className="pdf-draft" key={d.id}><summary><input aria-label={`选择草稿 ${i+1}`} type="checkbox" checked={d.selected} disabled={locked} onClick={e=>e.stopPropagation()} onChange={e=>change(d.id,{selected:e.target.checked})}/><span><MathText text={d.front}/><small>来源第 {d.sourcePages.join('、')} 页</small></span></summary><label>问题<textarea maxLength={3000} value={d.front} disabled={locked} onChange={e=>change(d.id,{front:e.target.value})}/></label><label>答案<textarea maxLength={12000} value={d.back} disabled={locked} onChange={e=>change(d.id,{back:e.target.value})}/></label><div className="formula-preview"><CardContent text={d.back}/></div><CardImages images={d.images} side="back"/>{d.imagePrompt&&<><p className="hint">建议配图：{d.imagePrompt}</p><button className="secondary" disabled={locked} onClick={()=>illustrate(d)}>{imageBusy===d.id?'正在生成配图…':d.images?.length?'重新生成配图':'AI 生成辅助配图'}</button></>}</details>)}
   <div className="pdf-save"><label>保存到知识节点<select value={node} disabled={locked} onChange={e=>setNode(e.target.value)}><option value="">请选择知识节点</option>{data.nodes.map(n=><option key={n.id} value={n.id}>{nodeLabel(data.nodes,n.id)}</option>)}</select></label><button className="primary" disabled={locked||!node||!selected.length||selected.some(d=>!d.front.trim()||!d.back.trim())||data.cards.length+selected.length>3000} onClick={save}>{saving?'正在保存…':`确认保存 ${selected.length} 张卡片`}</button><small>仅新增选中的卡片，不覆盖已有卡片。</small></div>
  </>}
 </section>
}
