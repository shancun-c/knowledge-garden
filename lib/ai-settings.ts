import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

export const aiSettingsInput = z.object({
  model: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/),
  imageModel: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/).optional(),
  apiKey: z.string().trim().max(512).refine(value => !value || /^[\x21-\x7e]{10,512}$/.test(value)).optional(),
}).strict();

type StoredSettings = { model: string; imageModel?:string; apiKey?: string };
type Envelope = { version: 1; iv: string; tag: string; ciphertext: string };
type Defaults = { apiKey?: string; model?: string };

export class AISettingsStore {
  private directory: string;
  private secret: () => string | undefined;
  private defaults: () => Defaults;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(directory: string, secret: () => string | undefined, defaults: () => Defaults = () => ({})) {
    this.directory = directory;
    this.secret = secret;
    this.defaults = defaults;
  }

  private key() {
    const secret = this.secret();
    if (!secret) throw new Error('AI settings encryption is unavailable');
    return createHash('sha256').update(`knowledge-garden:ai-settings:v1:${secret}`).digest();
  }

  private path(owner: string) {
    return join(this.directory, `${createHash('sha256').update(owner).digest('hex')}.json`);
  }

  private async read(owner: string): Promise<StoredSettings | null> {
    let raw: string;
    try { raw = await readFile(this.path(owner), 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    const envelope = JSON.parse(raw) as Envelope;
    if (envelope.version !== 1) throw new Error('Unsupported AI settings version');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(Buffer.from(owner));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
    return aiSettingsInput.parse(JSON.parse(plaintext.toString('utf8')));
  }

  async resolve(owner: string) {
    const stored = await this.read(owner);
    const defaults = this.defaults();
    return {
      apiKey: stored?.apiKey || defaults.apiKey || '',
      imageModel:stored?.imageModel||'gpt-image-1.5',
      model: stored?.model || defaults.model || 'gpt-4.1-mini',
    };
  }

  async status(owner: string) {
    const settings = await this.resolve(owner);
    // Deliberately return no part of the key, even to an authenticated client.
    return { configured: Boolean(settings.apiKey), model: settings.model, imageModel:settings.imageModel };
  }

  save(owner: string, input: z.infer<typeof aiSettingsInput>) {
    const operation = this.pending.then(async () => {
      const parsed = aiSettingsInput.parse(input);
      const existing = await this.read(owner);
      const settings: StoredSettings = { model: parsed.model, imageModel:parsed.imageModel||existing?.imageModel };
      const apiKey = parsed.apiKey || existing?.apiKey;
      if (apiKey) settings.apiKey = apiKey;
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
      cipher.setAAD(Buffer.from(owner));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(settings), 'utf8'), cipher.final()]);
      const envelope: Envelope = { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const temporary = `${this.path(owner)}.${randomUUID()}.tmp`;
      try {
        const file = await open(temporary, 'wx', 0o600);
        try { await file.writeFile(JSON.stringify(envelope)); await file.sync(); }
        finally { await file.close(); }
        await rename(temporary, this.path(owner));
        const directory = await open(this.directory, 'r');
        try { await directory.sync(); } finally { await directory.close(); }
      } finally { await unlink(temporary).catch(() => undefined); }
      return this.status(owner);
    });
    this.pending = operation.catch(() => undefined);
    return operation;
  }
}

export const aiSettingsStore = new AISettingsStore(
  join(process.env.KNOWLEDGE_DATA_DIR || './data', 'ai-settings'),
  () => process.env.KNOWLEDGE_PROXY_SECRET,
  () => ({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL }),
);
