import {getChatGPTUser,validWriteOrigin} from '../../../chatgpt-auth';
import {optimizer,OptimizationBlocked} from '../../../../lib/fsrs-optimizer';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'},{status:401});
 try{return Response.json(await optimizer.status(user.userId),{headers:{'Cache-Control':'no-store'}})}
 catch{return Response.json({error:'无法读取 FSRS 数据，请刷新重试'},{status:500})}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'},{status:401});
 if(!validWriteOrigin(request))return Response.json({error:'不允许跨站写入'},{status:403});
 let action;try{const text=await request.text();if(text.length>1000)throw Error();action=JSON.parse(text).action;if(!['optimize','reset'].includes(action))throw Error()}catch{return Response.json({error:'无效操作'},{status:400})}
 try{return Response.json(await(action==='reset'?optimizer.reset(user.userId):optimizer.optimize(user.userId)))}
 catch(error){return Response.json({error:error instanceof OptimizationBlocked?error.message:'操作失败，未确认保存，请刷新查看结果'},{status:error instanceof OptimizationBlocked?409:500})}
}
