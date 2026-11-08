import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderSvgIllustration,svgSceneSchema} from '../lib/svg-illustration.ts';
import {ImageStore} from '../lib/image-store.ts';
const text={kind:'text',x:40,y:80,width:0,height:0,points:[],text:'F 分布：n₂ > 2',fill:'#293d34',stroke:'none',fontSize:24};
const scene={title:'F 分布',description:'期望条件讲解',elements:[text]};
test('SVG renderer escapes model text and rejects executable attributes and URLs',()=>{
 const svg=renderSvgIllustration({...scene,title:'<script>alert(1)</script>',elements:[{...text,text:'<image href="https://evil" onload="bad"> &'}]});
 assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('&amp;'));assert.ok(!svg.includes('<script'));assert.ok(!svg.includes('<image'));
 assert.equal(svgSceneSchema.safeParse({...scene,elements:[{...text,fill:'url(https://evil)'}]}).success,false);
 assert.equal(svgSceneSchema.safeParse({...scene,elements:[{...text,onload:'bad'}]}).success,false);
});
test('SVG renderer bounds geometry and requires coordinates for lines',()=>{
 assert.throws(()=>renderSvgIllustration({...scene,elements:[{...text,x:Infinity}]}));
 assert.throws(()=>renderSvgIllustration({...scene,elements:[{...text,kind:'line'}]}));
 assert.throws(()=>renderSvgIllustration({...scene,elements:[{...text,kind:'rect',width:1000}]}));
 const svg=renderSvgIllustration({...scene,elements:[{...text,kind:'arrow',points:[{x:100,y:100},{x:200,y:80}]}]});assert.ok(svg.includes('100,100 200,80'));assert.equal((svg.match(/<polyline/g)||[]).length,2);
});
test('AI SVG persists as authenticated image and is isolated by owner',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'svg-scene-'));try{const store=new ImageStore(dir);const image=await store.putSvgIllustration('one',scene);assert.equal(image.mime,'image/svg+xml');const saved=await store.get('one',image.id);assert.equal(saved.mime,'image/svg+xml');assert.equal(saved.bytes.toString(),renderSvgIllustration(scene));await assert.rejects(store.get('two',image.id));await assert.rejects(store.put('one',Buffer.from('<svg onload="bad"/>')));}finally{await rm(dir,{recursive:true,force:true})}
});
