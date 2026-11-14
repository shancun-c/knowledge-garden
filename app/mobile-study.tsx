import StudyScopePicker from './study-scope-picker';
import type {ReactNode} from 'react';
import {BookOpen, Check, RotateCcw} from 'lucide-react';
import type {Card, KnowledgeState} from '../lib/model';
import {intervalLabel} from '../lib/model';
import CardContent, { MathText } from './card-content';
import CardImages from './card-images';
import StudyCard from './study-card';
import type {PersonalProfile} from '../lib/fsrs-personalization';

type Props = {
  onNetwork:()=>void;
  undoAvailable:boolean;onUndo:()=>void;notesEditor:(card:Card)=>ReactNode; profile?:PersonalProfile; ready: boolean; busy: boolean; login: boolean; message: string;
  tools:ReactNode;waiting:ReactNode;saveLabel:string;current: Card | null | undefined; topic: string; remaining: number; done: number;
  revealed: boolean; hasCards: boolean;
  cards:KnowledgeState['cards']; nodes: KnowledgeState['nodes']; scope: string; onScopeChange: (id: string) => void;
  onReveal: () => void; onGrade: (grade: number) => void; onBegin: () => void;
};
export default function MobileStudy(p: Props) {
  const total = p.done + p.remaining;
  return <div className="mobile-study">
    <header className="mobile-study-header"><div><BookOpen size={21}/><strong>知序 <span>每日学习</span></strong></div><small role="status">{p.saveLabel}</small></header>
    <main className="mobile-study-main"><button className="secondary mobile-network-entry" onClick={p.onNetwork}>探索知识图谱 →</button>
      {p.message && <div className="mobile-study-error" role="alert">{p.message}</div>}
      {!p.ready ? <div className="mobile-study-empty"><BookOpen size={32}/><h1>{p.login?'请先登录':'正在准备你的卡片'}</h1><p>{p.login?'登录后继续学习你的知识卡片。':'正在连接知识库，请稍候。'}</p>{(p.login||p.message)&&<a href="/">重新连接</a>}</div> : <>
        <StudyScopePicker nodes={p.nodes} cards={p.cards} scope={p.scope} disabled={p.busy} onChange={p.onScopeChange}/>

        <details className="mobile-study-options"><summary>学习选项<span>限额 · 薄弱卡片 · 同步</span></summary>{p.tools}</details><section className="mobile-study-progress" aria-label="本轮学习进度"><div><h1>今日学习</h1><span>已评分 <b>{p.done}</b> 次 · 待学 {p.remaining} 张</span></div><progress max={total||1} value={p.done} aria-label="本轮学习进度"/></section>
        {p.undoAvailable&&<button className="secondary undo-review" disabled={p.busy} onClick={p.onUndo}>撤销上次评分（60 秒内）</button>}
        {p.current ? <>
          <StudyCard className="mobile-study-card" key={p.current.id} revealed={p.revealed} disabled={p.busy} onFlip={p.onReveal}>
            <div className="mobile-study-topic">{p.topic || '知识卡片'}</div>
            <div className="reader-section-label">先尝试回忆</div><h2><MathText text={p.current.front}/></h2><CardImages images={p.current.images} side="front"/>
            {p.revealed ? <section className="mobile-study-answer"><div className="reader-section-label">答案与要点</div><CardContent text={p.current.back}/><CardImages images={p.current.images} side="back"/></section> : <p className="mobile-recall-hint">在心里组织答案，再翻开核对。</p>}
          </StudyCard>
          {p.revealed&&p.notesEditor(p.current)}
          <div className="mobile-study-controls">
            {p.revealed ? <><p>FSRS · 这张卡片，你掌握得怎么样？</p><div className="mobile-study-grades">{['忘记了','有点困难','记住了','很轻松'].map((label,g)=><button key={g} disabled={p.busy} onClick={()=>p.onGrade(g)}><strong>{label}</strong><small>{intervalLabel(p.current!,g,Date.now(),p.profile)}</small></button>)}</div></> : null}
          </div>
        </> : p.waiting}
      </>}
    </main>
  </div>;
}
