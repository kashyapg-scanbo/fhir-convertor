import crypto from 'crypto';
import scheduleTemplate from '../../shared/templates/schedule.json' with { type: 'json' };
import type { CanonicalSchedule, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ScheduleMapperArgs {
  schedules?: CanonicalSchedule[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
}

export function mapSchedules({
  schedules,
  operation,
  registry,
  resolveRef,
  patientFullUrl
}: ScheduleMapperArgs) {
  if (!schedules || schedules.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < schedules.length; index++) {
    const source = schedules[index];
    const schedule = structuredClone(scheduleTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    schedule.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${schedule.id}`;
    schedule.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'Schedule',
      {
        identifier: source.id || source.identifier || schedule.id,
        id: schedule.id
      },
      fullUrl
    );

    schedule.active = source.active ?? true;
    schedule.name = source.name || undefined;
    schedule.comment = source.comment || undefined;

    schedule.serviceCategory = source.serviceCategory?.length
      ? source.serviceCategory.map(cat => ({
        coding: [{
          system: cat.system,
          code: cat.code,
          display: cat.display
        }],
        text: cat.display
      }))
      : undefined;

    schedule.serviceType = source.serviceType?.length
      ? source.serviceType.map(service => ({
        concept: {
          coding: [{
            system: service.system,
            code: service.code,
            display: service.display
          }],
          text: service.display
        }
      }))
      : undefined;

    schedule.specialty = source.specialty?.length
      ? source.specialty.map(spec => ({
        coding: [{
          system: spec.system,
          code: spec.code,
          display: spec.display
        }],
        text: spec.display
      }))
      : undefined;

    schedule.actor = (source.actor && source.actor.length > 0)
      ? source.actor.map(actorId => ({ reference: resolveActorRef(resolveRef, actorId, patientFullUrl) }))
      : (patientFullUrl ? [{ reference: patientFullUrl }] : undefined);

    schedule.planningHorizon = source.planningHorizon
      ? { start: source.planningHorizon.start, end: source.planningHorizon.end }
      : undefined;

    const scheduleSummary = schedule.name || schedule.id;
    if (scheduleSummary) schedule.text = makeNarrative('Schedule', scheduleSummary);

    if (operation === 'delete') {
      schedule.active = false;
    }

    const entry: any = {
      resource: schedule,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Schedule?identifier=${identifierSystem}|${identifierValue || schedule.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Schedule/${schedule.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}

function resolveActorRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, actorId: string, patientFullUrl?: string) {
  if (!actorId) return patientFullUrl;
  if (actorId.includes('/')) return actorId;

  return (
    resolveRef('Practitioner', actorId) ||
    resolveRef('PractitionerRole', actorId) ||
    resolveRef('Location', actorId) ||
    resolveRef('Organization', actorId) ||
    resolveRef('HealthcareService', actorId) ||
    resolveRef('Patient', actorId) ||
    `Practitioner/${actorId}`
  );
}
