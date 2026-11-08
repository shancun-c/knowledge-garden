import { z } from 'zod';
import { cardSchema, nodeSchema, linkSchema, stateSchema, type KnowledgeState } from './model.ts';

const ids = z.array(z.string().min(1).max(100)).max(3000);
export const changesSchema = z.object({
  schedulerVersion: z.literal(3),
  upsert: z.array(cardSchema).max(3000).optional(),
  remove: ids.optional(),
  order: ids.optional(),
  nodes: z.array(nodeSchema).max(1000).optional(),
  links: z.array(linkSchema).max(10000).optional(),
  studySettings: z.object({ dailyNewLimit: z.number().int().min(0).max(100) }).optional(),
}).strict();
export type StateChanges = z.infer<typeof changesSchema>;
const equal = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Full changed cards preserve explicit removal of optional fields (e.g. undo FSRS). */
export function stateChanges(previous: KnowledgeState, next: KnowledgeState): StateChanges {
  const old = new Map(previous.cards.map(card => [card.id, card]));
  const current = new Set(next.cards.map(card => card.id));
  const changes: StateChanges = { schedulerVersion: 3 };
  const upsert = next.cards.filter(card => !equal(card, old.get(card.id)));
  const remove = previous.cards.filter(card => !current.has(card.id)).map(card => card.id);
  if (upsert.length) changes.upsert = upsert;
  if (remove.length) changes.remove = remove;
  // Adding/removing cards naturally appends/removes; send IDs only for non-default order.
  const naturalOrder = [...previous.cards.filter(card => current.has(card.id)), ...next.cards.filter(card => !old.has(card.id))].map(card => card.id);
  if (!equal(naturalOrder, next.cards.map(card => card.id))) changes.order = next.cards.map(card => card.id);
  if (!equal(previous.nodes, next.nodes)) changes.nodes = next.nodes;
  if (!equal(previous.links, next.links)) changes.links = next.links;
  if (!equal(previous.studySettings, next.studySettings) && next.studySettings) changes.studySettings = next.studySettings;
  return changes;
}

export class InvalidStateChanges extends Error {}
export function applyStateChanges(previous: KnowledgeState, changes: StateChanges): KnowledgeState {
  const upsert = changes.upsert || [], removed = new Set(changes.remove || []);
  if (new Set(upsert.map(card => card.id)).size !== upsert.length || removed.size !== (changes.remove || []).length || upsert.some(card => removed.has(card.id))) throw new InvalidStateChanges('重复或冲突的卡片变更');
  const cards = new Map(previous.cards.filter(card => !removed.has(card.id)).map(card => [card.id, card]));
  upsert.forEach(card => cards.set(card.id, card));
  const order = changes.order || [...cards.keys()];
  if (order.length !== cards.size || new Set(order).size !== order.length || order.some(id => !cards.has(id))) throw new InvalidStateChanges('无效的卡片顺序');
  const next = { ...previous, schedulerVersion: changes.schedulerVersion,
    cards: order.map(id => cards.get(id)!), nodes: changes.nodes ?? previous.nodes,
    links: changes.links ?? previous.links, ...(changes.studySettings ? {studySettings:changes.studySettings} : {}) };
  const checked = stateSchema.safeParse(next);
  if (!checked.success) throw new InvalidStateChanges('数据格式或知识关联无效，未保存');
  return checked.data;
}
