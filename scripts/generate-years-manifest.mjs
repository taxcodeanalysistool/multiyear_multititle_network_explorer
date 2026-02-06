import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');

// Find all year-*.json files
const files = fs.readdirSync(publicDir);

const years = [];
const processedYears = new Set();

for (const file of files) {
  // Match year-YYYY.json
  const yearMatch = file.match(/^year-(\d{4})\.json$/);
  if (yearMatch) {
    const year = yearMatch[1];
    if (!processedYears.has(year)) {
      years.push({
        id: year,
        kind: 'single',
        file: file,
        label: year
      });
      processedYears.add(year);
    }
    continue;
  }

  // Match year-YYYY.meta.json (split files)
  const metaMatch = file.match(/^year-(\d{4})\.meta\.json$/);
  if (metaMatch) {
    const year = metaMatch[1];
    if (!processedYears.has(year)) {
      years.push({
        id: year,
        kind: 'split',
        meta: file,
        label: year
      });
      processedYears.add(year);
    }
  }
}

// Sort by year
years.sort((a, b) => a.id.localeCompare(b.id));

const manifest = {
  version: 1,
  years: years
};

const manifestPath = path.join(publicDir, 'years-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`Wrote ${manifestPath} with ${years.length} years`);
