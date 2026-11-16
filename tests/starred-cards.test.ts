import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleState} from '../lib/model.ts';
import {starredCards} from '../lib/starred-cards.ts';

test('dedicated starred library excludes unstarred cards and preserves library order',()=>{
  const state=sampleState();
  state.cards[0].starred=true;state.cards[2].starred=true;state.cards[1].starred=false;
  assert.deepEqual(starredCards(state).map(c=>c.id),['active','feynman']);
  state.cards[0].starred=false;
  assert.deepEqual(starredCards(state).map(c=>c.id),['feynman']);
});

test('starred search combines notes and descendant scope without widening unknown scope',()=>{
  const state=sampleState();
  state.cards[0].starred=true;state.cards[3].starred=true;
  state.cards[0].comments=[{id:'test',text:'重点复习这个概念',createdAt:1}];
  assert.deepEqual(starredCards(state,'重点复习','learning').map(c=>c.id),['active']);
  assert.equal(starredCards(state,'重点复习','psychology').length,0);
  assert.equal(starredCards(state,'','missing').length,0);
  assert.equal(starredCards(state,'没有这个关键词').length,0);
});
