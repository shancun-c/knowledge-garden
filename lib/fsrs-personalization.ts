import {z} from 'zod';
import {clipParameters} from 'ts-fsrs';
export const DEFAULT_PROFILE = 'fsrs6-5.4.2-default-r90-v1';
export const profileIdSchema=z.string().regex(/^fsrs6-(?:5\.4\.2-default-r90-v1|personal-[a-zA-Z0-9-]+)$/).max(120);
export const weightsSchema=z.array(z.number().finite()).length(21).refine(w=>{
  const clipped=clipParameters([...w],1,true);
  return w.every((v,i)=>Math.abs(v-clipped[i])<1e-6);
},'FSRS 参数超出有效范围');
export const personalProfileSchema=z.object({id:profileIdSchema,weights:weightsSchema,createdAt:z.number().finite().nonnegative()});
export type PersonalProfile=z.infer<typeof personalProfileSchema>;
export const metricsSchema=z.object({logLoss:z.number().finite().nonnegative(),rmseBins:z.number().finite().nonnegative()});
export const optimizationRunSchema=z.object({
  id:z.string(),startedAt:z.number(),finishedAt:z.number().optional(),
  status:z.enum(['running','applied','not_improved','failed']),message:z.string(),
  fingerprint:z.string(),samples:z.number(),trainCount:z.number(),validationCount:z.number(),cards:z.number(),
  defaultMetrics:metricsSchema.optional(),currentMetrics:metricsSchema.optional(),candidateMetrics:metricsSchema.optional(),
  candidateWeights:weightsSchema.optional(),
});
export const optimizationSchema=z.object({
  active:personalProfileSchema.optional(),profiles:z.array(personalProfileSchema),
  lastRun:optimizationRunSchema.optional(),resetAt:z.number().optional(),
});
export type Optimization=z.infer<typeof optimizationSchema>;
export type OptimizationRun=z.infer<typeof optimizationRunSchema>;
export function improves(candidate:z.infer<typeof metricsSchema>,current:z.infer<typeof metricsSchema>,defaults:z.infer<typeof metricsSchema>){
  metricsSchema.parse(candidate);metricsSchema.parse(current);metricsSchema.parse(defaults);
  return candidate.logLoss+0.0001<Math.min(current.logLoss,defaults.logLoss)
    && candidate.rmseBins<=Math.min(current.rmseBins,defaults.rmseBins)+0.02;
}
