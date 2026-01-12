import crypto from 'crypto';
import specimenTemplate from '../../shared/templates/specimen.json' with { type: 'json' };
import type { CanonicalSpecimen, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface SpecimenMapperArgs {
  specimens?: CanonicalSpecimen[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
}

export function mapSpecimens({
  specimens,
  operation,
  registry,
  resolveRef,
  patientFullUrl
}: SpecimenMapperArgs) {
  if (!specimens || specimens.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < specimens.length; index++) {
    const source = specimens[index];
    const specimen = structuredClone(specimenTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    specimen.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${specimen.id}`;
    specimen.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'Specimen',
      {
        identifier: source.id || source.identifier || specimen.id,
        id: specimen.id
      },
      fullUrl
    );

    specimen.accessionIdentifier = source.accessionIdentifier ? {
      value: source.accessionIdentifier
    } : undefined;

    specimen.status = source.status || 'available';
    specimen.type = source.type ? mapCodeableConcept(source.type) : undefined;

    const subjectReference = resolveSpecimenSubjectRef(resolveRef, source.subject) || patientFullUrl || (source.subject ? `Patient/${source.subject}` : undefined);
    specimen.subject = subjectReference ? { reference: subjectReference } : undefined;

    specimen.receivedTime = source.receivedTime || undefined;

    specimen.parent = source.parent?.length
      ? source.parent.map(parentId => ({ reference: resolveRef('Specimen', parentId) || `Specimen/${parentId}` }))
      : undefined;

    specimen.request = source.request?.length
      ? source.request.map(requestId => ({ reference: resolveRef('ServiceRequest', requestId) || `ServiceRequest/${requestId}` }))
      : undefined;

    specimen.combined = source.combined || undefined;

    specimen.role = source.role?.length
      ? source.role.map(role => mapCodeableConcept(role))
      : undefined;

    specimen.feature = source.feature?.length
      ? source.feature.map(feature => ({
        type: feature.type ? mapCodeableConcept(feature.type) : undefined,
        description: feature.description
      }))
      : undefined;

    if (source.collection) {
      specimen.collection = {
        collector: source.collection.collector ? { reference: resolveCollectorRef(resolveRef, source.collection.collector) } : undefined,
        collectedDateTime: source.collection.collectedDateTime || undefined,
        collectedPeriod: source.collection.collectedPeriod ? {
          start: source.collection.collectedPeriod.start,
          end: source.collection.collectedPeriod.end
        } : undefined,
        duration: source.collection.duration ? {
          value: source.collection.duration.value,
          unit: source.collection.duration.unit
        } : undefined,
        quantity: source.collection.quantity ? {
          value: source.collection.quantity.value,
          unit: source.collection.quantity.unit
        } : undefined,
        method: source.collection.method ? mapCodeableConcept(source.collection.method) : undefined,
        device: source.collection.device ? {
          reference: resolveRef('Device', source.collection.device) || `Device/${source.collection.device}`
        } : undefined,
        procedure: source.collection.procedure ? {
          reference: resolveRef('Procedure', source.collection.procedure) || `Procedure/${source.collection.procedure}`
        } : undefined,
        bodySite: source.collection.bodySite ? {
          concept: mapCodeableConcept(source.collection.bodySite)
        } : undefined,
        fastingStatusCodeableConcept: source.collection.fastingStatusCodeableConcept
          ? mapCodeableConcept(source.collection.fastingStatusCodeableConcept)
          : undefined,
        fastingStatusDuration: source.collection.fastingStatusDuration ? {
          value: source.collection.fastingStatusDuration.value,
          unit: source.collection.fastingStatusDuration.unit
        } : undefined
      };
    }

    specimen.processing = source.processing?.length
      ? source.processing.map(processing => ({
        description: processing.description,
        method: processing.method ? mapCodeableConcept(processing.method) : undefined,
        additive: processing.additive?.map(additiveId => ({
          reference: resolveRef('Substance', additiveId) || `Substance/${additiveId}`
        })),
        timeDateTime: processing.timeDateTime,
        timePeriod: processing.timePeriod ? {
          start: processing.timePeriod.start,
          end: processing.timePeriod.end
        } : undefined
      }))
      : undefined;

    specimen.container = source.container?.length
      ? source.container.map(container => ({
        device: container.device ? {
          reference: resolveRef('Device', container.device) || `Device/${container.device}`
        } : undefined,
        location: container.location ? {
          reference: resolveRef('Location', container.location) || `Location/${container.location}`
        } : undefined,
        specimenQuantity: container.specimenQuantity ? {
          value: container.specimenQuantity.value,
          unit: container.specimenQuantity.unit
        } : undefined
      }))
      : undefined;

    specimen.condition = source.condition?.length
      ? source.condition.map(condition => mapCodeableConcept(condition))
      : undefined;

    specimen.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    const summary = specimen.type?.text || specimen.id;
    if (summary) specimen.text = makeNarrative('Specimen', summary);

    if (operation === 'delete') {
      specimen.status = 'entered-in-error';
    }

    const entry: any = {
      resource: specimen,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Specimen?identifier=${identifierSystem}|${identifierValue || specimen.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Specimen/${specimen.id}`
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

function resolveSpecimenSubjectRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, subject?: string) {
  if (!subject) return undefined;
  if (subject.includes('/')) return subject;

  return (
    resolveRef('Patient', subject) ||
    resolveRef('Group', subject) ||
    resolveRef('Location', subject) ||
    resolveRef('Device', subject) ||
    resolveRef('Substance', subject) ||
    resolveRef('BiologicallyDerivedProduct', subject) ||
    `Patient/${subject}`
  );
}

function resolveCollectorRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, collectorId?: string) {
  if (!collectorId) return undefined;
  if (collectorId.includes('/')) return collectorId;

  return (
    resolveRef('Practitioner', collectorId) ||
    resolveRef('PractitionerRole', collectorId) ||
    resolveRef('RelatedPerson', collectorId) ||
    resolveRef('Patient', collectorId) ||
    `Practitioner/${collectorId}`
  );
}
