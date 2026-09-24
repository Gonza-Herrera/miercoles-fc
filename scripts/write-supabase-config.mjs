import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const outputPath = resolve(
  process.cwd(),
  process.env['SUPABASE_CONFIG_OUTPUT'] ?? 'public/config/supabase-config.json',
);
const url = process.env['SUPABASE_URL']?.trim();
const publishableKey = process.env['SUPABASE_PUBLISHABLE_KEY']?.trim();

if (!url || !publishableKey) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required to generate the browser configuration.',
  );
}

const parsedUrl = new URL(url);
const isLocalhost = ['localhost', '127.0.0.1'].includes(parsedUrl.hostname);

if (parsedUrl.protocol !== 'https:' && !isLocalhost) {
  throw new Error('SUPABASE_URL must use HTTPS unless it targets local development.');
}

if (!publishableKey.startsWith('sb_publishable_')) {
  throw new Error('SUPABASE_PUBLISHABLE_KEY must be a public sb_publishable_ key.');
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ url: parsedUrl.origin, publishableKey }, null, 2)}\n`,
  { mode: 0o600 },
);

console.log(`Supabase browser configuration written to ${outputPath}`);
