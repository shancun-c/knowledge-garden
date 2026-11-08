'use client';
import { useEffect, useState } from 'react';

type Status = { configured: boolean; model: string; imageModel:string };
export default function AISettingsForm({ onSaved,onDirty }: { onSaved: (configured: boolean) => void;onDirty:(dirty:boolean)=>void }) {
  const [model, setModel] = useState('gpt-4.1-mini');
  const [imageModel,setImageModel]=useState('gpt-image-1.5');
  const [apiKey, setApiKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [dirty,setDirty]=useState(false),[testing,setTesting]=useState('');
  async function testConnection(kind:'text'|'image'){
    if(dirty||saving||testing||!configured)return;
    if(!confirm(kind==='text'?'使用已保存配置测试图片理解与结构化输出，会向 OpenAI 发起一次计费调用。继续？':'使用已保存配置生成一张测试插图，会产生图片调用费用；测试图不加入卡片。继续？'))return;
    setTesting(kind);setError('');setNotice('');
    try{const response=await fetch(kind==='text'?'/api/ai':'/api/illustrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(kind==='text'?{mode:'cards',text:'连接测试。根据图片制作一张简单颜色识别卡片。不需要配图。',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII='}:{front:'连接测试：蓝色圆形是什么形状？',back:'圆形。',prompt:'白底，一个蓝色圆形，无文字。'})});const result=await response.json() as {error?:string;cards?:unknown[];image?:unknown};if(!response.ok)throw Error(result.error||`测试失败（${response.status}）`);if(kind==='text'?!result.cards?.length:!result.image)throw Error('模型未返回有效测试结果');setNotice(kind==='text'?'文字模型测试通过：图片输入与结构化制卡可用。本次测试未保存卡片。':'图片模型测试通过：测试图已生成，未加入知识库卡片。')}catch(e){setError(e instanceof Error?e.message:'连接测试失败')}finally{setTesting('')}
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/settings/ai', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json() as Status & { error?: string };
        if (!response.ok) throw new Error(result.error || '读取配置失败');
        setModel(result.model); setImageModel(result.imageModel); setConfigured(result.configured); setLoaded(true);
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !loaded) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/settings/ai', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, imageModel, apiKey }),
      });
      const result = await response.json() as Status & { error?: string };
      if (!response.ok) throw new Error(result.error || '保存失败');
      setApiKey(''); setModel(result.model); setImageModel(result.imageModel); setConfigured(result.configured); onSaved(result.configured);
      onDirty(false);setDirty(false);setNotice(result.configured ? '配置已保存，截图制卡和知识关联将立即使用此配置。' : '模型已保存；填写 API Key 后即可使用 AI 功能。');
    } catch (error) { setError(error instanceof Error ? error.message : '保存失败，请重试'); }
    finally { setSaving(false); }
  }

  return <div className="setting-block">
    <h3>OpenAI 连接</h3>
    <p>{loading ? '正在读取配置…' : configured ? 'API Key 已配置' : '尚未配置 API Key'}</p>
    <form onSubmit={submit}>
      <label>OpenAI API Key
        <input type="password" autoComplete="new-password" spellCheck={false} maxLength={512}
          disabled={loading || saving || !!testing || !loaded} value={apiKey}
          onChange={event => { onDirty(true);setDirty(true); setApiKey(event.target.value); setNotice(''); }}
          placeholder={configured ? '已保存，留空保持不变；输入新 Key 可替换' : '粘贴你的 OpenAI API Key'} />
      </label>
      <label>模型名称
        <input required maxLength={120} autoComplete="off" spellCheck={false}
          disabled={loading || saving || !!testing || !loaded} value={model}
          onChange={event => { onDirty(true);setDirty(true); setModel(event.target.value); setNotice(''); }} placeholder="例如：gpt-4.1-mini" />
      </label>
<label>图片生成模型<input required value={imageModel} maxLength={120} disabled={loading||saving||!!testing||!loaded} onChange={e=>{onDirty(true);setDirty(true);setImageModel(e.target.value)}} placeholder="gpt-image-1.5"/></label><p className="hint">普通插图使用此模型；已支持的经济曲线由文字模型核对条件后生成 SVG，不调用图片模型。两条路径均可能产生模型调用费用。</p>
      <p className="hint">填写你有权限使用、支持图片理解和结构化输出的 OpenAI 模型。Key 加密保存在服务器，页面不会回显；此配置同时用于截图制卡与知识关联。</p>
      <button type="submit" className="primary full" disabled={loading || saving || !!testing || !loaded || !model.trim() || (!configured && !apiKey.trim())}>
        {saving ? '正在保存…' : '保存 AI 配置'}
      </button>
      <div className="connection-tests"><button type="button" className="secondary" disabled={!loaded||!configured||dirty||saving||!!testing} onClick={()=>testConnection('text')}>测试文字模型</button><button type="button" className="secondary" disabled={!loaded||!configured||dirty||saving||!!testing} onClick={()=>testConnection('image')}>测试图片模型</button></div><p className="hint">{testing?'正在发起测试调用，请稍候…':dirty?'请先保存配置，再测试连接。':'测试会产生模型调用费用，仅在你确认后执行。'}</p>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {notice && <p className="settings-success" role="status">{notice}</p>}
      <p className="hint">保存不会发起模型调用；Key、模型权限与额度将在使用 AI 功能时验证。</p>
    </form>
  </div>;
}
