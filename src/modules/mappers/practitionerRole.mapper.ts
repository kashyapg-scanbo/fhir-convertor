import crypto from 'crypto';
import practitionerRoleTemplate from '../../shared/templates/practitionerRole.json' with { type: 'json' };
import type { CanonicalPractitionerRole, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';

interface PractitionerRoleMapperArgs {
  practitionerRoles?: CanonicalPractitionerRole[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapPractitionerRoles({
  practitionerRoles,
  operation,
  registry,
  resolveRef
}: PractitionerRoleMapperArgs) {
  if (!practitionerRoles || practitionerRoles.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < practitionerRoles.length; index++) {
    const role = practitionerRoles[index];
    const practitionerRole = structuredClone(practitionerRoleTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = role.id;

    practitionerRole.id = crypto.randomUUID();
    practitionerRole.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;
    const fullUrl = `urn:uuid:${practitionerRole.id}`;
    registry.register(
      'PractitionerRole',
      {
        identifier: role.id || practitionerRole.id,
        id: practitionerRole.id
      },
      fullUrl
    );

    if (role.practitionerId) {
      practitionerRole.practitioner = {
        reference: resolveRef('Practitioner', role.practitionerId)
      };
    } else {
      practitionerRole.practitioner = undefined;
    }
    if (role.organizationId) {
      practitionerRole.organization = {
        reference: resolveRef('Organization', role.organizationId)
      };
    } else {
      practitionerRole.organization = undefined;
    }

    if (role.code) {
      practitionerRole.code = role.code.map((c: any) => ({
        coding: [{
          system: c.system,
          code: c.code,
          display: c.display
        }]
      }));
    } else {
      practitionerRole.code = undefined;
    }

    if (role.specialty) {
      practitionerRole.specialty = role.specialty.map((s: any) => ({
        coding: [{
          system: s.system,
          code: s.code,
          display: s.display
        }]
      }));
    } else {
      practitionerRole.specialty = undefined;
    }

    if (role.period) {
      practitionerRole.period = {
        start: role.period.start || undefined,
        end: role.period.end || undefined
      };
    } else {
      practitionerRole.period = undefined;
    }

    if (operation === 'delete' || role.active === false) {
      practitionerRole.active = false;
    } else if (role.active === true) {
      practitionerRole.active = true;
    } else {
      practitionerRole.active = undefined;
    }

    practitionerRole.location = undefined;
    practitionerRole.healthcareService = undefined;
    practitionerRole.contact = undefined;
    practitionerRole.characteristic = undefined;
    practitionerRole.communication = undefined;
    practitionerRole.availability = undefined;
    practitionerRole.endpoint = undefined;

    const entry: any = {
      resource: practitionerRole,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `PractitionerRole?identifier=${identifierSystem}|${identifierValue || practitionerRole.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `PractitionerRole/${practitionerRole.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
