import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IllustrationError,illustrationProviderError,illustrationFailure} from '../lib/illustration-errors.ts';
import {generateSvgScene} from '../lib/svg-illustration.ts';

const scene={title:'示意',description:'测试',elements:[{kind:'text',x:40,y:80,width:0,height:0,points:[],text:'测试',fill:'#293d34',stroke:'none',fontSize:24}]};
const completed=(value:unknown)=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});

test('provider errors distinguish deactivation, authentication, quota, rate and model access without exposing details',async()=>{
 for(const [status,code,expected] of [[401,'account_deactivated','ACCOUNT_DEACTIVATED'],[401,'invalid_api_key','INVALID_API_KEY'],[429,'insufficient_quota','QUOTA_EXCEEDED'],[429,'rate_limit_exceeded','RATE_LIMITED'],[403,null,'MODEL_ACCESS_DENIED'],[404,'model_not_found','MODEL_ACCESS_DENIED'],[503,null,'PROVIDER_UNAVAILABLE']] as const){
  const error=await illustrationProviderError(Response.json({error:{code,message:'secret-key-and-private-card'}},{status}));
  const failure=illustrationFailure(error,'generation');
  assert.equal(failure.body.code,expected);assert.equal(failure.diagnostic.providerStatus,status);
  assert.doesNotMatch(JSON.stringify(failure),/secret-key-and-private-card/);
 }
 const html=await illustrationProviderError(new Response('<html>private error</html>',{status:502}));
 assert.equal(html.code,'PROVIDER_UNAVAILABLE');
});

test('timeouts, invalid diagrams, settings and disk failures remain distinct and safe',()=>{
 assert.equal(illustrationFailure(new DOMException('private content','TimeoutError'),'generation').status,504);
 assert.equal(illustrationFailure(new DOMException('private content','AbortError'),'generation').body.code,'GENERATION_TIMEOUT');
 assert.equal(illustrationFailure(new IllustrationError('INVALID_DIAGRAM'),'generation').body.code,'INVALID_DIAGRAM');
 for(const [phase,code] of [['saving','SAVE_FAILED'],['settings','SETTINGS_FAILED'],['generation','GENERATION_FAILED']] as const){
  const result=illustrationFailure(new Error('/private/path and secret-key'),phase);
  assert.equal(result.body.code,code);assert.doesNotMatch(JSON.stringify(result),/private|secret-key/);
 }
});

test('SVG generation preserves account-deactivated response and does not retry a paid request',async t=>{
 let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({error:{code:'account_deactivated',message:'private-key'}},{status:401})});
 await assert.rejects(generateSvgScene('test-key','test-model','q','a'),(e:unknown)=>e instanceof IllustrationError&&e.code==='ACCOUNT_DEACTIVATED');
 assert.equal(calls,1);
});

test('SVG generation classifies malformed, incomplete and unsafe geometry before saving',async t=>{
 const responses=[completed(scene),{status:'incomplete'},completed({...scene,elements:[{...scene.elements[0],fontSize:0}]}),completed({...scene,elements:[{...scene.elements[0],kind:'rect',width:1000}]})];
 t.mock.method(globalThis,'fetch',async()=>Response.json(responses.shift()));
 assert.deepEqual(await generateSvgScene('test-key','test-model','q','a'),scene);
 for(const code of ['GENERATION_INCOMPLETE','INVALID_DIAGRAM','INVALID_DIAGRAM'])await assert.rejects(generateSvgScene('test-key','test-model','q','a'),(e:unknown)=>e instanceof IllustrationError&&e.code===code);
});
