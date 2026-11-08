'use client';
import {useEffect,useState} from 'react';
import type {Optimizer} from '../lib/fsrs-optimizer';
type Status=Awaited<ReturnType<Optimizer['status']>>;
export default function FSRSSettings({onReload,onBusy}:{onReload:()=>Promise<void>;onBusy:(busy:boolean)=>void}){
 const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
 async function refresh(){const r=await fetch('/api/settings/fsrs');const b=await r.json() as Status & {error?:string};if(!r.ok)throw Error(b.error||'无法读取训练状态');setStatus(b as Status)}
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[]);
 const running=status?.optimization.lastRun?.status==='running';
 useEffect(()=>{if(!running)return;const timer=setInterval(()=>{refresh().catch(e=>setError(e.message))},3000);return()=>clearInterval(timer)},[running]);
 async function act(action:'optimize'|'reset'){
  if(pending)return;setPending(true);setError('');onBusy(true);
  try{const r=await fetch('/api/settings/fsrs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});const b=await r.json() as Status & {error?:string};if(!r.ok)throw Error(b.error||'操作失败');setStatus(b)}
  catch(e){setError(e instanceof Error?e.message:'操作失败');await refresh().catch(()=>{})}
  finally{try{await onReload()}catch{setError('请刷新页面以加载最新参数和学习记录')}setPending(false);onBusy(false)}
 }
 const last=status?.optimization.lastRun;
 const format=(n?:number)=>n===undefined?'—':n.toFixed(4);
 return <section className="setting-block fsrs-settings" aria-label="FSRS 个人参数优化">
  <h3>FSRS 个人参数优化</h3><p className="hint">当前使用{status?.optimization.active?'个人参数':'默认参数'} · FSRS-6 · 目标保持率 90%</p>
  {!status?<p role="status">正在统计复习记录…</p>:<>
   <dl className="fsrs-stat-grid"><div><dt>真实复习日志</dt><dd>{status.stats.totalLogs} 条</dd></div><div><dt>有效跨日样本</dt><dd>{status.stats.eligibleSamples} 条</dd></div><div><dt>参与卡片</dt><dd>{status.stats.cards} 张</dd></div><div><dt>本次训练 / 验证</dt><dd>{status.stats.trainCount} / {status.stats.validationCount}</dd></div></dl>
   <details className="technical-details"><summary>样本口径与训练规则</summary>   <p className="hint">至少 {status.stats.minSamples} 条跨日样本、{status.stats.minCards} 张卡片；按时间保留约 20% 的较新记录验证。首学和同日复习不计为跨日样本，历史仍参与记忆计算。最多使用最近 5000 个样本。</p>
   <p className="hint">同日复习 {status.stats.sameDay} 条 · 不完整、异常或超长序列排除 {status.stats.excludedLogs} 条。只使用升级后真实日志，不把旧 SM-2 累计次数当作训练记录。</p>
</details>
   <div className={status.canTrain?'settings-success':'fsrs-requirements'} role="status">
    {running?'正在训练与验证，原参数继续生效':status.unchanged?'记录没有变化，无需重复优化':status.stats.canTrain?'已满足本站训练条件':<>继续真实复习，数据足够后即可训练<details><summary>查看未满足条件</summary><ul>{status.stats.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></details></>}
   </div>
   <div className="fsrs-settings-actions"><button className="primary" disabled={pending||running||!status.canTrain} onClick={()=>act('optimize')}>{pending?'正在处理…':'开始优化'}</button><button className="secondary" disabled={pending||running||!status.optimization.active} onClick={()=>act('reset')}>恢复默认参数</button></div>
   <p className="hint">训练只在你的服务器运行。候选参数需在验证集上优于当前和默认参数才会启用；失败或无改善时保留原参数。生效后不批量改动到期时间，下次评分时按新参数重建记忆状态。</p>
   <div className="fsrs-last-result"><h4>最近一次优化</h4>{last?<>
    <p>{new Date(last.startedAt).toLocaleString('zh-CN')} · {({running:'进行中',applied:'已启用',not_improved:'未采用',failed:'失败'} as const)[last.status]}</p>
    <p>{last.message}</p><p className="hint">使用 {last.samples} 个样本、{last.cards} 张卡片；训练 {last.trainCount}，验证 {last.validationCount}。{last.finishedAt?`耗时 ${Math.max(1,Math.round((last.finishedAt-last.startedAt)/1000))} 秒。`:''}</p>
    {last.candidateMetrics&&<><table><caption>验证集误差（越低越好）</caption><thead><tr><th>参数</th><th>Log loss</th><th>RMSE</th></tr></thead><tbody>{[['默认',last.defaultMetrics],['优化前',last.currentMetrics],['候选',last.candidateMetrics]].map(([name,m])=><tr key={String(name)}><td>{String(name)}</td><td>{format(typeof m==='object'?m?.logLoss:undefined)}</td><td>{format(typeof m==='object'?m?.rmseBins:undefined)}</td></tr>)}</tbody></table><p className="hint">这是历史留出数据上的评估，不代表未来效果保证。</p></>}
   </>:<p className="hint">尚未执行优化。满足条件后，可以手动开始训练。</p>}
   {status.optimization.resetAt&&<p className="hint">上次恢复默认：{new Date(status.optimization.resetAt).toLocaleString('zh-CN')}</p>}</div>
  </>}
  {error&&<p role="alert" className="settings-error">{error}</p>}
 </section>;
}
