import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleState} from '../lib/model.ts';
import {cardMatches,matchingNote,noteExcerpt,cardNotes} from '../lib/card-search.ts';
import {draftKey,readDraft,noteDraftSchema,editorDraftSchema} from '../lib/local-drafts.ts';
test('search includes legacy and comment notes with case and whitespace normalization',()=>{
 const c={...sampleState().cards[0],notes:'原有心得',comments:[{id:'1',text:'价格变化的 GDP 例子',createdAt:1}]};
 assert.equal(cardMatches(c,'  gdp  '),true);assert.equal(cardMatches(c,'心得'),true);assert.equal(cardMatches(c,'不存在'),false);
 assert.equal(matchingNote(c,'GDP'),c.comments[0].text);assert.equal(cardNotes(c).length,2);
 const long='甲'.repeat(200)+'GDP'+'乙'.repeat(200);assert.ok(noteExcerpt(long,'gdp').includes('GDP'));assert.ok(noteExcerpt(long,'gdp').length<160);
});
test('draft keys isolate accounts and cards, and invalid local data never restores',()=>{
 const draft={id:'n',text:'未提交笔记',savedText:'',createdAt:1};
 assert.notEqual(draftKey('a','note','1'),draftKey('b','note','1'));assert.notEqual(draftKey('a','note','1'),draftKey('a','editor','1'));
 assert.deepEqual(readDraft({getItem:()=>JSON.stringify(draft)},'x',noteDraftSchema),draft);
 for(const raw of ['{','null',JSON.stringify({...draft,text:123}),JSON.stringify({...draft,text:'x'.repeat(12001)})])assert.equal(readDraft({getItem:()=>raw},'x',noteDraftSchema),null);
 const editor={front:'问题',back:'答案',tags:'标签',node:'n',images:[]};assert.deepEqual(readDraft({getItem:()=>JSON.stringify(editor)},'x',editorDraftSchema),editor);
 assert.throws(()=>readDraft({getItem:()=>{throw Error('storage disabled')}},'x',noteDraftSchema));
});
