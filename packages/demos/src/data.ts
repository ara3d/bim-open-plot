// Reading a demo's data files: in a browser by URL, in a test from disk.
// The Duplex extracts under public/data/duplex are newline-delimited JSON
// from ifc_sql_export (one object per line); bounds.json is one object.

import type { Row } from './chart';

/** Text by URL (browser) or path (Node). */
export const loadText = async (url: string): Promise<string> => {
  // In a browser every path is fetched: a site-absolute one (/data/...), a demo's own
  // relative one (./data/...), which resolves against the demo page, or a full URL.
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.text();
  }
  const { readFile } = await import('node:fs/promises');
  return readFile(url, 'utf8');
};

/** One JSON document by URL or path. */
export const loadJson = async <T = unknown>(url: string): Promise<T> => JSON.parse(await loadText(url)) as T;

/** A table stored as newline-delimited JSON objects (the ifc_sql_export shape), or as a JSON array of objects. */
export const loadTable = async (url: string): Promise<Row[]> => {
  const text = (await loadText(url)).trim();
  if (text === '') return [];
  if (text.startsWith('[')) return JSON.parse(text) as Row[];
  return text.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as Row);
};

/** The shape of a columnar table: column names and rows as arrays. */
export interface ColumnarTable {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly (string | number | boolean | null)[])[];
}

/** Row objects from a columnar table. */
export const records = (table: ColumnarTable): Row[] =>
  table.rows.map((r) => Object.fromEntries(table.columns.map((c, i) => [c, r[i] ?? null])));

/** A CSV with a header row into row objects; numbers are parsed, empty cells become null. */
export const parseCsv = (text: string): Row[] => {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(header.map((h, i) => [h, cell(cells[i])]));
  });
};

/** A CSV file by URL or path. */
export const loadCsv = async (url: string): Promise<Row[]> => parseCsv(await loadText(url));

const cell = (s: string | undefined): string | number | null => {
  if (s === undefined || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && s.trim() !== '' ? n : s;
};

const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
};

/**
 * Pivot parameters.json rows (EntityIndex, Name, ValueType, Value) into one
 * object per element: { [Name]: value }. Numbers are parsed when ValueType
 * is 'Number'; `pick` keeps only those parameter names.
 */
export const parametersByElement = (
  rows: readonly Row[],
  pick?: readonly string[],
): Map<number, Record<string, string | number | null>> => {
  const wanted = pick ? new Set(pick) : undefined;
  const out = new Map<number, Record<string, string | number | null>>();
  for (const r of rows) {
    const name = String(r.Name);
    if (wanted && !wanted.has(name)) continue;
    const id = Number(r.EntityIndex);
    const entry = out.get(id) ?? {};
    const raw = r.Value;
    const num = r.ValueType === 'Number' && raw !== null && raw !== undefined ? Number(raw) : null;
    entry[name] = num !== null && Number.isFinite(num) ? num : raw === null || raw === undefined ? null : String(raw);
    out.set(id, entry);
  }
  return out;
};

/** The bounds.json shape: the model box and one box per element (STEP id, IFC class, name). */
export interface Box3 {
  readonly min: { x: number; y: number; z: number };
  readonly max: { x: number; y: number; z: number };
  readonly center: { x: number; y: number; z: number };
  readonly size: { x: number; y: number; z: number };
}
export interface ElementBounds {
  readonly id: number;
  readonly type: string;
  readonly name: string;
  readonly bounds: Box3;
}
export interface BoundsFile {
  readonly model: Box3;
  readonly elements: readonly ElementBounds[];
}
