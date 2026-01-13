import crypto from 'crypto';
import goalTemplate from '../../shared/templates/goal.json' with { type: 'json' };
import type { CanonicalGoal, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface GoalMapperArgs {
  goals?: CanonicalGoal[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
}

export function mapGoals({
  goals,
  operation,
  registry,
  resolveRef,
  patientFullUrl
}: GoalMapperArgs) {
  if (!goals || goals.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of goals) {
    const goal = structuredClone(goalTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    goal.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${goal.id}`;
    goal.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'Goal',
      {
        identifier: source.id || source.identifier || goal.id,
        id: goal.id
      },
      fullUrl
    );

    goal.lifecycleStatus = source.lifecycleStatus || 'active';
    goal.achievementStatus = source.achievementStatus ? mapCodeableConcept(source.achievementStatus) : undefined;
    goal.category = source.category?.length ? source.category.map(cat => mapCodeableConcept(cat)) : undefined;
    goal.continuous = source.continuous ?? undefined;
    goal.priority = source.priority ? mapCodeableConcept(source.priority) : undefined;

    if (source.description) {
      goal.description = {
        coding: source.description.code || source.description.system || source.description.display ? [{
          system: source.description.system,
          code: source.description.code,
          display: source.description.display
        }] : undefined,
        text: source.description.text || source.description.display
      };
    } else {
      goal.description = undefined;
    }

    if (source.subject) {
      goal.subject = { reference: resolveSubjectRef(resolveRef, source.subject) || `Patient/${source.subject}` };
    } else if (patientFullUrl) {
      goal.subject = { reference: patientFullUrl };
    } else {
      goal.subject = undefined;
    }

    if (source.startDate) {
      goal.startDate = source.startDate;
      goal.startCodeableConcept = undefined;
    } else if (source.startCodeableConcept) {
      goal.startCodeableConcept = mapCodeableConcept(source.startCodeableConcept);
      goal.startDate = undefined;
    } else {
      goal.startDate = undefined;
      goal.startCodeableConcept = undefined;
    }

    goal.target = source.target?.length
      ? source.target.map(target => ({
        measure: target.measure ? mapCodeableConcept(target.measure) : undefined,
        detailString: target.detailString,
        detailBoolean: target.detailBoolean,
        detailInteger: target.detailInteger,
        dueDate: target.dueDate
      }))
      : undefined;

    goal.statusDate = source.statusDate || undefined;
    goal.statusReason = source.statusReason || undefined;

    goal.source = source.source
      ? { reference: resolveSourceRef(resolveRef, source.source) }
      : undefined;

    goal.addresses = source.addresses?.length
      ? source.addresses.map(ref => ({ reference: resolveAddressRef(resolveRef, ref) }))
      : undefined;

    goal.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;

    goal.outcome = source.outcome?.length
      ? source.outcome.map(ref => ({ reference: resolveOutcomeRef(resolveRef, ref) }))
      : undefined;

    const summary = goal.description?.text || goal.id;
    if (summary) goal.text = makeNarrative('Goal', summary);

    if (operation === 'delete') {
      goal.lifecycleStatus = 'entered-in-error';
    }

    const entry: any = {
      resource: goal,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Goal?identifier=${identifierSystem}|${identifierValue || goal.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Goal/${goal.id}`
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

function resolveSubjectRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Patient', id) ||
    resolveRef('Group', id) ||
    resolveRef('Organization', id)
  );
}

function resolveSourceRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('CareTeam', id) ||
    resolveRef('Patient', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('RelatedPerson', id) ||
    `Practitioner/${id}`
  );
}

function resolveAddressRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Condition', id) ||
    resolveRef('MedicationRequest', id) ||
    resolveRef('MedicationStatement', id) ||
    resolveRef('Observation', id) ||
    resolveRef('Procedure', id) ||
    resolveRef('ServiceRequest', id) ||
    `Condition/${id}`
  );
}

function resolveOutcomeRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return resolveRef('Observation', id) || `Observation/${id}`;
}
