import crypto from 'crypto';
import chargeItemDefinitionTemplate from '../../shared/templates/chargeItemDefinition.json' with { type: 'json' };
import type { CanonicalChargeItemDefinition, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ChargeItemDefinitionMapperArgs {
  chargeItemDefinitions?: CanonicalChargeItemDefinition[];
  operation?: OperationType;
  registry: FullUrlRegistry;
}

export function mapChargeItemDefinitions({
  chargeItemDefinitions,
  operation,
  registry
}: ChargeItemDefinitionMapperArgs) {
  if (!chargeItemDefinitions || chargeItemDefinitions.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < chargeItemDefinitions.length; index++) {
    const source = chargeItemDefinitions[index];
    const definition = structuredClone(chargeItemDefinitionTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    definition.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${definition.id}`;

    definition.url = source.url || undefined;
    definition.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);
    definition.version = source.version || undefined;
    definition.versionAlgorithmString = source.versionAlgorithmString || undefined;
    definition.versionAlgorithmCoding = mapCoding(source.versionAlgorithmCoding);
    definition.name = source.name || undefined;
    definition.title = source.title || undefined;
    definition.derivedFromUri = source.derivedFromUri?.length ? source.derivedFromUri : undefined;
    definition.partOf = source.partOf?.length ? source.partOf : undefined;
    definition.replaces = source.replaces?.length ? source.replaces : undefined;
    definition.status = source.status || undefined;
    definition.experimental = source.experimental ?? undefined;
    definition.date = source.date || undefined;
    definition.publisher = source.publisher || undefined;
    definition.contact = source.contact?.length
      ? source.contact.map(entry => ({
        name: entry.name || undefined,
        telecom: entry.telecom?.length
          ? entry.telecom.map(tel => ({
            system: tel.system,
            value: tel.value,
            use: tel.use
          }))
          : undefined
      }))
      : undefined;
    definition.description = source.description || undefined;
    definition.useContext = source.useContext?.length
      ? source.useContext.map(ctx => ({
        code: mapCodeableConcept(ctx.code),
        valueCodeableConcept: ctx.value?.code ? mapCodeableConcept(ctx.value.code) : undefined,
        valueReference: ctx.value?.reference ? { reference: ctx.value.reference } : undefined
      }))
      : undefined;
    definition.jurisdiction = source.jurisdiction?.length
      ? source.jurisdiction.map(mapCodeableConcept).filter(Boolean)
      : undefined;
    definition.purpose = source.purpose || undefined;
    definition.copyright = source.copyright || undefined;
    definition.copyrightLabel = source.copyrightLabel || undefined;
    definition.approvalDate = source.approvalDate || undefined;
    definition.lastReviewDate = source.lastReviewDate || undefined;
    definition.code = mapCodeableConcept(source.code);
    definition.instance = source.instance?.length
      ? source.instance.map(ref => ({ reference: ref }))
      : undefined;
    definition.applicability = source.applicability?.length
      ? source.applicability.map(app => ({
        condition: app.condition || undefined,
        effectivePeriod: mapPeriod(app.effectivePeriod),
        relatedArtifact: app.relatedArtifact
          ? {
            type: app.relatedArtifact.type,
            url: app.relatedArtifact.url,
            display: app.relatedArtifact.display
          }
          : undefined
      }))
      : undefined;
    definition.propertyGroup = source.propertyGroup?.length
      ? source.propertyGroup.map(group => ({
        applicability: group.applicability?.length
          ? group.applicability.map(app => ({
            condition: app.condition || undefined,
            effectivePeriod: mapPeriod(app.effectivePeriod),
            relatedArtifact: app.relatedArtifact
              ? {
                type: app.relatedArtifact.type,
                url: app.relatedArtifact.url,
                display: app.relatedArtifact.display
              }
              : undefined
          }))
          : undefined,
        priceComponent: group.priceComponent?.length
          ? group.priceComponent.map(pc => ({
            type: pc.type,
            code: mapCodeableConcept(pc.code),
            factor: pc.factor,
            amount: pc.amount ? { value: pc.amount.value, currency: pc.amount.currency } : undefined
          }))
          : undefined
      }))
      : undefined;

    registry.register(
      'ChargeItemDefinition',
      {
        identifier: source.id || source.identifier?.[0]?.value || definition.id,
        id: definition.id
      },
      fullUrl
    );

    const summary = definition.title || definition.name || definition.url || definition.id;
    if (summary) definition.text = makeNarrative('ChargeItemDefinition', summary);

    if (operation === 'delete') {
      definition.status = 'retired';
    }

    const entry: any = {
      resource: definition,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `ChargeItemDefinition?identifier=${identifierSystem}|${identifierValue || definition.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `ChargeItemDefinition/${definition.id}`
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

function mapCoding(source?: { system?: string; code?: string; display?: string }) {
  if (!source) return undefined;
  return {
    system: source.system,
    code: source.code,
    display: source.display
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
