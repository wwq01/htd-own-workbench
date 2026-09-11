/**
 * 字段裁剪工具（V1.5 性能优化）
 * 列表接口支持 ?fields=id,title,status 仅返回指定字段，降低响应体量。
 * 用法：service.list 解析 query.fields 后，对 toPublic 后的数组做 pickFields。
 */
export function parseFieldsParam(fields) {
  if (!fields || typeof fields !== 'string') return null;
  const arr = fields
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? arr : null;
}

export function pickFields(rows, fields) {
  if (!Array.isArray(rows)) return rows;
  if (!Array.isArray(fields) || !fields.length) return rows;
  return rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    const out = {};
    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(row, f)) out[f] = row[f];
    }
    return out;
  });
}
