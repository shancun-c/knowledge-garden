import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reorderCards } from '../lib/card-order.ts';
import { sampleState, stateSchema } from '../lib/model.ts';
import { FileStore, RevisionConflict } from '../lib/file-store.ts';
import { studyQueue } from '../lib/study-plan.ts';

test('drag before/after moves visible cards, preserving hidden slots and original objects', () => {
  const cards = sampleState().cards, visible = [cards[0].id, cards[2].id, cards[4].id];
  const result = reorderCards(cards, visible, cards[0].id, cards[4].id, 'after');
  assert.deepEqual(result, [cards[2], cards[1], cards[4], cards[3], cards[0], cards[5]]);
  assert.equal(result[4], cards[0]);
  assert.deepEqual(reorderCards(result, visible, cards[0].id, cards[2].id, 'before'), cards);
  assert.equal(reorderCards(cards, visible, cards[0].id, cards[0].id, 'after'), cards);
  assert.equal(reorderCards(cards, visible, 'missing', cards[0].id, 'before'), cards);
  assert.equal(reorderCards(cards, visible, cards[1].id, cards[0].id, 'before'), cards);
  assert.equal(reorderCards(cards, visible, cards[0].id, cards[2].id, 'before'), cards);
});

test('order survives persistence/export; stale saves fail without losing card content or FSRS scheduling', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'card-order-'));
  try {
    const state = sampleState(), now = Date.now() + 1000;
    state.schedulerVersion = 3;
    state.cards[0].comments = [{ id: 'note', text: '保留备注', createdAt: now }];
    const beforeQueue = studyQueue(state, state.cards, now);
    const cards = reorderCards(state.cards, state.cards.map(card => card.id), state.cards[0].id, state.cards[5].id, 'after');
    const store = new FileStore(dir);
    await store.write('test', state, 0);
    await store.write('test', { ...state, cards }, 1);
    await assert.rejects(store.write('test', state, 1), RevisionConflict);
    const saved = stateSchema.parse(JSON.parse(JSON.stringify((await new FileStore(dir).read('test')).state)));
    assert.deepEqual(saved.cards, cards);
    assert.deepEqual(studyQueue(saved, saved.cards, now), beforeQueue);
    assert.deepEqual(saved.links, state.links);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
