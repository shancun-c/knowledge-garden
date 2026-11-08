import {test} from 'node:test';import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {pdfBatches,pdfBatchSchema,pdfCardSchema,dedupePDFCards,pdfInstructions} from '../lib/pdf-cards.ts';
test('page plan covers selected pages once, with preceding context and short last batch',()=>{
 assert.deepEqual(pdfBatches(1,8),[{start:1,end:4,contextStart:1},{start:5,end:8,contextStart:4}]);
 assert.deepEqual(pdfBatches(3,7),[{start:3,end:6,contextStart:2},{start:7,end:7,contextStart:6}]);
 for(const [s,e] of [[0,3],[4,3],[1,201],[1.5,4]])assert.throws(()=>pdfBatches(s,e));
});
test('reject forged bounds and oversized batches',()=>{
 const b={filename:'a.pdf',pdf:'data:application/pdf;base64,JVBERg==',start:1,end:4,contextStart:1};assert.ok(pdfBatchSchema.safeParse(b).success);
 for(const patch of [{end:6},{contextStart:0},{start:5,end:8,contextStart:1},{pdf:'data:text/plain;base64,YQ=='}])assert.equal(pdfBatchSchema.safeParse({...b,...patch}).success,false);
});
test('dedupe exact normalized questions, preserve distinct concepts',()=>{
 assert.deepEqual(dedupePDFCards([{front:' 什么是期货？ '},{front:'什么是期货?'},{front:'如何套期保值？'}],[{front:'什么是期货？'}]),[{front:'如何套期保值？'}]);
 assert.equal(pdfCardSchema.safeParse({front:'q',back:'a',tags:[],imagePrompt:'',sourcePages:[]}).success,false);
 assert.match(pdfInstructions,/最多 16 张/);assert.doesNotMatch(pdfInstructions,/最多 5 张/);assert.match(pdfInstructions,/\\frac/);
});
test('split preserves selected page order and dimensions without altering original',async()=>{
 const source=await PDFDocument.create();for(let i=1;i<=8;i++)source.addPage([300+i,400+i]);const original=await source.save();
 const loaded=await PDFDocument.load(original);for(const b of pdfBatches(1,8)){const part=await PDFDocument.create();const pages=await part.copyPages(loaded,Array.from({length:b.end-b.contextStart+1},(_,j)=>b.contextStart+j-1));pages.forEach(p=>part.addPage(p));const parsed=await PDFDocument.load(await part.saveAsBase64({dataUri:true}));assert.equal(parsed.getPageCount(),b.end-b.contextStart+1);assert.equal(parsed.getPages()[0].getWidth(),300+b.contextStart);}
 assert.equal(loaded.getPageCount(),8);
});
