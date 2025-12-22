export function cleanResource<T>(obj: T): T | undefined {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    const cleanedArray = obj
      .map(item => cleanResource(item))
      .filter(item => item !== undefined);
    return cleanedArray.length > 0 ? cleanedArray as T : undefined;
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleaned = cleanResource(value);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return Object.keys(result).length > 0 ? result as T : undefined;
  }
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    return trimmed === '' ? undefined : trimmed as T;
  }
  return obj;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function makeNarrative(resourceType: string, summary?: string) {
  if (!summary?.trim()) return undefined;
  const safe = escapeHtml(summary.trim());
  const safeResourceType = escapeHtml(resourceType);
  return {
    status: 'generated',
    div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${safeResourceType}: ${safe}</p></div>`
  };
}

export function mapAbnormalFlag(flag: string): string {
  const flagUpper = flag?.toUpperCase() ?? '';
  const flagMap: Record<string, string> = {
    'L': 'Low',
    'LL': 'Critical Low',
    'H': 'High',
    'HH': 'Critical High',
    'A': 'Abnormal',
    'AA': 'Critical Abnormal',
    'N': 'Normal',
    'S': 'Susceptible',
    'R': 'Resistant',
    'I': 'Intermediate'
  };
  return flagMap[flagUpper] || flag;
}
