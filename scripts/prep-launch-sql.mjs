import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, '.launch-sections');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

function prep(sql) {
  sql = sql.replace(
    /ALTER PUBLICATION supabase_realtime ADD TABLE ([^;]+);/gi,
    'do $$$$ begin ALTER PUBLICATION supabase_realtime ADD TABLE $1; exception when duplicate_object then null; end $$$$;'
  );
  sql = sql.replace(
    /^CREATE POLICY "([^"]+)"\s*\n\s*ON ([^\n]+)/gm,
    (m, name, rest) => {
      const table = rest.trim().split(/\s/)[0];
      return `DROP POLICY IF EXISTS "${name}" ON ${table};\nCREATE POLICY "${name}"\n  ON ${rest}`;
    }
  );
  sql = sql.replace(
    /^CREATE TRIGGER ([^\n]+)$/gm,
    (m, rest) => {
      const name = rest.trim().split(/\s/)[0];
      const tableMatch = rest.match(/ON ([^\s]+)/i);
      if (tableMatch) {
        return `DROP TRIGGER IF EXISTS ${name} ON ${tableMatch[1]};\nCREATE TRIGGER ${rest}`;
      }
      return m;
    }
  );
  return sql;
}

const start = Number(process.argv[2] || 1);
const end = Number(process.argv[3] || 49);

for (const s of manifest.filter((x) => x.i >= start && x.i <= end)) {
  const file = path.join(root, s.file.replace(/\\/g, '/'));
  const sql = prep(fs.readFileSync(file, 'utf8'));
  const out = path.join(dir, `_prepped_${String(s.i).padStart(2, '0')}.sql`);
  fs.writeFileSync(out, sql);
  console.log(`prepped ${s.i}: ${s.title} (${sql.length} bytes)`);
}
