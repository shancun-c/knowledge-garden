import { z } from 'zod';
import {cardImageSchema} from './card-images.ts';
import {optimizationSchema} from './fsrs-personalization.ts';
import {fsrsSchema, reviewLogSchema, scheduleFSRS} from './fsrs.ts';
export {intervalLabel, previewDue} from './fsrs.ts';
export const nodeSchema = z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(80),parent:z.string().nullable()});
export const cardSchema = z.object({id:z.string().min(1).max(100),node:z.string(),front:z.string().trim().min(1).max(3000),back:z.string().trim().min(1).max(12000),images:z.array(cardImageSchema).max(6).optional(),notes:z.string().max(12000).optional(),comments:z.array(z.object({id:z.string().min(1).max(100),text:z.string().trim().min(1).max(12000),createdAt:z.number().finite().nonnegative()})).max(1000).optional(),tags:z.array(z.string().max(40)).max(15),due:z.number().finite().nonnegative(),interval:z.number().finite().min(0).max(36500),ease:z.number().finite().min(1.3).max(4),reps:z.number().int().nonnegative(),reviews:z.number().int().nonnegative(),fsrs:fsrsSchema.optional(),reviewLog:z.array(reviewLogSchema).optional()});
export const linkSchema = z.object({id:z.string(),from:z.string(),to:z.string(),reason:z.string().min(1).max(1000)});
export const stateSchema=z.object({schedulerVersion:z.union([z.literal(2),z.literal(3)]).optional(),optimization:optimizationSchema.optional(),studySettings:z.object({dailyNewLimit:z.number().int().min(0).max(100)}).optional(),studyDay:z.object({day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),introducedIds:z.array(z.string().min(1).max(100)).max(10000)}).optional(),nodes:z.array(nodeSchema).max(1000),cards:z.array(cardSchema).max(3000),links:z.array(linkSchema).max(10000)}).superRefine((s,ctx)=>{
 const ns=new Set(s.nodes.map(n=>n.id)),cs=new Set(s.cards.map(c=>c.id));
 if(ns.size!==s.nodes.length||cs.size!==s.cards.length)ctx.addIssue({code:'custom',message:'重复 ID'});
 for(const n of s.nodes){let p=n.parent;const seen=new Set([n.id]);while(p){if(!ns.has(p)||seen.has(p)){ctx.addIssue({code:'custom',message:'无效或循环的知识树'});break;}seen.add(p);p=s.nodes.find(x=>x.id===p)!.parent;}}
 if(s.cards.some(c=>!ns.has(c.node))||s.links.some(l=>!cs.has(l.from)||!cs.has(l.to)||l.from===l.to))ctx.addIssue({code:'custom',message:'无效的知识关联'});
});
export type KnowledgeState=z.infer<typeof stateSchema>;export type Card=z.infer<typeof cardSchema>;
export const schedule = scheduleFSRS<Card>;
export function descendants(nodes:KnowledgeState['nodes'],id:string):Set<string>{const ids=new Set([id]);let count=0;while(count!==ids.size){count=ids.size;nodes.forEach(n=>{if(n.parent&&ids.has(n.parent))ids.add(n.id)})}return ids;}
export function sampleState():KnowledgeState {const now=Date.now();return {nodes:[{id:'learning',name:'学习如何学习',parent:null},{id:'memory',name:'记忆与认知',parent:'learning'},{id:'method',name:'高效学习方法',parent:'learning'},{id:'psychology',name:'认知心理学',parent:null},{id:'thinking',name:'思维模型',parent:null}],cards:[['active','method','什么是主动回忆？','合上书本，主动从记忆中提取信息，而不是反复阅读。尝试回答问题、复述概念或做练习，能让你发现真正没有掌握的部分。','学习方法'],['spacing','memory','为什么间隔复习比集中学习更有效？','将复习分散在不同时间，在记忆即将变得模糊时重新提取，可以加强长期记忆。间隔需要根据实际回忆表现调整。','记忆科学'],['feynman','method','如何使用费曼学习法？','选择一个概念，用自己的语言向初学者解释。遇到解释不清的地方就回到资料，补齐理解，再用更简洁的例子重新解释。','学习方法'],['load','psychology','认知负荷是什么？','工作记忆在某个时刻承担的信息处理量。学习复杂内容时，减少无关干扰，并把内容拆成有意义的小块，有助于理解。','认知心理'],['chunk','memory','什么是组块化？','把零散的信息组织成有意义的单元。例如，将多个步骤整理为一个熟悉的流程，可以减少工作记忆需要同时处理的项目数。','记忆科学'],['first','thinking','第一性原理如何帮助思考？','将问题拆解到基本事实与约束，再从这些基础推导方案。使用时要区分已经验证的事实和未经验证的假设。','思维模型']].map(([id,node,front,back,tag])=>({id,node,front,back,tags:[tag],due:now,interval:0,ease:2.5,reps:0,reviews:0})),links:[{id:'l1',from:'active',to:'spacing',reason:'间隔复习安排提取的时间，主动回忆决定提取的方式。'},{id:'l2',from:'load',to:'chunk',reason:'组块化可以降低工作记忆的负担。'}]};}

// Empty scope means all knowledge; an unknown node never widens the scope.
export function studyCards(state:KnowledgeState, nodeId:string):Card[] {
 if(!nodeId)return state.cards;
 if(!state.nodes.some(n=>n.id===nodeId))return [];
 const ids=descendants(state.nodes,nodeId);
 return state.cards.filter(card=>ids.has(card.node));
}
