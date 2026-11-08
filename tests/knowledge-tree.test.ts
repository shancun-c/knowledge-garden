import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nodePath, nodeLabel, reorderSibling } from '../lib/knowledge-tree.ts';
import { stateSchema } from '../lib/model.ts';
const nodes = [
  { id: 'topic', name: '期货投资分析', parent: null },
  { id: 'first', name: '宏观分析', parent: 'topic' },
  { id: 'leaf', name: '经济周期', parent: 'first' },
  { id: 'second', name: '基本面分析', parent: 'topic' },
  { id: 'other', name: '另一主题', parent: null },
];
test('nested topic path and unambiguous card destination label', () => {
  assert.deepEqual(nodePath(nodes, 'leaf').map(n => n.id), ['topic', 'first', 'leaf']);
  assert.equal(nodeLabel(nodes, 'leaf'), '期货投资分析 / 宏观分析 / 经济周期');
  assert.deepEqual(nodePath(nodes, 'missing'), []);
});
test('reordering changes only sibling order and preserves subtree card binding', () => {
  const moved = reorderSibling(nodes, 'second', -1);
  assert.deepEqual(moved.filter(n => n.parent === 'topic').map(n => n.id), ['second', 'first']);
  assert.equal(moved.find(n => n.id === 'leaf')?.parent, 'first');
  assert.equal(nodeLabel(moved, 'leaf'), nodeLabel(nodes, 'leaf'));
  assert.deepEqual(nodes.map(n => n.id), ['topic','first','leaf','second','other']);
  assert.deepEqual(reorderSibling(nodes, 'first', -1), nodes);
  assert.deepEqual(reorderSibling(nodes, 'second', 1), nodes);
});
test('moving a populated subtree preserves valid card references; cycles rejected', () => {
  const card = { id:'c',node:'leaf',front:'问题',back:'答案',tags:[],due:0,interval:0,ease:2.5,reps:0,reviews:0 };
  const moved = nodes.map(n => n.id === 'first' ? {...n, parent:'second'} : n);
  assert.equal(stateSchema.safeParse({nodes:moved,cards:[card],links:[]}).success,true);
  assert.equal(nodeLabel(moved,'leaf'),'期货投资分析 / 基本面分析 / 宏观分析 / 经济周期');
  const cycle = nodes.map(n => n.id === 'first' ? {...n,parent:'leaf'} : n);
  assert.equal(stateSchema.safeParse({nodes:cycle,cards:[card],links:[]}).success,false);
});
