import crypto from 'crypto';
import imagingStudyTemplate from '../../shared/templates/imagingStudy.json' with { type: 'json' };
import type { CanonicalImagingStudy, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ImagingStudyMapperArgs {
  imagingStudies?: CanonicalImagingStudy[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
}

export function mapImagingStudies({
  imagingStudies,
  operation,
  registry,
  resolveRef,
  patientFullUrl
}: ImagingStudyMapperArgs) {
  if (!imagingStudies || imagingStudies.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < imagingStudies.length; index++) {
    const source = imagingStudies[index];
    const study = structuredClone(imagingStudyTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    study.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${study.id}`;
    study.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'ImagingStudy',
      {
        identifier: source.id || source.identifier || study.id,
        id: study.id
      },
      fullUrl
    );

    study.status = source.status || 'available';
    study.modality = source.modality?.map(mapCodeableConcept).filter(Boolean) || undefined;

    const subjectReference = resolveStudySubjectRef(resolveRef, source.subject) || patientFullUrl || (source.subject ? `Patient/${source.subject}` : undefined);
    study.subject = subjectReference ? { reference: subjectReference } : undefined;

    study.encounter = source.encounter
      ? { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` }
      : undefined;

    study.started = source.started || undefined;

    study.basedOn = source.basedOn?.map(id => ({ reference: resolveRef('ServiceRequest', id) || `ServiceRequest/${id}` })) || undefined;
    study.partOf = source.partOf?.map(id => ({ reference: resolveRef('Procedure', id) || `Procedure/${id}` })) || undefined;

    study.referrer = source.referrer
      ? { reference: resolveRef('Practitioner', source.referrer) || resolveRef('PractitionerRole', source.referrer) || `Practitioner/${source.referrer}` }
      : undefined;

    study.endpoint = source.endpoint?.map(id => ({ reference: resolveRef('Endpoint', id) || `Endpoint/${id}` })) || undefined;

    study.numberOfSeries = source.numberOfSeries ?? undefined;
    study.numberOfInstances = source.numberOfInstances ?? undefined;

    study.procedure = source.procedure?.length
      ? source.procedure.map(proc => ({ concept: mapCodeableConcept(proc) })).filter((entry: any) => entry.concept)
      : undefined;

    study.location = source.location
      ? { reference: resolveRef('Location', source.location) || `Location/${source.location}` }
      : undefined;

    study.reason = source.reason?.length
      ? source.reason.map(reason => ({ value: reason.code ? [{ concept: mapCodeableConcept(reason.code) }] : [] })).filter((entry: any) => entry.value?.length)
      : undefined;

    study.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;
    study.description = source.description || undefined;

    study.series = source.series?.length
      ? source.series.map(series => ({
        uid: series.uid,
        number: series.number,
        modality: series.modality ? mapCodeableConcept(series.modality) : undefined,
        description: series.description,
        numberOfInstances: series.numberOfInstances,
        endpoint: series.endpoint?.map(id => ({ reference: resolveRef('Endpoint', id) || `Endpoint/${id}` })),
        bodySite: series.bodySite ? { concept: mapCodeableConcept(series.bodySite) } : undefined,
        laterality: series.laterality ? mapCodeableConcept(series.laterality) : undefined,
        specimen: series.specimen?.map(id => ({ reference: resolveRef('Specimen', id) || `Specimen/${id}` })),
        started: series.started,
        performer: series.performer?.map(performer => ({
          function: performer.function ? mapCodeableConcept(performer.function) : undefined,
          actor: performer.actor ? { reference: resolveSeriesPerformerRef(resolveRef, performer.actor) } : undefined
        }))
          .filter((entry: any) => entry.function || entry.actor),
        instance: series.instance?.map(instance => ({
          uid: instance.uid,
          sopClass: instance.sopClass ? {
            system: instance.sopClass.system,
            code: instance.sopClass.code,
            display: instance.sopClass.display
          } : undefined,
          number: instance.number,
          title: instance.title
        }))
      }))
      : undefined;

    const summary = study.description || study.id;
    if (summary) study.text = makeNarrative('ImagingStudy', summary);

    if (operation === 'delete') {
      study.status = 'entered-in-error';
    }

    const entry: any = {
      resource: study,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `ImagingStudy?identifier=${identifierSystem}|${identifierValue || study.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `ImagingStudy/${study.id}`
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

function resolveStudySubjectRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, subject?: string) {
  if (!subject) return undefined;
  if (subject.includes('/')) return subject;

  return (
    resolveRef('Patient', subject) ||
    resolveRef('Group', subject) ||
    resolveRef('Device', subject) ||
    `Patient/${subject}`
  );
}

function resolveSeriesPerformerRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, actorId: string) {
  if (!actorId) return undefined;
  if (actorId.includes('/')) return actorId;

  return (
    resolveRef('Practitioner', actorId) ||
    resolveRef('PractitionerRole', actorId) ||
    resolveRef('Patient', actorId) ||
    resolveRef('Organization', actorId) ||
    resolveRef('CareTeam', actorId) ||
    resolveRef('Device', actorId) ||
    `Practitioner/${actorId}`
  );
}
