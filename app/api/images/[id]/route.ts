import {getChatGPTUser} from '../../../chatgpt-auth';
import {imageStore} from '../../../../lib/image-store';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();if(!user)return new Response(null,{status:401});try{const image=await imageStore.get(user.userId,(await params).id);return new Response(new Uint8Array(image.bytes),{headers:{'Content-Type':image.mime,'Content-Security-Policy':"default-src 'none'; sandbox",'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=3600'}})}catch{return new Response(null,{status:404})}
}
