import {cardNotes} from '../lib/card-search';
import type {Card} from '../lib/model';
import CardContent from './card-content';
type Comment={id:string;text:string;createdAt:number};
type Draft=Comment&{savedText:string};
export default function CardNotes({card,draft,busy,error,onChange,onSave,onCancel,onEdit,onDelete,onRetry,localWarning}:{card:Card;draft?:Draft;busy:boolean;error:string;onChange:(text:string)=>void;onSave:()=>void;onCancel:()=>void;onEdit:(comment:Comment)=>void;onDelete:(id:string)=>void;onRetry:()=>void;localWarning?:string}){
 const comments=cardNotes(card);
 const editing=Boolean(draft&&comments.some(c=>c.id===draft.id));
 return <section className="card-notes" aria-label="学习备注"><div className="notes-heading"><h3>学习备注</h3><span className="hint">最新备注在前</span></div>
 <div className="note-comments">{comments.map((c,index)=><article className="note-comment" key={c.id}><div className="notes-heading"><small>{c.id==='legacy'?'原有备注':new Date(c.createdAt).toLocaleString('zh-CN')}</small><div className="notes-actions"><button type="button" disabled={busy} aria-label={`编辑第 ${index+1} 条备注`} onClick={()=>onEdit(c)}>编辑</button><button type="button" className="danger" disabled={busy} aria-label={`删除第 ${index+1} 条备注`} onClick={()=>onDelete(c.id)}>删除</button></div></div><CardContent text={c.text}/></article>)}</div>
 <label>{editing?'编辑备注':'新增备注'}<textarea aria-label="备注内容" maxLength={12000} rows={3} disabled={busy} value={draft?.text||''} onChange={e=>onChange(e.target.value)} placeholder="写下这次的思考，点击提交后保存…"/></label>
 <div className="notes-actions"><small role="status">{error||localWarning||(draft?'本机草稿已暂存 · 手动提交后保存':'手动提交后保存')}</small>{error&&<button type="button" className="secondary" disabled={busy} onClick={onRetry}>同步最新数据</button>}{draft&&<button type="button" className="secondary" disabled={busy} onClick={onCancel}>取消</button>}<button type="button" className="primary" disabled={busy||!draft?.text.trim()} onClick={onSave}>{busy?'保存中…':editing?'保存修改':'提交备注'}</button></div>
 </section>;
}
