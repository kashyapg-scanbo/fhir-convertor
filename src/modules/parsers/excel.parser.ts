import { CanonicalModel } from '../../shared/types/canonical.types.js';
import { mapTabularRowsToCanonical, normalizeHeader, TabularRow } from './tabular.utils.js';
import * as XLSX from 'xlsx';

export function parseExcel(input: string): CanonicalModel {
  if (!input) {
    throw new Error('Excel input is empty');
  }

  const workbook = XLSX.read(input, { type: 'base64' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Excel input has no sheets');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Array<Record<string, string | number>>;

  const rows: TabularRow[] = rawRows.map((raw) => {
    const row: TabularRow = {};
    Object.entries(raw).forEach(([key, value]) => {
      const normalized = normalizeHeader(String(key));
      row[normalized] = String(value ?? '').trim();
    });
    return row;
  }).filter(row => Object.values(row).some(v => v !== ''));

  if (rows.length === 0) {
    throw new Error('Excel input has no data rows');
  }

  return mapTabularRowsToCanonical(rows, 'XLSX');
}
