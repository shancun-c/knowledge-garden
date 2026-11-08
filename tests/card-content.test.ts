import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCardContent, splitItemLabel, inlineTokens } from '../lib/card-content.ts';
test('summary and labeled causal bullets become separate readable blocks', () => {
  const blocks = parseCardContent('总需求由消费、投资、政府购买和净出口构成。\n- 财富效应：价格上升→实际价值下降\n- 利率效应：货币需求增加→利率上升');
  assert.equal(blocks.length,2);assert.equal(blocks[0].type,'paragraph');
  assert.deepEqual(blocks[1],{type:'list',ordered:false,start:1,items:['财富效应：价格上升→实际价值下降','利率效应：货币需求增加→利率上升']});
  assert.deepEqual(splitItemLabel('财富效应：价格上升→实际价值下降'),{label:'财富效应',body:'价格上升→实际价值下降'});
});
test('plain text, headings, ordered starts, multiline items and negative numbers retained', () => {
  assert.deepEqual(parseCardContent('第一行\r\n第二行'),[{type:'paragraph',text:'第一行\n第二行'}]);
  assert.deepEqual(parseCardContent('## 步骤\n3. 第一步\n补充说明\n4. 第二步'),[{type:'heading',text:'步骤'},{type:'list',ordered:true,start:3,items:['第一步\n补充说明','第二步']}]);
  assert.deepEqual(parseCardContent('-1.5%'),[{type:'paragraph',text:'-1.5%'}]);
  assert.deepEqual(parseCardContent('3.14'),[{type:'paragraph',text:'3.14'}]);
  assert.equal(splitItemLabel('https://example.test'),null);
  assert.deepEqual(parseCardContent(''),[]);
});
test('inline emphasis supports text and treats HTML as literal data', () => {
  const tokens=inlineTokens('**重点**与`P1`→P2 <img src=x onerror=alert(1)>');
  assert.deepEqual(tokens.map(t=>t.type),['strong','text','code','arrow','text']);
  assert.ok(tokens.at(-1)?.text.includes('<img src=x onerror=alert(1)>'));
  assert.equal(inlineTokens('**未闭合')[0].type,'text');
});
