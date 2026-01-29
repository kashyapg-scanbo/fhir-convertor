import crypto from 'crypto';
import organizationAffiliationTemplate from '../../shared/templates/organizationAffiliation.json' with { type: 'json' };
import type { CanonicalOrganizationAffiliation, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface OrganizationAffiliationMapperArgs {
  organizationAffiliations?: CanonicalOrganizationAffiliation[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapOrganizationAffiliations({
  organizationAffiliations,
  operation,
  registry,
  resolveRef
}: OrganizationAffiliationMapperArgs) {
  if (!organizationAffiliations || organizationAffiliations.length === 0) return [];

  const entries: any[] = [];
  for (const source of organizationAffiliations) {
    const affiliation = structuredClone(organizationAffiliationTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    affiliation.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${affiliation.id}`;
    affiliation.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'OrganizationAffiliation',
      {
        identifier: source.id || source.identifier || affiliation.id,
        id: affiliation.id
      },
      fullUrl
    );

    affiliation.active = source.active ?? source.activeFlag ?? undefined;
    affiliation.period = source.period ? { start: source.period.start, end: source.period.end } : undefined;
    affiliation.organization = source.organization ? { reference: resolveRef('Organization', source.organization) || `Organization/${source.organization}` } : undefined;
    affiliation.participatingOrganization = source.participatingOrganization
      ? { reference: resolveRef('Organization', source.participatingOrganization) || `Organization/${source.participatingOrganization}` }
      : undefined;
    affiliation.network = source.network?.length
      ? source.network.map(id => ({ reference: resolveRef('Organization', id) || `Organization/${id}` }))
      : undefined;
    affiliation.code = source.code?.length ? source.code.map(mapCodeableConcept) : undefined;
    affiliation.specialty = source.specialty?.length ? source.specialty.map(mapCodeableConcept) : undefined;
    affiliation.location = source.location?.length
      ? source.location.map(id => ({ reference: resolveRef('Location', id) || `Location/${id}` }))
      : undefined;
    affiliation.healthcareService = source.healthcareService?.length
      ? source.healthcareService.map(id => ({ reference: resolveRef('HealthcareService', id) || `HealthcareService/${id}` }))
      : undefined;
    affiliation.contact = source.contact?.length
      ? source.contact.map(c => ({
        name: c.name,
        telecom: c.telecom?.map(t => ({
          system: t.system,
          value: t.value,
          use: t.use
        }))
      }))
      : undefined;
    affiliation.endpoint = source.endpoint?.length
      ? source.endpoint.map(id => ({ reference: resolveRef('Endpoint', id) || `Endpoint/${id}` }))
      : undefined;

    const summary = affiliation.organization?.reference || affiliation.participatingOrganization?.reference || affiliation.id;
    if (summary) affiliation.text = makeNarrative('OrganizationAffiliation', summary);

    if (operation === 'delete') {
      affiliation.active = false;
    }

    const entry: any = {
      resource: affiliation,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `OrganizationAffiliation?identifier=${identifierSystem}|${identifierValue || affiliation.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `OrganizationAffiliation/${affiliation.id}`
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
