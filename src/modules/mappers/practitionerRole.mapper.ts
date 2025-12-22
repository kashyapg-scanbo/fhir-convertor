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

    practitionerRole.id = crypto.randomUUID();
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
      practitionerRole.practitioner.reference = resolveRef('Practitioner', role.practitionerId);
    }
    if (role.organizationId) {
      practitionerRole.organization.reference = resolveRef('Organization', role.organizationId);
    }

    if (role.code) {
      practitionerRole.code = role.code.map((c: any) => ({
        coding: [{
          system: c.system,
          code: c.code,
          display: c.display
        }]
      }));
    }

    if (role.period) {
      practitionerRole.period.start = role.period.start || '';
      practitionerRole.period.end = role.period.end || '';
    }

    if (operation === 'delete' || role.active === false) {
      practitionerRole.active = false;
    }

    const entry: any = {
      resource: practitionerRole,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `PractitionerRole?identifier=urn:hl7-org:v2|${practitionerRole.id}`
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
