import crypto from 'crypto';
import procedureTemplate from '../../shared/templates/procedure.json' with { type: 'json' };
import type { CanonicalProcedure, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ProcedureMapperArgs {
  procedures?: CanonicalProcedure[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapProcedures({
  procedures,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: ProcedureMapperArgs) {
  if (!procedures || procedures.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < procedures.length; index++) {
    const source = procedures[index];
    const procedure = structuredClone(procedureTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    procedure.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${procedure.id}`;
    procedure.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'Procedure',
      {
        identifier: source.id || source.identifier || procedure.id,
        id: procedure.id
      },
      fullUrl
    );

    procedure.status = source.status || 'completed';

    if (source.category?.length) {
      procedure.category = source.category.map(cat => ({
        coding: [{
          system: cat.system,
          code: cat.code,
          display: cat.display
        }],
        text: cat.display
      }));
    } else {
      procedure.category = undefined;
    }

    if (source.code) {
      procedure.code = {
        coding: source.code.coding || [],
        text: source.code.text
      };
    } else {
      procedure.code = undefined;
    }

    if (source.subject) {
      procedure.subject = {
        reference: resolveRef('Patient', source.subject) || `Patient/${source.subject}`
      };
    } else if (patientFullUrl) {
      procedure.subject = { reference: patientFullUrl };
    } else {
      procedure.subject = undefined;
    }

    if (source.encounter) {
      procedure.encounter = {
        reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}`
      };
    } else if (encounterFullUrl) {
      procedure.encounter = { reference: encounterFullUrl };
    } else {
      procedure.encounter = undefined;
    }

    if (source.occurrenceDateTime) {
      procedure.occurrenceDateTime = source.occurrenceDateTime;
      procedure.occurrencePeriod = undefined;
    } else if (source.occurrencePeriod) {
      procedure.occurrencePeriod = {
        start: source.occurrencePeriod.start,
        end: source.occurrencePeriod.end
      };
      procedure.occurrenceDateTime = undefined;
    } else {
      procedure.occurrenceDateTime = undefined;
      procedure.occurrencePeriod = undefined;
    }

    procedure.recorded = source.recorded || undefined;

    if (source.performer?.length) {
      procedure.performer = source.performer.map(performer => ({
        function: performer.function ? {
          coding: [{
            system: performer.function.system,
            code: performer.function.code,
            display: performer.function.display
          }],
          text: performer.function.display
        } : undefined,
        actor: performer.actor ? {
          reference: resolveRef('Practitioner', performer.actor) || `Practitioner/${performer.actor}`
        } : undefined,
        onBehalfOf: performer.onBehalfOf ? {
          reference: resolveRef('Organization', performer.onBehalfOf) || `Organization/${performer.onBehalfOf}`
        } : undefined,
        period: performer.period ? {
          start: performer.period.start,
          end: performer.period.end
        } : undefined
      }));
    } else {
      procedure.performer = undefined;
    }

    if (source.reason?.length) {
      procedure.reason = source.reason.map(reason => {
        if (reason.reference) {
          return { reference: reason.reference };
        }
        if (reason.code) {
          return {
            concept: {
              coding: [{
                system: reason.code.system,
                code: reason.code.code,
                display: reason.code.display
              }],
              text: reason.code.display
            }
          };
        }
        return null;
      }).filter(Boolean);
    } else {
      procedure.reason = undefined;
    }

    if (source.bodySite?.length) {
      procedure.bodySite = source.bodySite.map(site => ({
        coding: [{
          system: site.system,
          code: site.code,
          display: site.display
        }],
        text: site.display
      }));
    } else {
      procedure.bodySite = undefined;
    }

    if (source.location) {
      procedure.location = {
        reference: resolveRef('Location', source.location) || `Location/${source.location}`
      };
    } else {
      procedure.location = undefined;
    }

    procedure.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    const procedureSummary = procedure.code?.text || procedure.id;
    if (procedureSummary) procedure.text = makeNarrative('Procedure', procedureSummary);

    if (operation === 'delete') {
      procedure.status = 'entered-in-error';
    }

    const entry: any = {
      resource: procedure,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Procedure?identifier=${identifierSystem}|${identifierValue || procedure.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Procedure/${procedure.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
