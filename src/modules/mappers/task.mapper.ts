import crypto from 'crypto';
import taskTemplate from '../../shared/templates/task.json' with { type: 'json' };
import type { CanonicalTask, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface TaskMapperArgs {
  tasks?: CanonicalTask[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapTasks({
  tasks,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: TaskMapperArgs) {
  if (!tasks || tasks.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of tasks) {
    const task = structuredClone(taskTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    task.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${task.id}`;
    task.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'Task',
      {
        identifier: source.id || source.identifier || task.id,
        id: task.id
      },
      fullUrl
    );

    task.instantiatesCanonical = source.instantiatesCanonical || undefined;
    task.instantiatesUri = source.instantiatesUri || undefined;

    task.basedOn = source.basedOn?.length
      ? source.basedOn.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    task.groupIdentifier = source.groupIdentifier
      ? { value: source.groupIdentifier }
      : undefined;

    task.partOf = source.partOf?.length
      ? source.partOf.map(ref => ({ reference: resolveRef('Task', ref) || `Task/${ref}` }))
      : undefined;

    task.status = source.status || 'requested';
    task.statusReason = source.statusReason ? { concept: { text: source.statusReason } } : undefined;
    task.businessStatus = source.businessStatus ? { text: source.businessStatus } : undefined;
    task.intent = source.intent || 'order';
    task.priority = source.priority || undefined;
    task.doNotPerform = source.doNotPerform ?? undefined;

    task.code = source.code
      ? {
        coding: [{
          system: source.code.system,
          code: source.code.code,
          display: source.code.display
        }],
        text: source.code.display || source.code.code
      }
      : undefined;

    task.description = source.description || undefined;

    task.focus = source.focus
      ? { reference: normalizeReference(source.focus) }
      : undefined;

    if (source.for) {
      task.for = { reference: normalizeReference(source.for) };
    } else if (patientFullUrl) {
      task.for = { reference: patientFullUrl };
    } else {
      task.for = undefined;
    }

    if (source.encounter) {
      task.encounter = { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` };
    } else if (encounterFullUrl) {
      task.encounter = { reference: encounterFullUrl };
    } else {
      task.encounter = undefined;
    }

    task.requestedPeriod = source.requestedPeriod?.start || source.requestedPeriod?.end
      ? { start: source.requestedPeriod?.start, end: source.requestedPeriod?.end }
      : undefined;

    task.executionPeriod = source.executionPeriod?.start || source.executionPeriod?.end
      ? { start: source.executionPeriod?.start, end: source.executionPeriod?.end }
      : undefined;

    task.authoredOn = source.authoredOn || undefined;
    task.lastModified = source.lastModified || undefined;

    task.requester = source.requester
      ? { reference: resolveRequesterRef(resolveRef, source.requester) }
      : undefined;

    task.requestedPerformer = source.requestedPerformer?.length
      ? source.requestedPerformer.map(ref => ({ reference: resolvePerformerRef(resolveRef, ref) }))
      : undefined;

    task.owner = source.owner
      ? { reference: resolveOwnerRef(resolveRef, source.owner) }
      : undefined;

    task.performer = source.performer?.length
      ? source.performer.map(performer => ({
        actor: performer.actor ? { reference: resolvePerformerRef(resolveRef, performer.actor) } : undefined,
        function: performer.function ? mapCodeableConcept(performer.function) : undefined
      }))
      : undefined;

    task.location = source.location
      ? { reference: resolveRef('Location', source.location) || `Location/${source.location}` }
      : undefined;

    task.reason = source.reason?.length
      ? source.reason.map(value => ({ concept: { text: value } }))
      : undefined;

    task.insurance = source.insurance?.length
      ? source.insurance.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    task.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    task.relevantHistory = source.relevantHistory?.length
      ? source.relevantHistory.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    const summary = task.code?.text || task.description || task.id;
    if (summary) task.text = makeNarrative('Task', summary);

    if (operation === 'delete') {
      task.status = 'entered-in-error';
    }

    const entry: any = {
      resource: task,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Task?identifier=${identifierSystem}|${identifierValue || task.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Task/${task.id}`
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

function normalizeReference(value: string) {
  if (!value) return value;
  return value.includes('/') ? value : value;
}

function resolveRequesterRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('RelatedPerson', id) ||
    resolveRef('Device', id) ||
    `Practitioner/${id}`
  );
}

function resolvePerformerRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('CareTeam', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('RelatedPerson', id) ||
    resolveRef('Device', id) ||
    `Practitioner/${id}`
  );
}

function resolveOwnerRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('CareTeam', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('RelatedPerson', id) ||
    `Practitioner/${id}`
  );
}
