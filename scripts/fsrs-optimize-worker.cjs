// Isolated native training process. Input contains only ratings and day deltas, no card text.
const {FSRSBinding,FSRSBindingItem,FSRSBindingReview,computeParameters}=require('@open-spaced-repetition/binding');
const {generatorParameters}=require('ts-fsrs');
let raw='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{raw+=s;if(raw.length>50000000)process.exit(2)});
process.stdin.on('end',async()=>{
 try{
  const input=JSON.parse(raw);
  const convert=items=>items.map(i=>new FSRSBindingItem(i.reviews.map(r=>new FSRSBindingReview(r.rating,r.deltaT))));
  const train=convert(input.train),validation=convert(input.validation);
  const defaults=generatorParameters({relearning_steps:['10m']}).w;
  const defaultMetrics=new FSRSBinding([...defaults]).evaluate(validation);
  const currentMetrics=new FSRSBinding(input.weights||[...defaults]).evaluate(validation);
  const candidate=await computeParameters(train,{enableShortTerm:true,numRelearningSteps:1,
   trainingConfig:{numEpochs:5,batchSize:256,seed:20261031,maxSeqLen:200,learningRate:0.04,gamma:1},timeout:100});
  // Evaluate exactly the clipped parameters used by the scheduler.
  const weights=generatorParameters({w:candidate,enable_short_term:true,relearning_steps:['10m']}).w;
  const candidateMetrics=new FSRSBinding([...weights]).evaluate(validation);
  process.stdout.write(JSON.stringify({weights,defaultMetrics,currentMetrics,candidateMetrics}));
 }catch{process.stdout.write(JSON.stringify({error:'参数训练或验证失败；可能是过滤后数据不足，请积累更多真实复习记录后重试。'}));process.exitCode=1}
});
