import type {CardImage} from './card-images';
export type IllustrationDraft={clientId?:string;front:string;back:string;images?:CardImage[];imageError?:string};
/** Never attach a late illustration to a removed or subsequently edited draft. */
export function applyDraftIllustration<T extends IllustrationDraft>(drafts:T[],request:IllustrationDraft,result:{image:CardImage}|{error:string}):T[]{
 return drafts.map(d=>d.clientId!==request.clientId||d.front!==request.front||d.back!==request.back?d:'image' in result?{...d,images:[...(d.images||[]).filter(i=>i.id!==result.image.id),result.image].slice(0,6),imageError:undefined}:{...d,imageError:result.error});
}
