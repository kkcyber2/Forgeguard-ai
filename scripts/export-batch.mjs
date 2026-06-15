import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, '.launch-sections');
const start = Number(process.argv[2] || 5);
const end = Number(process.argv[3] || 49);

const results = [];
for (let i = start; i <= end; i++) {
  const file = path.join(dir, `_prepped_${String(i).padStart(2, '0')}.sql`);
  if (!fs.existsSync(file)) {
    results.push({ i, error: 'missing prepped file' });
    continue;
  }
  results.push({ i, file, sql: fs.readFileSync(file, 'utf8') });
}
fs.writeFileSync(path.join(dir, '_batch.json'), JSON.stringify(results));
console.log(`wrote ${results.length} sections to _batch.json`);
