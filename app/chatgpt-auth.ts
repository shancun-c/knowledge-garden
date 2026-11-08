import { timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';

// Self-hosted identity comes only from the authenticated loopback reverse proxy.
// Never trust the former Sites identity headers sent by a public client.
export async function getChatGPTUser() {
  const requestHeaders = await headers();
  const expected = process.env.KNOWLEDGE_PROXY_SECRET;
  const actual = requestHeaders.get('x-knowledge-proxy-secret');
  const owner = requestHeaders.get('x-knowledge-user');
  if (!expected || !actual || !owner) return null;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { userId: owner, displayName: owner };
}

export function validWriteOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === process.env.KNOWLEDGE_ORIGIN;
}
