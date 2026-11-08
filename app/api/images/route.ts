import {getChatGPTUser,validWriteOrigin} from '../../chatgpt-auth';
import {imageStore,MAX_IMAGE_BYTES} from '../../../lib/image-store';
export const runtime='nodejs';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'},{status:401});if(!validWriteOrigin(request))return Response.json({error:'不允许跨站写入'},{status:403});
 try{const reader=request.body?.getReader();if(!reader)throw Error('没有图片');let length=0;const parts:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_IMAGE_BYTES){await reader.cancel();return Response.json({error:'图片不能超过 5 MB'},{status:413})}parts.push(value)}return Response.json(await imageStore.put(user.userId,Buffer.concat(parts)));}catch{return Response.json({error:'图片上传失败，请使用 5 MB 内的 PNG、JPEG 或 WebP 图片'},{status:400})}
}
