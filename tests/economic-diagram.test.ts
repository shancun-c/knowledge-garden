import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkedEconomicGeometry,renderEconomicDiagram} from '../lib/economic-diagram.ts';
import {acceptsEconomicPlan,isEconomicCurveRequest} from '../lib/economic-illustration-plan.ts';
import {ImageStore} from '../lib/image-store.ts';
test('demand shock and supply adjustment preserve equilibrium and return to natural output',()=>{
 const g=checkedEconomicGeometry();
 for(const [point,a,b] of [[g.e1,g.ad1,g.as1],[g.e2,g.ad2,g.as1],[g.e3,g.ad2,g.as2]] as const){assert.equal(point.p,a.m*point.y+a.b);assert.equal(point.p,b.m*point.y+b.b)}
 assert.ok(g.e2.y>g.e1.y&&g.e2.p>g.e1.p);assert.ok(g.e3.y<g.e2.y&&g.e3.p>g.e2.p);assert.equal(g.e1.y,g.naturalOutput);assert.equal(g.e3.y,g.naturalOutput);
 assert.ok((5-g.ad2.b)/g.ad2.m>(5-g.ad1.b)/g.ad1.m);
 assert.ok(g.as2.m*4+g.as2.b>g.as1.m*4+g.as1.b);
});
test('semantic mismatch cannot select the verified diagram',()=>{
 const plan={kind:'ad_as_demand_increase' as const,initialNaturalOutput:true,demandIncreases:true,shortRunSupplyUpward:true,supplyAdjustsUp:true,returnsToSameNaturalOutput:true,priceOrderCorrect:true,labelsCompatible:true,explanation:''};
 assert.ok(acceptsEconomicPlan(plan));for(const key of Object.keys(plan).filter(k=>typeof plan[k as keyof typeof plan]==='boolean'))assert.equal(acceptsEconomicPlan({...plan,[key]:false}),false);
 assert.equal(acceptsEconomicPlan({...plan,kind:'unsupported'}),false);assert.ok(isEconomicCurveRequest('总需求增加'));assert.equal(isEconomicCurveRequest('细胞结构'),false);
});
test('generated SVG is private and cannot be supplied through upload',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'economic-image-'));try{const s=new ImageStore(dir),image=await s.putEconomicDiagram('one');assert.equal(image.mime,'image/svg+xml');const saved=await s.get('one',image.id);assert.equal(saved.bytes.toString(),renderEconomicDiagram());assert.equal(saved.mime,'image/svg+xml');await assert.rejects(s.get('two',image.id));await assert.rejects(s.put('one',saved.bytes));assert.doesNotMatch(saved.bytes.toString(),/<script|foreignObject|onload=|href=/i);}finally{await rm(dir,{recursive:true,force:true})}
});
