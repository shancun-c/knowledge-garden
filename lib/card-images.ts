import {z} from 'zod';
export const cardImageSchema=z.object({id:z.string().regex(/^[a-f0-9]{64}$/),mime:z.enum(['image/png','image/jpeg','image/webp','image/svg+xml']),caption:z.string().max(500),side:z.enum(['front','back'])});
export type CardImage=z.infer<typeof cardImageSchema>;
export const imageUrl=(image:CardImage)=>`/api/images/${image.id}`;
