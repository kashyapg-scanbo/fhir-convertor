import crypto from 'crypto';
import diagnosticReportTemplate from '../../shared/templates/diagnosticReport.json' with { type: 'json' };
import type { CanonicalDiagnosticReport, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface DiagnosticReportMapperArgs {
  diagnosticReports?: CanonicalDiagnosticReport[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapDiagnosticReports({
  diagnosticReports,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: DiagnosticReportMapperArgs) {
  if (!diagnosticReports || diagnosticReports.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < diagnosticReports.length; index++) {
    const source = diagnosticReports[index];
    const diagnosticReport = structuredClone(diagnosticReportTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    diagnosticReport.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${diagnosticReport.id}`;
    diagnosticReport.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'DiagnosticReport',
      {
        identifier: source.id || source.identifier || diagnosticReport.id,
        id: diagnosticReport.id
      },
      fullUrl
    );

    diagnosticReport.status = source.status || 'final';

    diagnosticReport.category = source.category?.length
      ? source.category.map(cat => ({
        coding: [{
          system: cat.system,
          code: cat.code,
          display: cat.display
        }],
        text: cat.display
      }))
      : undefined;

    diagnosticReport.code = source.code ? {
      coding: source.code.coding || [],
      text: source.code.text
    } : undefined;

    if (source.subject) {
      diagnosticReport.subject = {
        reference: resolveRef('Patient', source.subject) || `Patient/${source.subject}`
      };
    } else if (patientFullUrl) {
      diagnosticReport.subject = { reference: patientFullUrl };
    } else {
      diagnosticReport.subject = undefined;
    }

    if (source.encounter) {
      diagnosticReport.encounter = {
        reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}`
      };
    } else if (encounterFullUrl) {
      diagnosticReport.encounter = { reference: encounterFullUrl };
    } else {
      diagnosticReport.encounter = undefined;
    }

    if (source.effectiveDateTime) {
      diagnosticReport.effectiveDateTime = source.effectiveDateTime;
      diagnosticReport.effectivePeriod = undefined;
    } else if (source.effectivePeriod) {
      diagnosticReport.effectivePeriod = {
        start: source.effectivePeriod.start,
        end: source.effectivePeriod.end
      };
      diagnosticReport.effectiveDateTime = undefined;
    } else {
      diagnosticReport.effectiveDateTime = undefined;
      diagnosticReport.effectivePeriod = undefined;
    }

    diagnosticReport.issued = source.issued || undefined;

    diagnosticReport.performer = source.performer?.length
      ? source.performer.map(performerId => ({
        reference: resolveRef('Organization', performerId) || resolveRef('Practitioner', performerId) || `Organization/${performerId}`
      }))
      : undefined;

    diagnosticReport.resultsInterpreter = source.resultsInterpreter?.length
      ? source.resultsInterpreter.map(interpreterId => ({
        reference: resolveRef('Practitioner', interpreterId) || `Practitioner/${interpreterId}`
      }))
      : undefined;

    diagnosticReport.specimen = source.specimen?.length
      ? source.specimen.map(specimenId => ({
        reference: resolveRef('Specimen', specimenId) || `Specimen/${specimenId}`
      }))
      : undefined;

    diagnosticReport.result = source.result?.length
      ? source.result.map(resultId => ({
        reference: resolveRef('Observation', resultId) || `Observation/${resultId}`
      }))
      : undefined;

    diagnosticReport.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    diagnosticReport.conclusion = source.conclusion || undefined;
    diagnosticReport.conclusionCode = source.conclusionCode?.length
      ? source.conclusionCode.map(code => ({
        coding: [{
          system: code.system,
          code: code.code,
          display: code.display
        }],
        text: code.display
      }))
      : undefined;

    const reportSummary = diagnosticReport.code?.text || diagnosticReport.id;
    if (reportSummary) diagnosticReport.text = makeNarrative('DiagnosticReport', reportSummary);

    if (operation === 'delete') {
      diagnosticReport.status = 'entered-in-error';
    }

    const entry: any = {
      resource: diagnosticReport,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `DiagnosticReport?identifier=${identifierSystem}|${identifierValue || diagnosticReport.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `DiagnosticReport/${diagnosticReport.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
