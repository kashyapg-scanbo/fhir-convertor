import crypto from 'crypto';
import encounterHistoryTemplate from '../../shared/templates/encounterHistory.json' with { type: 'json' };
import type { CanonicalEncounterHistory, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface EncounterHistoryMapperArgs {
  encounterHistories?: CanonicalEncounterHistory[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapEncounterHistories({
  encounterHistories,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: EncounterHistoryMapperArgs) {
  if (!encounterHistories || encounterHistories.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of encounterHistories) {
    const history = structuredClone(encounterHistoryTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    history.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${history.id}`;
    history.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'EncounterHistory',
      {
        identifier: source.id || source.identifier?.[0]?.value || history.id,
        id: history.id
      },
      fullUrl
    );

    if (source.encounter) {
      history.encounter = {
        reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}`
      };
    } else if (encounterFullUrl) {
      history.encounter = { reference: encounterFullUrl };
    } else {
      history.encounter = undefined;
    }

    history.status = source.status || undefined;
    history.class = mapCodeableConcept(source.class);
    history.type = source.type?.length ? source.type.map(mapCodeableConcept).filter(Boolean) : undefined;
    history.serviceType = source.serviceType?.length
      ? source.serviceType.map(service => ({
        concept: service.concept ? mapCodeableConcept(service.concept) : undefined,
        reference: service.reference
          ? { reference: resolveRef('HealthcareService', service.reference) || `HealthcareService/${service.reference}` }
          : undefined
      }))
      : undefined;

    if (source.subject) {
      history.subject = {
        reference: resolveAnyRef(resolveRef, ['Group', 'Patient'], source.subject)
      };
    } else if (patientFullUrl) {
      history.subject = { reference: patientFullUrl };
    } else {
      history.subject = undefined;
    }

    history.subjectStatus = mapCodeableConcept(source.subjectStatus);

    history.actualPeriod = source.actualPeriod
      ? { start: source.actualPeriod.start, end: source.actualPeriod.end }
      : undefined;
    history.plannedStartDate = source.plannedStartDate || undefined;
    history.plannedEndDate = source.plannedEndDate || undefined;
    history.length = source.length
      ? {
          value: source.length.value,
          unit: source.length.unit,
          system: source.length.system,
          code: source.length.code
        }
      : undefined;
    history.location = source.location?.length
      ? source.location.map(loc => ({
          location: loc.location
            ? { reference: resolveRef('Location', loc.location) || `Location/${loc.location}` }
            : undefined,
          form: loc.form ? mapCodeableConcept(loc.form) : undefined
        }))
      : undefined;

    const summary = history.class?.text || history.status || history.id;
    if (summary) history.text = makeNarrative('EncounterHistory', summary);

    if (operation === 'delete') {
      history.status = 'entered-in-error';
    }

    const entry: any = {
      resource: history,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `EncounterHistory?identifier=${identifierSystem}|${identifierValue || history.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `EncounterHistory/${history.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}

function mapCodeableConcept(source?: { system?: string; code?: string; display?: string }) {
  if (!source) return undefined;
  return {
    coding: (source.system || source.code || source.display) ? [{
      system: source.system,
      code: source.code,
      display: source.display
    }] : undefined,
    text: source.display || source.code
  };
}

function mapIdentifier(source?: { system?: string; value?: string; type?: { system?: string; code?: string; display?: string } }) {
  if (!source || (!source.system && !source.value && !source.type)) return undefined;
  return {
    system: source.system,
    value: source.value,
    type: source.type ? mapCodeableConcept(source.type) : undefined
  };
}

function resolveAnyRef(
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined,
  resourceTypes: string[],
  value: string
) {
  if (!value) return undefined;
  if (value.includes('/')) return value;
  for (const resourceType of resourceTypes) {
    const resolved = resolveRef(resourceType, value);
    if (resolved) return resolved;
  }
  return resourceTypes.length > 0 ? `${resourceTypes[0]}/${value}` : value;
}
