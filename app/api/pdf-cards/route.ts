import {PDFDocument} from 'pdf-lib';
import {z} from 'zod';
import {getChatGPTUser,validWriteOrigin} from '../../chatgpt-auth';
import {aiSettingsStore} from '../../../lib/ai-settings';
import {pdfBatchSchema,pdfCardSchema,pdfInstructions,PDF_BATCH_BYTES} from '../../../lib/pdf-cards';
import {protectMath,renderFormula} from '../../../lib/card-math';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const object=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const schema=object({summary:{type:'string'},cards:{type:'array',maxItems:16,items:object({front:{type:'string'},back:{type:'string'},tags:{type:'array',items:{type:'string'}},imagePrompt:{type:'string'},sourcePages:{type:'array',items:{type:'integer'}}})}});
export async function POST(req:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'},{status:401});
 if(!validWriteOrigin(req))return Response.json({error:'不允许跨站请求'},{status:403});
 try{
  if(Number(req.headers.get('content-length'))>7_500_000)return Response.json({error:'本批 PDF 过大，请减少页数'},{status:413});
  const raw=await req.text();if(raw.length>7_500_000)return Response.json({error:'本批 PDF 过大，请减少页数'},{status:413});
  const b=pdfBatchSchema.parse(JSON.parse(raw));const bytes=Buffer.from(b.pdf.split(',')[1],'base64');
  if(bytes.length>PDF_BATCH_BYTES||!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('PDF 内容无效或本批超过 5 MB，请缩小页码范围');
  let pdf;try{pdf=await PDFDocument.load(bytes,{updateMetadata:false})}catch{throw Error('无法读取 PDF，请使用未加密且完整的文件')}
  if(pdf.getPageCount()!==b.end-b.contextStart+1)throw Error('PDF 页数与请求范围不一致');
  const config=await aiSettingsStore.resolve(user.userId);if(!config.apiKey)return Response.json({error:'请先在设置中配置 OpenAI API Key 和支持 PDF 视觉输入的模型'},{status:503});
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,store:false,instructions:pdfInstructions,input:[{role:'user',content:[{type:'input_file',filename:'source.pdf',file_data:b.pdf},{type:'input_text',text:JSON.stringify({filename:b.filename,physicalPages:`附件依次为原 PDF 第 ${b.contextStart}–${b.end} 页；本批需学习的新内容是第 ${b.start}–${b.end} 页。`,requirements:b.requirements,previous:b.previous})}]}],text:{format:{type:'json_schema',name:'pdf_knowledge_cards',strict:true,schema}},max_output_tokens:12000}),signal:AbortSignal.any([req.signal,AbortSignal.timeout(180000)])});
  if(!r.ok)return Response.json({error:`OpenAI PDF 分析失败（${r.status}）。请检查模型是否支持 PDF 视觉输入、额度与连接，然后重试本批。`},{status:502});
  const result=await r.json() as {status:string;output?:{content?:{type:string;text?:string}[]}[]};if(result.status!=='completed')throw Error('本批输出未完成，请缩小页码范围后重试；已有草稿仍保留');
  const text=result.output?.flatMap((x:{content?:{type:string,text?:string}[]})=>x.content||[]).filter((x:{type:string})=>x.type==='output_text').map(x=>x.text||'').join('');
  const parsed=z.object({summary:z.string().max(3000),cards:z.array(pdfCardSchema).max(16)}).parse(JSON.parse(text||'{}'));
  for(const c of parsed.cards){if(c.sourcePages.some(p=>p<b.contextStart||p>b.end)||!c.sourcePages.some(p=>p>=b.start))throw Error('AI 返回的来源页码不正确，请重试本批');for(const t of [c.front,c.back])for(const f of protectMath(t).formulas)if(!renderFormula(f.tex,f.display)||/\\\\(?:mathrm|Delta|frac|sigma)/.test(f.tex))throw Error('AI 公式格式有误，请重试本批');}
  return Response.json(parsed);
 }catch(e){return Response.json({error:e instanceof z.ZodError?'PDF 请求或生成内容格式无效，请检查文件或重试':e instanceof Error?(e.name==='TimeoutError'?'本批分析超时，可重试；已有草稿不受影响':e.message):'PDF 分析失败，请重试'},{status:400})}
}
