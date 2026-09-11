import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

const schemaPath = path.resolve('prisma/schema.prisma');
const outputPath = path.resolve('prisma/template.db');
const schema = fs.readFileSync(schemaPath, 'utf8');
const SQL = await initSqlJs({
  locateFile: (file) => path.resolve('node_modules/sql.js/dist', file),
});
const db = new SQL.Database();
const scalarTypes = new Set(['String', 'Int', 'Boolean', 'DateTime', 'Float', 'Decimal', 'Json', 'BigInt']);

for (const block of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
  const [, modelName, body] = block;
  const mapped = body.match(/@@map\("([^"]+)"\)/)?.[1] ?? modelName;
  const columns = [];

  for (const line of body.split('\n')) {
    const match = line.match(/^\s{2}(\w+)\s+(\w+)(\?)?/);
    if (!match || !scalarTypes.has(match[2])) continue;
    const [, name, type] = match;
    const isUnique = /@unique/.test(line);
    const sqlType = type === 'DateTime' ? 'BIGINT'
      : type === 'Int' || type === 'BigInt' || type === 'Boolean' ? 'INTEGER'
      : type === 'Float' || type === 'Decimal' ? 'REAL' : 'TEXT';
    let col = `"${name}" ${sqlType}`;
    if (name === 'id') col += ' PRIMARY KEY';
    else if (isUnique) col += ' UNIQUE';
    columns.push(col);
  }

  if (columns.length) db.run(`CREATE TABLE IF NOT EXISTS "${mapped}" (${columns.join(', ')});`);
}

fs.writeFileSync(outputPath, Buffer.from(db.export()));
console.log(`Template database created: ${outputPath}`);
