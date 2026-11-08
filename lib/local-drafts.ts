import {z} from 'zod';
import {cardImageSchema} from './card-images.ts';
export const noteDraftSchema=z.object({id:z.string().min(1).max(100),text:z.string().max(12000),createdAt:z.number().finite().nonnegative(),savedText:z.string().max(12000)});
export type NoteDraft=z.infer<typeof noteDraftSchema>;
export const editorDraftSchema=z.object({front:z.string().max(3000),back:z.string().max(12000),tags:z.string().max(1000),node:z.string().max(100),images:z.array(cardImageSchema).max(6)});
export type EditorDraft=z.infer<typeof editorDraftSchema>;
export const draftKey=(scope:string,kind:'note'|'editor',id:string)=>`knowledge-draft-v1:${scope}:${kind}:${id}`;
export function readDraft<T>(storage:Pick<Storage,'getItem'>,key:string,schema:z.ZodType<T>):T|null{
 const raw=storage.getItem(key);if(!raw)return null;
 try{const parsed=schema.safeParse(JSON.parse(raw));return parsed.success?parsed.data:null;}catch{return null;}
}
