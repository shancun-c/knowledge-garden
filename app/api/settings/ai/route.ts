import { getChatGPTUser, validWriteOrigin } from '../../../chatgpt-auth';
import { aiSettingsInput, aiSettingsStore } from '../../../../lib/ai-settings';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401, headers });
  try { return Response.json(await aiSettingsStore.status(user.userId), { headers }); }
  catch { return Response.json({ error: '无法读取 AI 配置，请检查服务器配置存储' }, { status: 500, headers }); }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401, headers });
  if (!validWriteOrigin(request)) return Response.json({ error: '不允许跨站写入' }, { status: 403, headers });
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return Response.json({ error: '配置内容过长' }, { status: 413, headers });
    input = aiSettingsInput.parse(JSON.parse(raw));
  } catch {
    return Response.json({ error: '请填写有效的模型名称和 API Key（Key 留空可保留原值）' }, { status: 400, headers });
  }
  try { return Response.json(await aiSettingsStore.save(user.userId, input), { headers }); }
  catch { return Response.json({ error: 'AI 配置保存失败，请检查服务器存储后重试' }, { status: 500, headers }); }
}
