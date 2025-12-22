import crypto from 'crypto';
import organizationTemplate from '../../shared/templates/organization.json' with { type: 'json' };
import type { CanonicalOrganization, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface OrganizationMapperArgs {
  organizations?: CanonicalOrganization[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapOrganizations({
  organizations,
  operation,
  registry,
  resolveRef
}: OrganizationMapperArgs) {
  if (!organizations || organizations.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < organizations.length; index++) {
    const source = organizations[index];
    const organization = structuredClone(organizationTemplate) as any;

    organization.id = crypto.randomUUID();
    organization.identifier[0].value = source.identifier || source.id || organization.id;
    organization.name = source.name || '';
    organization.alias = source.alias || [];
    if ((source.telecom && source.telecom.length > 0) || (source.address && source.address.length > 0)) {
      organization.contact = [{
        telecom: source.telecom || [],
        address: source.address || []
      }];
    }

    const fullUrl = `urn:uuid:${organization.id}`;
    registry.register(
      'Organization',
      {
        identifier: organization.identifier[0].value,
        id: organization.id
      },
      fullUrl
    );

    if (organization.name) {
      organization.text = makeNarrative('Organization', organization.name);
    }

    if (source.type) {
      organization.type = source.type.map((t: any) => ({
        coding: [{
          system: t.system,
          code: t.code,
          display: t.display
        }]
      }));
    }

    if (source.partOf) {
      organization.partOf.reference = resolveRef('Organization', source.partOf) || `Organization/${source.partOf}`;
    }

    if (operation === 'delete' || source.active === false) {
      organization.active = false;
    }

    const entry: any = {
      resource: organization,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Organization?identifier=${organizationTemplate.identifier[0].system}|${organization.identifier[0].value}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Organization/${organization.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
