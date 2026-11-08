import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {z} from 'zod';
import {metricsSchema,weightsSchema} from './fsrs-personalization.ts';
import type {TrainingItem} from './fsrs-training-data.ts';
export const trainingResultSchema=z.object({weights:weightsSchema,defaultMetrics:metricsSchema,currentMetrics:metricsSchema,candidateMetrics:metricsSchema});
export type TrainingResult=z.infer<typeof trainingResultSchema>;
export async function runTraining(input:{train:TrainingItem[];validation:TrainingItem[];weights?:number[]}):Promise<TrainingResult>{
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--max-old-space-size=256',join(process.cwd(),'scripts/fsrs-optimize-worker.cjs')],{
      stdio:['pipe','pipe','pipe'],env:{NODE_ENV:process.env.NODE_ENV||'production',PATH:process.env.PATH,RAYON_NUM_THREADS:'1',OMP_NUM_THREADS:'1'},
    });
    let output='',settled=false;
    const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else{try{resolve(trainingResultSchema.parse(JSON.parse(output)))}catch{reject(new Error('训练结果无效，已保留原参数'))}}};
    const timer=setTimeout(()=>{child.kill('SIGKILL');finish(new Error('训练超过 60 秒，已停止并保留原参数，请稍后重试'))},60000);
    child.stdout.on('data',chunk=>{output+=chunk;if(output.length>100000){child.kill('SIGKILL');finish(new Error('训练输出异常，已保留原参数'))}});
    child.stderr.resume(); // Native diagnostics contain no user-facing recovery instructions.
    child.on('error',()=>finish(new Error('训练进程无法启动，已保留原参数')));
    child.on('close',code=>finish(code===0?undefined:new Error('训练或验证失败，已保留原参数；请积累更多数据后重试')));
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify(input));
  });
}
