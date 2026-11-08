import {createEmptyCard, fsrs, generatorParameters, type Card as MemoryCard, type Grade} from 'ts-fsrs';
import {z} from 'zod';
import {profileIdSchema,personalProfileSchema,type PersonalProfile} from './fsrs-personalization.ts';

export const FSRS_PROFILE = 'fsrs6-5.4.2-default-r90-v1' as const;
const number = z.number().finite().nonnegative();
const timestamp = number.max(8640000000000000);
export const memorySchema = z.object({
  stability:number, difficulty:number.max(10), elapsed_days:number,
  scheduled_days:number.max(36500), learning_steps:number.int(), reps:number.int(),
  lapses:number.int(), state:z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3)]),
  last_review:timestamp.optional(),
}).refine(m=>m.state===0 || (m.last_review!==undefined && m.stability>0 && m.difficulty>=1), '已学习卡片缺少有效记忆状态');
export const reviewLogSchema = z.object({
  profile:profileIdSchema, rating:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4)]),
  state:z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3)]),
  due:timestamp, review:timestamp, stability:number, difficulty:number.max(10),
  elapsed_days:number, last_elapsed_days:number, scheduled_days:number,
  learning_steps:number.int(), next_due:timestamp,
});
export const fsrsSchema = z.object({
  profile:profileIdSchema, memory:memorySchema,
  // Preserve the real legacy summary; never invent historical ratings/times.
  legacy:z.object({strategy:z.literal('cold-start'), due:timestamp, interval:number,
    ease:number, reps:number.int(), reviews:number.int()}).optional(),
});
type Schedulable = {due:number; interval:number; ease:number; reps:number; reviews:number;
  fsrs?:z.infer<typeof fsrsSchema>; reviewLog?:z.infer<typeof reviewLogSchema>[]};
const defaultScheduler=fsrs(generatorParameters({request_retention:0.9,maximum_interval:36500,
  enable_fuzz:false,enable_short_term:true,learning_steps:['1m','10m'],relearning_steps:['10m']}));
let cachedProfile:PersonalProfile|undefined, cachedScheduler=defaultScheduler;
function schedulerFor(profile?:PersonalProfile){
  if(!profile)return defaultScheduler;
  if(JSON.stringify(cachedProfile)!==JSON.stringify(profile)){
    personalProfileSchema.parse(profile);cachedProfile=profile;
    cachedScheduler=fsrs(generatorParameters({w:profile.weights,request_retention:0.9,maximum_interval:36500,enable_fuzz:false,enable_short_term:true,learning_steps:['1m','10m'],relearning_steps:['10m']}));
  }
  return cachedScheduler;
}
function outcome(card:Schedulable, grade:number, now:number,profile?:PersonalProfile) {
  const scheduler=schedulerFor(profile);
  if(![0,1,2,3].includes(grade))throw new Error('无效评分');
  if(!Number.isFinite(now)||now<0)throw new Error('无效复习时间');
  let memory:MemoryCard=card.fsrs?{...card.fsrs.memory,due:new Date(card.due),
    last_review:card.fsrs.memory.last_review===undefined?undefined:new Date(card.fsrs.memory.last_review)}:createEmptyCard(new Date(now));
  if(card.fsrs && card.fsrs.profile!==(profile?.id||FSRS_PROFILE)){
    const logs=card.reviewLog||[];
    if(!logs.length||logs[0].state!==0)throw new Error('卡片缺少完整复习记录，无法应用新参数');
    memory=createEmptyCard(new Date(logs[0].review));
    for(const log of logs)memory=scheduler.next(memory,new Date(log.review),log.rating as Grade).card;
    memory.due=new Date(card.due);
  }
  if(memory.last_review && now<memory.last_review.getTime())throw new Error('设备时间早于上次复习，请校准时间');
  return scheduler.next(memory,new Date(now),(grade+1) as Grade);
}
export function previewDue(card:Schedulable,grade:number,now=Date.now(),profile?:PersonalProfile):number {
  return outcome(card,grade,now,profile).card.due.getTime();
}
export function intervalLabel(card:Schedulable,grade:number,now=Date.now(),profile?:PersonalProfile):string {
  const minutes=Math.max(1,Math.round((previewDue(card,grade,now,profile)-now)/60000));
  if(minutes<60)return `${minutes} 分钟后`;
  if(minutes<1440)return `${Math.round(minutes/60*10)/10} 小时后`;
  return `${Math.round(minutes/1440)} 天后`;
}
export function scheduleFSRS<T extends Schedulable>(card:T,grade:number,now=Date.now(),profile?:PersonalProfile):T {
  const result=outcome(card,grade,now,profile);
  const {due,last_review,...memory}=result.card;
  const legacy=card.fsrs?.legacy ?? (card.reviews>0&&!card.fsrs?{
    strategy:'cold-start' as const,due:card.due,interval:card.interval,ease:card.ease,reps:card.reps,reviews:card.reviews,
  }:undefined);
  return {...card,due:due.getTime(),interval:memory.scheduled_days,reps:memory.reps,reviews:card.reviews+1,
    fsrs:{profile:profile?.id||FSRS_PROFILE,memory:{...memory,last_review:last_review?.getTime()},...(legacy?{legacy}:{})},
    reviewLog:[...(card.reviewLog||[]),{...result.log,profile:profile?.id||FSRS_PROFILE,
      rating:(grade+1) as 1|2|3|4,due:result.log.due.getTime(),review:result.log.review.getTime(),next_due:due.getTime()}]};
}
