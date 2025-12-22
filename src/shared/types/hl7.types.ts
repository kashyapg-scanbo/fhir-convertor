export type HL7Component = string;
export type HL7Repetition = HL7Component[];
export type HL7Field = HL7Repetition[];
export type HL7Segment = HL7Field[];
export type HL7Message = Record<string, HL7Segment[]>;
