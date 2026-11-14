export type IllustrationPhase = 'settings' | 'generation' | 'saving';
export type IllustrationErrorCode = 'ACCOUNT_DEACTIVATED' | 'INVALID_API_KEY' | 'MODEL_ACCESS_DENIED' | 'QUOTA_EXCEEDED' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'GENERATION_INCOMPLETE' | 'INVALID_DIAGRAM' | 'GENERATION_TIMEOUT' | 'SETTINGS_FAILED' | 'SAVE_FAILED' | 'GENERATION_FAILED';

const messages: Record<IllustrationErrorCode, string> = {
  ACCOUNT_DEACTIVATED: '模型服务账户已停用，无法生成配图。请联系服务商恢复账户，或在 AI 设置中更换有效账户的 API Key。',
  INVALID_API_KEY: '模型服务认证失败。请在 AI 设置中检查或更换 API Key。',
  MODEL_ACCESS_DENIED: '当前账户无法使用所选模型。请检查 AI 设置中的模型名称及账户权限。',
  QUOTA_EXCEEDED: '模型服务额度不足。请检查账户余额或用量限制。',
  RATE_LIMITED: '模型服务请求过于频繁，请稍后再试。',
  PROVIDER_UNAVAILABLE: '模型服务暂时不可用，请稍后再试。',
  GENERATION_INCOMPLETE: '模型未完成配图生成，请稍后重试或调整模型。',
  INVALID_DIAGRAM: '模型返回的图示未通过格式或坐标校验，未保存配图，请重新生成。',
  GENERATION_TIMEOUT: '模型生成配图超时，请稍后再试。',
  SETTINGS_FAILED: '无法读取 AI 设置，请检查服务配置。',
  SAVE_FAILED: '配图已生成，但保存失败，请稍后再试。',
  GENERATION_FAILED: '配图生成失败，请稍后再试；若持续失败，请检查模型服务状态。',
};

export class IllustrationError extends Error {
  readonly code: IllustrationErrorCode;
  readonly providerStatus?: number;
  constructor(code: IllustrationErrorCode, providerStatus?: number) {
    super(messages[code]);
    this.name = 'IllustrationError';
    this.code = code;
    this.providerStatus = providerStatus;
  }
}

// Provider messages may contain credentials or request content. Only classify known codes;
// never forward or log the raw provider response, message, or exception stack.
export async function illustrationProviderError(response: Response): Promise<IllustrationError> {
  let code: unknown;
  try { const body = await response.json() as {error?: {code?: unknown}} | null; code = body?.error?.code; } catch { /* HTML/empty provider error */ }
  const status = response.status;
  if (code === 'account_deactivated') return new IllustrationError('ACCOUNT_DEACTIVATED', status);
  if (code === 'invalid_api_key' || status === 401) return new IllustrationError('INVALID_API_KEY', status);
  if (code === 'insufficient_quota' || code === 'billing_hard_limit_reached') return new IllustrationError('QUOTA_EXCEEDED', status);
  if (status === 429) return new IllustrationError('RATE_LIMITED', status);
  if (status === 403 || status === 404 || code === 'model_not_found') return new IllustrationError('MODEL_ACCESS_DENIED', status);
  return new IllustrationError('PROVIDER_UNAVAILABLE', status);
}

export function illustrationFailure(error: unknown, phase: IllustrationPhase) {
  const known = error instanceof IllustrationError ? error : new IllustrationError(
    phase === 'saving' ? 'SAVE_FAILED' : phase === 'settings' ? 'SETTINGS_FAILED' :
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError') ? 'GENERATION_TIMEOUT' : 'GENERATION_FAILED',
  );
  return {
    status: known.code === 'GENERATION_TIMEOUT' ? 504 : known.code === 'SAVE_FAILED' || known.code === 'SETTINGS_FAILED' ? 500 : 502,
    body: { error: `${known.message}文字内容已保留。`, code: known.code },
    diagnostic: { code: known.code, phase, ...(known.providerStatus === undefined ? {} : { providerStatus: known.providerStatus }) },
  };
}
