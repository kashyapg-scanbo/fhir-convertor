// export function parseHL7(input: string) {
//   const segments: Record<string, string[][]> = {};
//   for (const line of input.split('\n')) {
//     const [seg, ...fields] = line.trim().split('|');
//     if (!segments[seg]) segments[seg] = [];
//     segments[seg].push(...fields.map(f => f.split('~')));
//   }
//   return segments;
// }


import { HL7Message } from '../../shared/types/hl7.types.js';

export function parseHL7(input: string): HL7Message {
  const segments: HL7Message = {};

  for (const line of input.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const [seg, ...fields] = trimmed.split('|');

    if (!segments[seg]) segments[seg] = [];

    const parsedFields = fields.map(field =>
      field
        .split('~')              // repetitions
        .map(rep => rep.split('^')) // components
    );

    segments[seg].push(parsedFields);
  }

  return segments;
}
