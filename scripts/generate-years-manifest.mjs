import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');
const files = fs.readdirSync(publicDir);

// Map: titleId -> Map(timeScope -> { kind, file/meta })
const titleMap = new Map();

const ensure = (id) => {
  if (!titleMap.has(id)) titleMap.set(id, new Map());
  return titleMap.get(id);
};

for (const f of files) {
  // Skip part files from splits
  if (f.includes('.part-')) continue;

  // Single: title-26-time-2025.json
  const singleMatch = f.match(/^title-([\w]+)-time-(\w+)\.json$/i);
  if (singleMatch) {
    const [, id, scope] = singleMatch;
    ensure(id).set(scope, { kind: 'single', file: f });
    continue;
  }

  // Split meta: title-42-time-2025.meta.json
  const metaMatch = f.match(/^title-([\w]+)-time-(\w+)\.meta\.json$/i);
  if (metaMatch) {
    const [, id, scope] = metaMatch;
    ensure(id).set(scope, { kind: 'split', meta: f });
  }
}

// Sort: numeric first, then appendix (5a, 11a, etc.)
const sortedIds = [...titleMap.keys()].sort((a, b) => {
  const numA = parseInt(a);
  const numB = parseInt(b);
  if (numA !== numB) return numA - numB;
  return a.localeCompare(b);
});

const titles = sortedIds.map((id) => {
  const scopes = titleMap.get(id);
  const sortedScopes = [...scopes.keys()].sort();

  // Build per-scope file/meta lookup
  const scopeFiles = {};
  const scopeMetas = {};
  let dominantKind = 'single';

  for (const [scope, entry] of scopes.entries()) {
    if (entry.kind === 'split') {
      scopeMetas[scope] = entry.meta;
      dominantKind = 'split';
    } else {
      scopeFiles[scope] = entry.file;
    }
  }

  return {
    id,
    kind: dominantKind,
    timeScopes: sortedScopes,
    ...(dominantKind === 'split'
      ? { meta: scopeMetas }
      : { file: scopeFiles }),
  };
});

const manifest = { version: 2, titles };

const manifestPath = path.join(publicDir, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`Wrote ${manifestPath} with ${titles.length} titles`);
titles.forEach((t) => {
  console.log(`  Title ${t.id} (${t.kind}): ${t.timeScopes.join(', ')}`);
});
