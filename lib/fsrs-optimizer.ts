import {randomUUID} from 'node:crypto';
import {FileStore,fileStore} from './file-store.ts';
import {trainingData} from './fsrs-training-data.ts';
import {improves,type Optimization,type OptimizationRun} from './fsrs-personalization.ts';
import {runTraining,trainingResultSchema,type TrainingResult} from './fsrs-training-runner.ts';
import {stateSchema} from './model.ts';
export class OptimizationBlocked extends Error{}
export class Optimizer {
  private running=false;
  private store:FileStore; private train:typeof runTraining;
  constructor(store:FileStore,train:typeof runTraining=runTraining){this.store=store;this.train=train}
  async status(owner:string){
    let stored=await this.store.read(owner);
    const last=stored.state.optimization?.lastRun;
    if(last?.status==='running' && Date.now()-last.startedAt>75000){
      stored=await this.store.mutate(owner,p=>{
        const o=p.state.optimization;
        if(o?.lastRun?.id!==last.id||o.lastRun.status!=='running')return p.state;
        return {...p.state,optimization:{...o,lastRun:{...o.lastRun,status:'failed',finishedAt:Date.now(),message:'上次训练已中断或超时，原参数保持不变，可重试'}}};
      });
    }
    const dataset=trainingData(stateSchema.parse(stored.state));
    const o=stored.state.optimization;
    const duplicate=o?.lastRun?.fingerprint===dataset.fingerprint && ['applied','not_improved'].includes(o.lastRun.status);
    return {stats:dataset.stats,optimization:o||{profiles:[]},canTrain:dataset.stats.canTrain&&!duplicate&&o?.lastRun?.status!=='running',unchanged:Boolean(duplicate)};
  }
  async optimize(owner:string){
    if(this.running)throw new OptimizationBlocked('服务器正在执行训练，请稍后重试');
    this.running=true;let job:OptimizationRun|undefined;
    try{
      const stored=await this.store.read(owner);const state=stateSchema.parse(stored.state),dataset=trainingData(state);
      const old=state.optimization;
      if(old?.lastRun?.status==='running'&&Date.now()-old.lastRun.startedAt<75000)throw new OptimizationBlocked('训练仍在进行，请稍后查看');
      if(!dataset.stats.canTrain)throw new OptimizationBlocked(dataset.stats.reasons.join('；'));
      if(old?.lastRun?.fingerprint===dataset.fingerprint&&['applied','not_improved'].includes(old.lastRun.status))throw new OptimizationBlocked('数据未增加，无需重复优化');
      job={id:randomUUID(),startedAt:Date.now(),status:'running',message:'正在训练并验证；当前参数继续生效',fingerprint:dataset.fingerprint,
        samples:dataset.stats.usedSamples,trainCount:dataset.train.length,validationCount:dataset.validation.length,cards:dataset.stats.cards};
      const run=job;
      await this.store.mutate(owner,p=>({...p.state,schedulerVersion:3,optimization:{...(p.state.optimization||{profiles:[]}),lastRun:run}}));
      const result:TrainingResult=trainingResultSchema.parse(await this.train({train:dataset.train,validation:dataset.validation,weights:old?.active?.weights}));
      const applied=improves(result.candidateMetrics,result.currentMetrics,result.defaultMetrics);
      await this.store.mutate(owner,p=>{
        const o=p.state.optimization!;
        if(o.lastRun?.id!==run.id||o.lastRun.status!=='running')throw new Error('训练任务状态已变化，未应用结果');
        const profile={id:`fsrs6-personal-${run.id}`,weights:result.weights,createdAt:Date.now()};
        const next:Optimization={...o,lastRun:{...run,finishedAt:Date.now(),status:applied?'applied':'not_improved',message:applied?'验证集表现改善，已启用个人参数；下次评分开始生效':'验证集未同时优于当前与默认参数，继续使用原参数',candidateWeights:result.weights,defaultMetrics:result.defaultMetrics,currentMetrics:result.currentMetrics,candidateMetrics:result.candidateMetrics}};
        if(applied){next.active=profile;next.profiles=[...o.profiles,profile]}
        return stateSchema.parse({...p.state,optimization:next});
      });
    }catch(error){
      if(job){const run=job;await this.store.mutate(owner,p=>{
        const o=p.state.optimization;
        if(o?.lastRun?.id!==run.id||o.lastRun.status!=='running')return p.state;
        return {...p.state,optimization:{...o,lastRun:{...run,status:'failed',finishedAt:Date.now(),message:error instanceof Error?error.message:'训练失败，原参数保持不变'}}};
      });}
      else throw error;
    }finally{this.running=false}
    return this.status(owner);
  }
  async reset(owner:string){
    if(this.running)throw new OptimizationBlocked('训练期间无法切换参数');
    await this.store.mutate(owner,p=>{
      const o=p.state.optimization||{profiles:[]};
      if(o.lastRun?.status==='running'&&Date.now()-o.lastRun.startedAt<75000)throw new OptimizationBlocked('训练期间无法切换参数');
      return {...p.state,schedulerVersion:3,optimization:{...o,active:undefined,resetAt:Date.now()}};
    });
    return this.status(owner);
  }
}
export const optimizer=new Optimizer(fileStore);
