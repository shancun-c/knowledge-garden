import type { Card } from './model';

/** Reorder only visible slots, keeping hidden cards and every card's content intact. */
export function reorderCards(cards: Card[], visibleIds: string[], source: string, target: string, side: 'before' | 'after'): Card[] {
  const visible = new Set(visibleIds);
  const ordered = cards.filter(card => visible.has(card.id));
  if (source === target || !ordered.some(card => card.id === source) || !ordered.some(card => card.id === target)) return cards;
  const moved = ordered.find(card => card.id === source)!;
  const remaining = ordered.filter(card => card.id !== source);
  remaining.splice(remaining.findIndex(card => card.id === target) + (side === 'after' ? 1 : 0), 0, moved);
  let index = 0;
  const result = cards.map(card => visible.has(card.id) ? remaining[index++] : card);
  return result.every((card, i) => card === cards[i]) ? cards : result;
}
