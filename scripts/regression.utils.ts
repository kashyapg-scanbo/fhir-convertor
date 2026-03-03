import path from 'path';

export function getFormatForFile(filePath: string, inputRoot: string): string | undefined {
  const rel = path.relative(inputRoot, filePath);
  const parts = rel.split(path.sep);
  const folder = parts[0];
  if (folder === 'hl7v2') return 'hl7v2';
  if (folder === 'hl7v3') return 'hl7v3';
  if (folder === 'cda' || folder === 'ccda') return 'cda';

  const lower = filePath.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.xls')) return 'xls';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.hl7')) return 'hl7v2';
  if (lower.endsWith('.xml')) return 'cda';
  return undefined;
}

export function normalizeBundle(bundle: any): any {
  if (!bundle || typeof bundle !== 'object') return bundle;
  const clone = structuredClone(bundle);

  if (clone.timestamp) delete clone.timestamp;
  if (clone.meta && clone.meta.versionId) delete clone.meta.versionId;

  if (Array.isArray(clone.entry)) {
    clone.entry = clone.entry.map((entry: any) => {
      const normalized = entry ? { ...entry } : entry;
      if (normalized?.fullUrl) delete normalized.fullUrl;
      if (normalized?.resource && typeof normalized.resource === 'object') {
        if (normalized.resource.id) delete normalized.resource.id;
      }
      return normalized;
    });
  }

  return normalizeDynamicStrings(clone);
}

export function normalizeDynamicStrings(value: any): any {
  if (Array.isArray(value)) {
    return value.map(item => normalizeDynamicStrings(item));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = normalizeDynamicStrings(val);
    }
    return result;
  }
  if (typeof value === 'string') {
    if (value.startsWith('urn:uuid:')) return 'urn:uuid:REDACTED';
  }
  return value;
}

export function stableStringify(value: any): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: any): any {
  if (Array.isArray(value)) {
    return value.map(item => sortKeys(item));
  }
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeys(value[key]);
    }
    return sorted;
  }
  return value;
}
