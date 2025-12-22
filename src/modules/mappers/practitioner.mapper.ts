import crypto from 'crypto';
import practitionerTemplate from '../../shared/templates/practitioner.json' with { type: 'json' };
import type { CanonicalPractitioner, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface PractitionerMapperArgs {
  practitioners?: CanonicalPractitioner[];
  operation?: OperationType;
  registry: FullUrlRegistry;
}

export function mapPractitioners({
  practitioners,
  operation,
  registry
}: PractitionerMapperArgs) {
  if (!practitioners || practitioners.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < practitioners.length; index++) {
    const practitionerSource = practitioners[index];
    const practitioner = structuredClone(practitionerTemplate) as any;

    practitioner.id = crypto.randomUUID();
    practitioner.identifier[0].value = practitionerSource.identifier || practitionerSource.id || practitioner.id;

    const fullUrl = `urn:uuid:${practitioner.id}`;
    registry.register(
      'Practitioner',
      {
        identifier: practitioner.identifier[0].value,
        id: practitioner.id
      },
      fullUrl
    );

    const pracName = practitionerSource.name?.family || practitioner.name?.[0]?.family || '';
    if (pracName) practitioner.text = makeNarrative('Practitioner', pracName);

    if (practitionerSource.name) {
      practitioner.name[0].family = practitionerSource.name.family || '';
      practitioner.name[0].given = practitionerSource.name.given || [];
      practitioner.name[0].prefix = practitionerSource.name.prefix || [];
      practitioner.name[0].suffix = practitionerSource.name.suffix || [];
    }

    practitioner.gender = practitionerSource.gender || 'unknown';
    practitioner.birthDate = practitionerSource.birthDate || '';
    practitioner.address = practitionerSource.address || [];
    practitioner.telecom = practitionerSource.telecom || [];

    if (operation === 'delete' || practitionerSource.active === false) {
      practitioner.active = false;
    }

    const entry: any = {
      resource: practitioner,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Practitioner?identifier=${practitionerTemplate.identifier[0].system}|${practitioner.identifier[0].value}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Practitioner/${practitionerSource.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
