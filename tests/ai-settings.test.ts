import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, stat, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AISettingsStore, aiSettingsInput } from '../lib/ai-settings.ts';

async function temporary(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'knowledge-ai-test-'));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test('encrypted settings persist, isolate owners, and never expose key in status', () => temporary(async directory => {
  const store = new AISettingsStore(directory, () => 'test-encryption-secret');
  assert.deepEqual(await store.status('owner'), { imageModel:'gpt-image-1.5', configured: false, model: 'gpt-4.1-mini' });
  const key = 'test-only-key-not-a-real-credential';
  const status = await store.save('owner', { apiKey: key, model: 'test-model' });
  assert.deepEqual(status, { imageModel:'gpt-image-1.5', configured: true, model: 'test-model' });
  assert.ok(!JSON.stringify(status).includes(key));
  const path = join(directory, (await readdir(directory))[0]);
  assert.ok(!(await readFile(path, 'utf8')).includes(key));
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.deepEqual(await new AISettingsStore(directory, () => 'test-encryption-secret').resolve('owner'), { imageModel:'gpt-image-1.5', apiKey: key, model: 'test-model' });
  assert.equal((await store.status('other')).configured, false);
  await store.save('owner', { apiKey: '', model: 'another-model' });
  assert.deepEqual(await store.resolve('owner'), { imageModel:'gpt-image-1.5', apiKey: key, model: 'another-model' });
  await store.save('owner', { apiKey: 'test-replacement-key', model: 'another-model' });
  assert.equal((await store.resolve('owner')).apiKey, 'test-replacement-key');
}));

test('environment fallback, model-only changes and serialized updates', () => temporary(async directory => {
  const store = new AISettingsStore(directory, () => 'secret', () => ({ apiKey: 'environment-test-key', model: 'environment-model' }));
  assert.deepEqual(await store.resolve('owner'), { imageModel:'gpt-image-1.5', apiKey: 'environment-test-key', model: 'environment-model' });
  await store.save('owner', { model: 'custom-model' });
  assert.deepEqual(await store.resolve('owner'), { imageModel:'gpt-image-1.5', apiKey: 'environment-test-key', model: 'custom-model' });
  await Promise.all([store.save('owner', { model: 'first-model', apiKey: 'saved-test-key' }), store.save('owner', { model: 'second-model', apiKey: '' })]);
  assert.deepEqual(await store.resolve('owner'), { imageModel:'gpt-image-1.5', apiKey: 'saved-test-key', model: 'second-model' });
}));

test('tampered ciphertext and changed encryption secret fail closed', () => temporary(async directory => {
  const store = new AISettingsStore(directory, () => 'original-secret');
  await store.save('owner', { apiKey: 'test-only-key', model: 'test-model' });
  await assert.rejects(new AISettingsStore(directory, () => 'changed-secret').resolve('owner'));
  const path = join(directory, (await readdir(directory))[0]);
  const envelope = JSON.parse(await readFile(path, 'utf8'));
  envelope.tag = Buffer.alloc(16).toString('base64');
  await writeFile(path, JSON.stringify(envelope));
  await assert.rejects(store.resolve('owner'));
  await assert.rejects(new AISettingsStore(directory, () => undefined).save('new', { model: 'model' }));
}));

test('settings validation rejects invalid model, whitespace keys and unknown fields', () => {
  assert.equal(aiSettingsInput.safeParse({ model: 'gpt-4.1-mini', apiKey: '' }).success, true);
  assert.equal(aiSettingsInput.safeParse({ model: '', apiKey: 'test-key-value' }).success, false);
  assert.equal(aiSettingsInput.safeParse({ model: 'model', apiKey: 'key with spaces' }).success, false);
  assert.equal(aiSettingsInput.safeParse({ model: 'model', apiKey: 'a'.repeat(513) }).success, false);
  assert.equal(aiSettingsInput.safeParse({ model: 'model', apiKey: 'test-key-value', baseUrl: 'https://example.test' }).success, false);
});
