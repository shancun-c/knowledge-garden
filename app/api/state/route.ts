import {createHash} from 'node:crypto';
import {changesSchema,InvalidStateChanges} from '../../../lib/state-changes';
import {NewCardLimitExceeded} from '../../../lib/study-plan';
import { getChatGPTUser, validWriteOrigin } from '../../chatgpt-auth';
import { stateSchema } from '../../../lib/model';
import { fileStore, RevisionConflict, SchedulerVersionConflict } from '../../../lib/file-store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  try {
    return Response.json({...await fileStore.read(user.userId),draftScope:createHash('sha256').update(user.userId).digest('hex')}, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: '知识库读取失败，请联系管理员检查存储' }, { status: 500 });
  }
}

export async function PUT(request: Request) { return saveState(request,false); }
export async function PATCH(request: Request) { return saveState(request,true); }

async function saveState(request:Request, incremental:boolean) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  if (!validWriteOrigin(request)) return Response.json({ error: '不允许跨站写入' }, { status: 403 });
  let body;
  try {
    const text = await request.text();
    if (text.length > 4000000) return Response.json({ error: '数据超过容量限制' }, { status: 413 });
    body = JSON.parse(text);
    if(incremental)body.changes=changesSchema.parse(body.changes);
    else body.state = stateSchema.parse(body.state);
    if((incremental?body.changes.schedulerVersion:body.state.schedulerVersion)!==3)return Response.json({error:'学习算法已升级，请刷新页面后重试。'},{status:409});
    if (!Number.isSafeInteger(body.revision) || body.revision < 0) throw new Error();
  } catch {
    return Response.json({ error: '数据格式无效，未保存' }, { status: 400 });
  }
  try {
    const started=performance.now();
    const result=incremental?await fileStore.writeChanges(user.userId,body.changes,body.revision):await fileStore.writeSnapshot(user.userId,body.state,body.revision);
    return Response.json({revision:result.revision,studySettings:result.state.studySettings,studyDay:result.state.studyDay},{headers:{'Server-Timing':`persist;dur=${(performance.now()-started).toFixed(1)}`}});
  } catch (error) {
    return Response.json({ error: error instanceof InvalidStateChanges ? error.message : error instanceof NewCardLimitExceeded ? error.message : error instanceof SchedulerVersionConflict ? '学习算法已升级，请刷新页面后重试。' : error instanceof RevisionConflict
      ? '其他窗口已更新数据，请刷新后重试。'
      : '写入失败，未确认保存，请检查服务器存储后重试。' },
    { status: error instanceof InvalidStateChanges ? 400 : error instanceof NewCardLimitExceeded || error instanceof RevisionConflict || error instanceof SchedulerVersionConflict ? 409 : 500 });
  }
}
