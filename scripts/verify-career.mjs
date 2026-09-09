import { readFile } from 'node:fs/promises';
import { verifyBundle } from '../server/verify.mjs';
import { json } from '../server/protocol.mjs';

try {
  if (!process.argv[2]) throw new Error('Usage: npm run verify:career -- path/to/evidence.json');
  const bytes = await readFile(process.argv[2]);
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Evidence bundle exceeds 2 MB');
  const bundle = JSON.parse(bytes.toString('utf8'));
  if (bundle.schema !== '0g-career-bundle-v1') throw new Error('Unsupported evidence bundle');
  const result = await verifyBundle(bundle);
  console.log(json(result));
  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  console.error(json({ ok: false, error: error.shortMessage || error.message }));
  process.exitCode = 1;
}
