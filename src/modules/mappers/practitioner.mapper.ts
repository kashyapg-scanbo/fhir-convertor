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
    const identifierSystem = 'urn:hl7-org:v2';

    practitioner.id = crypto.randomUUID();
    const identifierValue = practitionerSource.identifier || practitionerSource.id || practitioner.id;
    practitioner.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    const fullUrl = `urn:uuid:${practitioner.id}`;
    registry.register(
      'Practitioner',
      {
        identifier: identifierValue,
        id: practitioner.id
      },
      fullUrl
    );

    const pracName = practitionerSource.name?.family || '';
    if (pracName) practitioner.text = makeNarrative('Practitioner', pracName);

    const hasNameData = Boolean(
      practitionerSource.name?.family
      || practitionerSource.name?.given?.length
      || practitionerSource.name?.prefix?.length
      || practitionerSource.name?.suffix?.length
    );
    practitioner.name = hasNameData ? [{
      family: practitionerSource.name?.family,
      given: practitionerSource.name?.given,
      prefix: practitionerSource.name?.prefix,
      suffix: practitionerSource.name?.suffix
    }] : undefined;

    practitioner.gender = practitionerSource.gender || undefined;
    practitioner.birthDate = practitionerSource.birthDate || undefined;
    practitioner.address = practitionerSource.address?.length ? practitionerSource.address : undefined;
    practitioner.telecom = practitionerSource.telecom?.length ? practitionerSource.telecom : undefined;
    practitioner.deceasedBoolean = undefined;
    practitioner.deceasedDateTime = undefined;
    practitioner.photo = undefined;
    practitioner.communication = undefined;

    if (practitionerSource.qualification?.length) {
      practitioner.qualification = practitionerSource.qualification.map((q: any) => ({
        code: {
          coding: [{
            system: q.code?.system,
            code: q.code?.code,
            display: q.code?.display
          }]
        }
      }));
    } else {
      practitioner.qualification = undefined;
    }

    if (operation === 'delete' || practitionerSource.active === false) {
      practitioner.active = false;
    } else if (practitionerSource.active === true) {
      practitioner.active = true;
    } else {
      practitioner.active = undefined;
    }

    const entry: any = {
      resource: practitioner,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Practitioner?identifier=${identifierSystem}|${identifierValue}`
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
