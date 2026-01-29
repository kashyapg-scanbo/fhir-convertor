import crypto from 'crypto';
import personTemplate from '../../shared/templates/person.json' with { type: 'json' };
import type { CanonicalPerson, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface PersonMapperArgs {
  persons?: CanonicalPerson[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapPersons({
  persons,
  operation,
  registry,
  resolveRef
}: PersonMapperArgs) {
  if (!persons || persons.length === 0) return [];

  const entries: any[] = [];
  for (const source of persons) {
    const person = structuredClone(personTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    person.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${person.id}`;
    person.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'Person',
      {
        identifier: source.id || source.identifier || person.id,
        id: person.id
      },
      fullUrl
    );

    person.active = source.active ?? undefined;
    person.name = source.name ? [{
      family: source.name.family,
      given: source.name.given,
      prefix: source.name.prefix,
      suffix: source.name.suffix
    }] : undefined;
    person.telecom = source.telecom?.map(t => ({
      system: t.system,
      value: t.value,
      use: t.use
    }));
    person.gender = source.gender || undefined;
    person.birthDate = source.birthDate || undefined;
    person.deceasedBoolean = source.deceasedBoolean ?? undefined;
    person.deceasedDateTime = source.deceasedDateTime || undefined;
    person.address = source.address?.map(addr => ({
      line: addr.line,
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country
    }));
    person.maritalStatus = source.maritalStatus ? {
      coding: [{
        system: source.maritalStatus.system,
        code: source.maritalStatus.code,
        display: source.maritalStatus.display
      }].filter(c => c.system || c.code || c.display),
      text: source.maritalStatus.display || source.maritalStatus.code
    } : undefined;
    person.communication = source.communication?.map(c => ({
      language: c.language ? {
        coding: [{
          system: c.language.system,
          code: c.language.code,
          display: c.language.display
        }].filter(coding => coding.system || coding.code || coding.display),
        text: c.language.display || c.language.code
      } : undefined,
      preferred: c.preferred
    }));
    person.managingOrganization = source.managingOrganization
      ? { reference: resolveRef('Organization', source.managingOrganization) || `Organization/${source.managingOrganization}` }
      : undefined;
    person.link = source.link?.map(link => ({
      target: link.target ? { reference: link.target } : undefined,
      assurance: link.assurance
    }));

    const summary = person.name?.[0]?.family || person.id;
    if (summary) person.text = makeNarrative('Person', summary);

    if (operation === 'delete') {
      person.active = false;
    }

    const entry: any = {
      resource: person,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Person?identifier=${identifierSystem}|${identifierValue || person.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Person/${person.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
