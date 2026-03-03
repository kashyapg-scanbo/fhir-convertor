import crypto from 'crypto';
import appointmentResponseTemplate from '../../shared/templates/appointmentResponse.json' with { type: 'json' };
import type { CanonicalAppointmentResponse, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface AppointmentResponseMapperArgs {
  appointmentResponses?: CanonicalAppointmentResponse[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapAppointmentResponses({
  appointmentResponses,
  operation,
  registry,
  resolveRef
}: AppointmentResponseMapperArgs) {
  if (!appointmentResponses || appointmentResponses.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < appointmentResponses.length; index++) {
    const source = appointmentResponses[index];
    const response = structuredClone(appointmentResponseTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    response.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${response.id}`;
    response.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'AppointmentResponse',
      {
        identifier: source.id || source.identifier || response.id,
        id: response.id
      },
      fullUrl
    );

    response.appointment = source.appointment
      ? { reference: resolveRef('Appointment', source.appointment) || `Appointment/${source.appointment}` }
      : undefined;
    response.proposedNewTime = source.proposedNewTime ?? undefined;
    response.start = source.start || undefined;
    response.end = source.end || undefined;
    response.participantType = source.participantType?.length
      ? source.participantType.map(type => mapCodeableConcept(type))
      : undefined;
    response.actor = source.actor ? { reference: resolveActorRef(resolveRef, source.actor) } : undefined;
    response.participantStatus = source.participantStatus || undefined;
    response.comment = source.comment || undefined;
    response.recurring = source.recurring ?? undefined;
    response.occurrenceDate = source.occurrenceDate || undefined;
    response.recurrenceId = source.recurrenceId ?? undefined;

    const responseSummary = response.comment || response.participantStatus || response.id;
    if (responseSummary) response.text = makeNarrative('AppointmentResponse', responseSummary);

    if (operation === 'delete') {
      response.participantStatus = 'entered-in-error';
    }

    const entry: any = {
      resource: response,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `AppointmentResponse?identifier=${identifierSystem}|${identifierValue || response.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `AppointmentResponse/${response.id}`
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

function resolveActorRef(
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined,
  actorId: string
) {
  if (!actorId) return undefined;
  if (actorId.includes('/')) return actorId;

  return (
    resolveRef('Practitioner', actorId)
    || resolveRef('PractitionerRole', actorId)
    || resolveRef('RelatedPerson', actorId)
    || resolveRef('Patient', actorId)
    || resolveRef('Location', actorId)
    || resolveRef('HealthcareService', actorId)
    || resolveRef('Group', actorId)
    || resolveRef('Device', actorId)
    || `Practitioner/${actorId}`
  );
}
