'use client';
import { useRef, useState, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import type { Card, KnowledgeState } from '../lib/model';
import { reorderCards } from '../lib/card-order';

type Props = {
  data: KnowledgeState;
  cards: Card[];
  disabled: boolean;
  className: string;
  onSave: (state: KnowledgeState) => Promise<boolean>;
  children: (card: Card, index: number) => ReactNode;
};

export default function SortableCards({ data, cards, disabled, className, onSave, children }: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; side: 'before' | 'after' } | null>(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const blocked = disabled || saving;
  async function move(source: string, target: string, side: 'before' | 'after') {
    setDragging(null); setDrop(null);
    if (blocked || locked.current) return;
    const next = reorderCards(data.cards, cards.map(card => card.id), source, target, side);
    if (next === data.cards) return;
    locked.current = true; setSaving(true); setStatus('正在保存顺序…');
    try {
      const saved = await onSave({ ...data, cards: next });
      setStatus(saved ? '顺序已保存' : '排序未保存，已保留原顺序。请同步最新数据后重试。');
    } catch { setStatus('排序未保存，已保留原顺序。请重试。'); }
    finally { locked.current = false; setSaving(false); }
  }
  return <>
    <div className="card-order-help"><span>拖动手柄调整顺序 · 松开自动保存</span><span role="status">{status}</span></div>
    <div className={className} aria-label="可排序卡片列表" aria-busy={saving}>
      {cards.map((card, index) => <div key={card.id} data-card-id={card.id}
        className={`sortable-card${dragging === card.id ? ' is-dragging' : ''}${drop?.id === card.id ? ` drop-${drop.side}` : ''}`}
        onDragOver={event => {
          if (!dragging || blocked || dragging === card.id) return;
          event.preventDefault(); event.dataTransfer.dropEffect = 'move';
          const rect = event.currentTarget.getBoundingClientRect();
          setDrop({ id: card.id, side: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after' });
        }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null); }}
        onDrop={event => {
          if (!dragging || blocked) return;
          event.preventDefault(); event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          void move(dragging, card.id, event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
        }}>
        <button type="button" className="card-drag-handle" aria-label={`调整第 ${index + 1} 张卡片顺序`}
          title="拖动排序；聚焦后按 Alt + ↑ / ↓ 移动" disabled={blocked || cards.length < 2}
          draggable={!blocked && cards.length > 1}
          onClick={event => event.stopPropagation()}
          onDragStart={event => {
            if (blocked) { event.preventDefault(); return; }
            event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', card.id);
            event.dataTransfer.setDragImage(event.currentTarget.parentElement!, 24, 24);
            setDragging(card.id); setStatus('');
          }}
          onDragEnd={() => { setDragging(null); setDrop(null); }}
          onKeyDown={event => {
            if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            const offset = event.key === 'ArrowUp' ? -1 : 1, target = cards[index + offset];
            if (target) void move(card.id, target.id, offset < 0 ? 'before' : 'after');
          }}><GripVertical size={18} /></button>
        {children(card, index)}
      </div>)}
    </div>
  </>;
}
