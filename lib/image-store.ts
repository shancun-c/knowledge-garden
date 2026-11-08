import {renderSvgIllustration} from './svg-illustration.ts';
import {renderEconomicDiagram} from './economic-diagram.ts';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
export const MAX_IMAGE_BYTES=5*1024*1024;
export function imageMime(bytes:Buffer){
 if(bytes.length<12)throw Error('图片内容无效');
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png' as const;
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg' as const;
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp' as const;
 throw Error('仅支持 PNG、JPEG、WebP 图片');
}
export class ImageStore{
 constructor(privateDirectory:string){this.directory=privateDirectory}private directory:string;
 private ownerPath(owner:string){return join(this.directory,createHash('sha256').update(owner).digest('hex'))}
 async put(owner:string,bytes:Buffer){if(bytes.length>MAX_IMAGE_BYTES)throw Error('图片不能超过 5 MB');return this.persist(owner,bytes,imageMime(bytes))}
 async putSvgIllustration(owner:string,scene:unknown){return this.persist(owner,Buffer.from(renderSvgIllustration(scene)),'image/svg+xml' as const)}
 async putEconomicDiagram(owner:string){return this.persist(owner,Buffer.from(renderEconomicDiagram()),'image/svg+xml' as const)}
 private async persist<T extends string>(owner:string,bytes:Buffer,mime:T){const id=createHash('sha256').update(bytes).digest('hex');const dir=this.ownerPath(owner);await mkdir(dir,{recursive:true,mode:0o700});const tmp=join(dir,`${id}.${randomUUID()}.tmp`);await writeFile(tmp,bytes,{mode:0o600});await rename(tmp,join(dir,id));return {id,mime}}
 async get(owner:string,id:string){if(!/^[a-f0-9]{64}$/.test(id))throw Error('无效图片');const bytes=await readFile(join(this.ownerPath(owner),id));return {bytes,mime:(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" data-knowledge-diagram="(?:ad-as-v1|ai-scene-v1)"/).test(bytes.toString('utf8'))?'image/svg+xml' as const:imageMime(bytes)}}
}
export const imageStore=new ImageStore(join(process.env.KNOWLEDGE_DATA_DIR||'./data','images'));
