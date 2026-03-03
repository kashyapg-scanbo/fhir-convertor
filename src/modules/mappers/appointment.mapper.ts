import crypto from 'crypto';
import appointmentTemplate from '../../shared/templates/appointment.json' with { type: 'json' };
import type { CanonicalAppointment, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface AppointmentMapperArgs {
  appointments?: CanonicalAppointment[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
}

export function mapAppointments({
  appointments,
  operation,
  registry,
  resolveRef,
  patientFullUrl
}: AppointmentMapperArgs) {
  if (!appointments || appointments.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < appointments.length; index++) {
    const source = appointments[index];
    const appointment = structuredClone(appointmentTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    appointment.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${appointment.id}`;
    appointment.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'Appointment',
      {
        identifier: source.id || source.identifier || appointment.id,
        id: appointment.id
      },
      fullUrl
    );

    appointment.status = source.status || 'proposed';
    appointment.description = source.description || undefined;
    appointment.start = source.start || undefined;
    appointment.end = source.end || undefined;
    appointment.minutesDuration = (source.minutesDuration && source.minutesDuration > 0)
      ? source.minutesDuration
      : undefined;
    appointment.created = source.created || undefined;
    appointment.cancellationDate = source.cancellationDate || undefined;
    appointment.extension = source.extension?.length ? source.extension : undefined;

    appointment.cancellationReason = source.cancellationReason ? {
      coding: [{
        system: source.cancellationReason.system,
        code: source.cancellationReason.code,
        display: source.cancellationReason.display
      }],
      text: source.cancellationReason.display
    } : undefined;

    appointment.serviceCategory = source.serviceCategory?.length
      ? source.serviceCategory.map(cat => ({
        coding: [{
          system: cat.system,
          code: cat.code,
          display: cat.display
        }],
        text: cat.display
      }))
      : undefined;

    appointment.serviceType = source.serviceType?.length
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

    appointment.specialty = source.specialty?.length
      ? source.specialty.map(spec => ({
        coding: [{
          system: spec.system,
          code: spec.code,
          display: spec.display
        }],
        text: spec.display
      }))
      : undefined;

    appointment.appointmentType = source.appointmentType ? {
      coding: [{
        system: source.appointmentType.system,
        code: source.appointmentType.code,
        display: source.appointmentType.display
      }],
      text: source.appointmentType.display
    } : undefined;

    appointment.reason = source.reason?.length
      ? source.reason.map(reason => {
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
      }).filter(Boolean)
      : undefined;

    appointment.priority = source.priority ? {
      coding: [{
        system: source.priority.system,
        code: source.priority.code,
        display: source.priority.display
      }],
      text: source.priority.display
    } : undefined;

    appointment.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    if (source.subject) {
      appointment.subject = {
        reference: resolveRef('Patient', source.subject) || `Patient/${source.subject}`
      };
    } else if (patientFullUrl) {
      appointment.subject = { reference: patientFullUrl };
    } else {
      appointment.subject = undefined;
    }

    appointment.participant = source.participant?.length
      ? source.participant.map(participant => ({
        actor: participant.actor
          ? { reference: resolveRef('Practitioner', participant.actor) || `Practitioner/${participant.actor}` }
          : undefined,
        status: participant.status || 'needs-action',
        required: participant.required || undefined,
        period: participant.period ? {
          start: participant.period.start,
          end: participant.period.end
        } : undefined
      }))
      : undefined;

    if (!appointment.participant || appointment.participant.length === 0) {
      const subjectRef = appointment.subject?.reference || patientFullUrl;
      if (subjectRef) {
        appointment.participant = [{
          actor: { reference: subjectRef },
          status: 'accepted'
        }];
      } else {
        appointment.participant = undefined;
      }
    }

    // Remove template defaults that violate FHIR constraints when not provided.
    appointment.recurrenceId = undefined;
    appointment.occurrenceChanged = undefined;

    const appointmentSummary = appointment.description || appointment.id;
    if (appointmentSummary) appointment.text = makeNarrative('Appointment', appointmentSummary);

    if (operation === 'delete') {
      appointment.status = 'cancelled';
    }

    const entry: any = {
      resource: appointment,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Appointment?identifier=${identifierSystem}|${identifierValue || appointment.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Appointment/${appointment.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
