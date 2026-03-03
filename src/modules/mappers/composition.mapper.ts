import crypto from 'crypto';
import compositionTemplate from '../../shared/templates/composition.json' with { type: 'json' };
import type { CanonicalComposition, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface CompositionMapperArgs {
  compositions?: CanonicalComposition[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapCompositions({
  compositions,
  operation,
  registry,
  resolveRef
}: CompositionMapperArgs) {
  if (!compositions || compositions.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < compositions.length; index++) {
    const source = compositions[index];
    const composition = structuredClone(compositionTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    composition.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${composition.id}`;
    composition.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'Composition',
      {
        identifier: source.id || source.identifier?.[0]?.value || composition.id,
        id: composition.id
      },
      fullUrl
    );

    composition.url = source.url || undefined;
    composition.version = source.version || undefined;
    composition.status = source.status || undefined;
    composition.type = mapCodeableConcept(source.type);
    composition.category = source.category?.length ? source.category.map(mapCodeableConcept) : undefined;
    composition.subject = source.subject?.length
      ? source.subject.map(ref => ({ reference: resolveAnyRef(resolveRef, [], ref) }))
      : undefined;
    composition.encounter = source.encounter
      ? { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` }
      : undefined;
    composition.date = source.date || undefined;
    composition.useContext = source.useContext?.length
      ? source.useContext.map(ctx => ({
        code: mapCodeableConcept(ctx.code),
        valueCodeableConcept: mapCodeableConcept(ctx.valueCodeableConcept),
        valueReference: ctx.valueReference ? { reference: resolveAnyRef(resolveRef, [], ctx.valueReference) } : undefined
      }))
      : undefined;
    composition.author = source.author?.length
      ? source.author.map(ref => ({ reference: resolveAnyRef(resolveRef, ['Device', 'Organization', 'Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], ref) }))
      : undefined;
    composition.name = source.name || undefined;
    composition.title = source.title || undefined;
    composition.note = source.note?.length
      ? source.note.map(note => ({
        text: note.text || undefined,
        authorString: note.author || undefined,
        time: note.time || undefined
      }))
      : undefined;
    composition.attester = source.attester?.length
      ? source.attester.map(att => ({
        mode: mapCodeableConcept(att.mode),
        time: att.time || undefined,
        party: att.party ? { reference: resolveAnyRef(resolveRef, ['Organization', 'Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], att.party) } : undefined
      }))
      : undefined;
    composition.custodian = source.custodian
      ? { reference: resolveRef('Organization', source.custodian) || `Organization/${source.custodian}` }
      : undefined;
    composition.relatesTo = source.relatesTo?.length
      ? source.relatesTo.map(rel => ({
        type: rel.type || undefined,
        resourceReference: rel.resource ? { reference: resolveAnyRef(resolveRef, [], rel.resource) } : undefined,
        resourceIdentifier: rel.identifier ? mapIdentifier(rel.identifier) : undefined
      }))
      : undefined;
    composition.event = source.event?.length
      ? source.event.map(evt => ({
        period: mapPeriod(evt.period),
        detail: evt.detail?.length ? evt.detail.map(ref => ({ reference: resolveAnyRef(resolveRef, [], ref) })) : undefined
      }))
      : undefined;
    composition.section = source.section?.length ? source.section.map(section => mapSection(section, resolveRef)) : undefined;

    const summary = composition.title || composition.name || composition.id;
    if (summary) composition.text = makeNarrative('Composition', summary);

    if (operation === 'delete') {
      composition.status = 'entered-in-error';
    }

    const entry: any = {
      resource: composition,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Composition?identifier=${identifierSystem}|${identifierValue || composition.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Composition/${composition.id}`
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

function mapPeriod(source?: { start?: string; end?: string }) {
  if (!source || (!source.start && !source.end)) return undefined;
  return {
    start: source.start,
    end: source.end
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

type CompositionSectionResource = Record<string, unknown>;

function mapSection(
  section: NonNullable<CanonicalComposition['section']>[number],
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined
): CompositionSectionResource {
  return {
    title: section.title || undefined,
    code: mapCodeableConcept(section.code),
    author: section.author?.length
      ? section.author.map(ref => ({ reference: resolveAnyRef(resolveRef, ['Device', 'Organization', 'Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], ref) }))
      : undefined,
    focus: section.focus ? { reference: resolveAnyRef(resolveRef, [], section.focus) } : undefined,
    text: section.text ? buildNarrative(section.text) : undefined,
    orderedBy: mapCodeableConcept(section.orderedBy),
    entry: section.entry?.length ? section.entry.map(ref => ({ reference: resolveAnyRef(resolveRef, [], ref) })) : undefined,
    emptyReason: mapCodeableConcept(section.emptyReason),
    section: section.section?.length ? section.section.map(child => mapSection(child, resolveRef)) : undefined
  };
}

function buildNarrative(text: string) {
  const escaped = escapeHtml(text);
  return {
    status: 'generated',
    div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${escaped}</p></div>`
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
