import {test} from 'node:test';import assert from 'node:assert/strict';
import {applyDraftIllustration} from '../lib/draft-illustrations.ts';
const a={clientId:'a',front:'q',back:'a'},b={clientId:'b',front:'q2',back:'a2'};
const image={id:'a'.repeat(64),mime:'image/png' as const,side:'back' as const,caption:'test'};
test('late illustration targets a stable draft ID, not a shifted array index',()=>{const r=applyDraftIllustration([b],a,{image});assert.deepEqual(r,[b]);const moved=applyDraftIllustration([b,a],a,{image});assert.deepEqual(moved[0],b);assert.deepEqual(moved[1],{...a,images:[image],imageError:undefined})});
test('changed question or answer does not receive a stale diagram',()=>{for(const changed of [{...a,front:'changed'},{...a,back:'changed'}])assert.deepEqual(applyDraftIllustration([changed],a,{image}),[changed])});
test('retry preserves uploaded attachments and deduplicates generated image',()=>{const second={...image,id:'b'.repeat(64)};const r=applyDraftIllustration([{...a,images:[second,image],imageError:undefined as string|undefined}],a,{image});assert.equal(r[0].images.length,2);const failed=applyDraftIllustration(r,a,{error:'timeout'});assert.deepEqual(failed[0].images,[second,image]);assert.equal(failed[0].imageError,'timeout')});
