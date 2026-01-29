import crypto from 'crypto';
import substanceTemplate from '../../shared/templates/substance.json' with { type: 'json' };
import type { CanonicalSubstance, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface SubstanceMapperArgs {
  substances?: CanonicalSubstance[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapSubstances({
  substances,
  operation,
  registry,
  resolveRef
}: SubstanceMapperArgs) {
  if (!substances || substances.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of substances) {
    const substance = structuredClone(substanceTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    substance.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${substance.id}`;
    substance.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'Substance',
      {
        identifier: source.id || source.identifier || substance.id,
        id: substance.id
      },
      fullUrl
    );

    substance.instance = source.instance ?? undefined;
    substance.status = source.status || undefined;
    substance.category = source.category?.length
      ? source.category.map(category => mapCodeableConcept(category))
      : undefined;
    substance.code = source.code ? { concept: mapCodeableConcept(source.code) } : undefined;
    substance.description = source.description || undefined;
    substance.expiry = source.expiry || undefined;
    substance.quantity = source.quantity ? {
      value: source.quantity.value,
      unit: source.quantity.unit
    } : undefined;

    substance.ingredient = source.ingredient?.length
      ? source.ingredient.map(ingredient => ({
        quantity: ingredient.quantity ? {
          numerator: ingredient.quantity.numerator ? {
            value: ingredient.quantity.numerator.value,
            unit: ingredient.quantity.numerator.unit
          } : undefined,
          denominator: ingredient.quantity.denominator ? {
            value: ingredient.quantity.denominator.value,
            unit: ingredient.quantity.denominator.unit
          } : undefined
        } : undefined,
        substanceCodeableConcept: ingredient.substanceCodeableConcept
          ? mapCodeableConcept(ingredient.substanceCodeableConcept)
          : undefined,
        substanceReference: ingredient.substanceReference
          ? { reference: resolveRef('Substance', ingredient.substanceReference) || `Substance/${ingredient.substanceReference}` }
          : undefined
      }))
      : undefined;

    const summary = substance.code?.concept?.text || substance.description || substance.id;
    if (summary) substance.text = makeNarrative('Substance', summary);

    if (operation === 'delete') {
      substance.status = 'entered-in-error';
    }

    const entry: any = {
      resource: substance,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Substance?identifier=${identifierSystem}|${identifierValue || substance.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Substance/${substance.id}`
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
