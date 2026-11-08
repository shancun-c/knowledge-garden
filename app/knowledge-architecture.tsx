'use client';
import { useEffect, useState } from 'react';
import SortableCards from './sortable-cards';
import {cardMatches,matchingNote,noteExcerpt} from '../lib/card-search';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, CornerDownRight, FolderTree, Layers, Pencil, Plus, Search, Sparkles } from 'lucide-react';
import { descendants, type Card, type KnowledgeState } from '../lib/model';
import { nodePath, reorderSibling } from '../lib/knowledge-tree';

type Props = {
  data: KnowledgeState;
  selected: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  onAddNode: (parent: string | null) => void;
  onEditNode: (id: string) => void;
  onNewCard: (id: string) => void;
  onAICard: (id: string) => void;
  onPDFCard: (id: string) => void;
  onOpenCard: (card: Card, cards: Card[]) => void;
  onSave: (state: KnowledgeState) => Promise<boolean>;
};

export default function KnowledgeArchitecture({ data, selected, disabled, onSelect, onAddNode, onEditNode, onNewCard, onAICard, onPDFCard, onOpenCard, onSave }: Props) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [includeChildren, setIncludeChildren] = useState(false);
  const [cardQuery, setCardQuery] = useState('');
  useEffect(() => { setCardQuery(''); }, [selected]);
  const path = nodePath(data.nodes, selected);
  const root = path[0];
  const active = path[path.length - 1];
  const topics = data.nodes.filter(node => node.parent === null);

  useEffect(() => {
    const ancestors = new Set(nodePath(data.nodes, selected).slice(0, -1).map(node => node.id));
    setCollapsed(previous => previous.filter(id => !ancestors.has(id)));
  }, [selected, data.nodes]);

  if (!root || !active) return <section className="architecture-welcome">
    <FolderTree size={32} />
    <h2>先搭建框架，再让知识生长</h2>
    <p>选择一本书或一个知识主题，逐层建立章节与知识点。</p>
    <div className="topic-choices">{topics.map(topic => <button className="topic-choice" key={topic.id} onClick={() => onSelect(topic.id)}><FolderTree size={20} /><span>{topic.name}</span><ChevronRight size={16} /></button>)}</div>
    <button className="primary" disabled={disabled} onClick={() => onAddNode(null)}><Plus size={16} />新建知识主题</button>
  </section>;

  const branch = descendants(data.nodes, root.id);
  const activeBranch = descendants(data.nodes, active.id);
  const directCards = data.cards.filter(card => card.node === active.id);
  const subtreeCards = data.cards.filter(card => activeBranch.has(card.node));
  const scopeCards = includeChildren ? subtreeCards : directCards;
  const visibleCards = scopeCards.filter(card => cardMatches(card,cardQuery));
  const siblings = data.nodes.filter(node => node.parent === active.parent);
  const siblingIndex = siblings.findIndex(node => node.id === active.id);
  const topicCards = data.cards.filter(card => branch.has(card.node));

  function renderBranch(id: string, numbering: string): React.ReactNode {
    const node = data.nodes.find(item => item.id === id)!;
    const children = data.nodes.filter(item => item.parent === id);
    const hidden = collapsed.includes(id);
    const cardCount = data.cards.filter(card => card.node === id).length;
    return <li key={id} className={id === root.id ? 'architecture-root' : ''}>
      <div className={'architecture-node ' + (selected === id ? 'is-selected' : '')}>
        <button className="branch-toggle" aria-label={`${hidden ? '展开' : '收起'}${node.name}`} aria-expanded={!hidden} disabled={!children.length} onClick={() => setCollapsed(hidden ? collapsed.filter(item => item !== id) : [...collapsed, id])}>
          {children.length ? hidden ? <ChevronRight size={15} /> : <ChevronDown size={15} /> : <span className="branch-leaf" />}
        </button>
        <button className="architecture-node-select" aria-label={`选择节点：${node.name}`} aria-pressed={selected === id} onClick={() => onSelect(id)}>
          <span className="chapter-number">{numbering || <FolderTree size={17} />}</span>
          <span className="architecture-node-name">{node.name}</span>
          <span className="node-card-count" title={`本节点 ${cardCount} 张 · 含子节点 ${data.cards.filter(c=>descendants(data.nodes,id).has(c.node)).length} 张`} aria-label={`含子节点 ${data.cards.filter(c=>descendants(data.nodes,id).has(c.node)).length} 张卡片`}>{data.cards.filter(c=>descendants(data.nodes,id).has(c.node)).length}</span>
        </button>
        <button className="branch-add" aria-label={`为${node.name}新增子节点`} title="新增子节点" disabled={disabled} onClick={() => onAddNode(id)}><Plus size={16} /></button>
      </div>
      {children.length > 0 && !hidden && <ul>{children.map((child, index) => renderBranch(child.id, numbering ? `${numbering}.${index + 1}` : `${index + 1}`))}</ul>}
    </li>;
  }

  return <section className="architecture-workspace">
    <div className="architecture-titlebar">
      <div><span className="mini-label">知识架构</span><h2>{root.name}</h2><p>{branch.size - 1} 个知识节点 <span>·</span> {topicCards.length} 张卡片</p></div>
      <label className="topic-switch">切换主题<select value={root.id} onChange={event => onSelect(event.target.value)}>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
    </div>
    <div className="architecture-layout">
      <div className="structure-panel">
        <div className="structure-toolbar"><div><FolderTree size={17} /><b>知识树</b><span>含子节点卡片数</span></div><button disabled={disabled} onClick={() => onAddNode(root.id)}><Plus size={15} />新增一级节点</button></div>
        <div className="structure-canvas" aria-label={`${root.name}的知识树`}>
          <ul className="architecture-tree">{renderBranch(root.id, '')}</ul>
          {branch.size === 1 && <div className="structure-empty"><CornerDownRight size={24} /><h3>从第一个章节开始</h3><p>把书本目录或自己的学习思路搭在这里。<br />不需要先创建卡片，也可以继续细分每个知识点。</p><button className="secondary" disabled={disabled} onClick={() => onAddNode(root.id)}><Plus size={15} />添加第一个知识节点</button></div>}
        </div>
        <div className="structure-foot"><span>点击节点选择 · ＋ 添加下一级</span><button onClick={() => setCollapsed([])}>展开全部</button></div>
      </div>
      <aside className="node-inspector" aria-label="选中节点详情">
        <div className="node-breadcrumb" aria-label="节点路径">{path.map((part, index) => <span key={part.id}>{index > 0 && <ChevronRight size={11} />}<button onClick={() => onSelect(part.id)}>{part.name}</button></span>)}</div>
        <div className="node-inspector-heading"><h3>{active.name}</h3></div>
        <details className="node-management" key={active.id}><summary><Pencil size={14}/>管理节点</summary><div className="node-structure-actions">
          <button className="secondary" disabled={disabled} onClick={() => onAddNode(active.id)}><Plus size={15} />新增子节点</button>
          <button className="secondary" disabled={disabled || active.parent === null} onClick={() => onAddNode(active.parent)}><Plus size={15} />新增同级节点</button>
          <button className="secondary" disabled={disabled} onClick={() => onEditNode(active.id)}><Pencil size={14} />名称与层级</button>
          <div className="node-reorder"><button title="在同级中上移" aria-label="节点上移" disabled={disabled || siblingIndex === 0} onClick={() => onSave({ ...data, nodes: reorderSibling(data.nodes, active.id, -1) })}><ArrowUp size={15} /></button><button title="在同级中下移" aria-label="节点下移" disabled={disabled || siblingIndex === siblings.length - 1} onClick={() => onSave({ ...data, nodes: reorderSibling(data.nodes, active.id, 1) })}><ArrowDown size={15} /></button></div>
        </div>
        </details>
        <div className="node-library-toolbar"><div className="node-cards-heading"><h4><Layers size={17} />知识卡片<span>{scopeCards.length}</span></h4><p>本节点 {directCards.length} 张 · 含子节点 {subtreeCards.length} 张</p></div>
        <div className="node-card-actions"><button className="primary" disabled={disabled} onClick={() => onNewCard(active.id)}><Plus size={15} />新建卡片</button><button className="secondary" disabled={disabled} onClick={() => onAICard(active.id)}><Sparkles size={15} />AI 截图制卡</button><button className="secondary" disabled={disabled} onClick={() => onPDFCard(active.id)}>PDF 制卡</button></div></div>
        <div className="node-card-filters"><label className="node-card-search"><Search size={16}/><input aria-label="搜索当前节点卡片" value={cardQuery} onChange={event=>setCardQuery(event.target.value)} placeholder="搜索问题、答案、标签或备注…"/></label><label className="include-child-cards"><input type="checkbox" checked={includeChildren} onChange={event => setIncludeChildren(event.target.checked)} />包含子节点</label></div><div className="node-result-summary" aria-live="polite">{cardQuery?`找到 ${visibleCards.length} 张卡片`:`共 ${visibleCards.length} 张卡片`}<span>点击阅读 · ← → 连续浏览</span></div>
        {visibleCards.length ? <SortableCards key={active.id+includeChildren+cardQuery} className="node-card-list" data={data} cards={visibleCards} disabled={disabled} onSave={onSave}>{card => <button key={card.id} onClick={() => onOpenCard(card, visibleCards)}><b>{card.front}</b><span>{data.nodes.find(node => node.id === card.node)?.name}</span><p>{card.back}</p>{matchingNote(card,cardQuery)&&<p className="note-search-match">备注匹配：{noteExcerpt(matchingNote(card,cardQuery)!,cardQuery)}</p>}</button>}</SortableCards> : <div className="node-cards-empty"><Layers size={22} /><p>{cardQuery?'没有找到匹配的卡片':'这个节点还没有卡片'}</p>{cardQuery?<button className="secondary" onClick={()=>setCardQuery('')}>清除搜索</button>:<small>点击「新建卡片」或「AI 截图制卡」，记录第一个知识点。</small>}</div>}
      </aside>
    </div>
  </section>;
}
