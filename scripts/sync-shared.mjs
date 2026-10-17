import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isCheckMode = process.argv.includes('--check');

const targets = [
  {
    source: path.join(rootDir, 'shared/logic/boundedBody.ts'),
    destinations: [
      path.join(rootDir, 'frontend/src/logic/boundedBody.ts'),
      path.join(rootDir, 'backend/src/logic/boundedBody.ts'),
    ],
  },
];

let hasDrift = false;

for (const { source, destinations } of targets) {
  if (!fs.existsSync(source)) {
    console.error(`[sync-shared] Canonical source file not found: ${source}`);
    process.exit(1);
  }

  const canonicalContent = fs.readFileSync(source, 'utf8');

  for (const dest of destinations) {
    const destExists = fs.existsSync(dest);
    const destContent = destExists ? fs.readFileSync(dest, 'utf8') : null;

    if (destContent !== canonicalContent) {
      if (isCheckMode) {
        console.error(`[sync-shared] Drift detected: ${path.relative(rootDir, dest)} differs from canonical ${path.relative(rootDir, source)}`);
        hasDrift = true;
      } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, canonicalContent, 'utf8');
        console.log(`[sync-shared] Synced ${path.relative(rootDir, source)} -> ${path.relative(rootDir, dest)}`);
      }
    }
  }
}

if (isCheckMode) {
  if (hasDrift) {
    console.error('[sync-shared] Files are out of sync. Run "node scripts/sync-shared.mjs" to synchronize.');
    process.exit(1);
  }
  console.log('[sync-shared] All shared files are in sync.');
} else {
  console.log('[sync-shared] Shared files synchronization complete.');
}
