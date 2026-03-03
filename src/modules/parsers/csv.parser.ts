import { CanonicalModel } from '../../shared/types/canonical.types.js';
import { mapTabularRowsToCanonical, normalizeHeader, TabularRow } from './tabular.utils.js';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}

function parseCsvRows(input: string): TabularRow[] {
  const lines = input.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows: TabularRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: TabularRow = {};
    headers.forEach((header, index) => {
      const value = values[index];
      if (value !== undefined) row[header] = value.trim();
    });
    rows.push(row);
  }

  return rows;
}

export function parseCsv(input: string): CanonicalModel {
  const rows = parseCsvRows(input);
  if (rows.length === 0) {
    throw new Error('CSV input is empty or missing rows');
  }
  return mapTabularRowsToCanonical(rows, 'CSV');
}
