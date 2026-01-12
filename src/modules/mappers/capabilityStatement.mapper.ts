import crypto from 'crypto';
import capabilityStatementTemplate from '../../shared/templates/capabilityStatement.json' with { type: 'json' };
import type { CanonicalCapabilityStatement, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface CapabilityStatementMapperArgs {
  capabilityStatements?: CanonicalCapabilityStatement[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapCapabilityStatements({
  capabilityStatements,
  operation,
  registry,
  resolveRef
}: CapabilityStatementMapperArgs) {
  if (!capabilityStatements || capabilityStatements.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < capabilityStatements.length; index++) {
    const source = capabilityStatements[index];
    const capabilityStatement = structuredClone(capabilityStatementTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier?.[0] || source.url;

    capabilityStatement.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${capabilityStatement.id}`;
    capabilityStatement.identifier = source.identifier?.length
      ? source.identifier.map(value => ({ system: identifierSystem, value }))
      : undefined;

    registry.register(
      'CapabilityStatement',
      {
        identifier: source.url || source.identifier?.[0] || capabilityStatement.id,
        id: capabilityStatement.id
      },
      fullUrl
    );

    capabilityStatement.url = source.url || undefined;
    capabilityStatement.version = source.version || undefined;
    capabilityStatement.versionAlgorithmString = source.versionAlgorithmString || undefined;
    capabilityStatement.versionAlgorithmCoding = source.versionAlgorithmCoding
      ? mapCoding(source.versionAlgorithmCoding)
      : undefined;
    capabilityStatement.name = source.name || undefined;
    capabilityStatement.title = source.title || undefined;
    capabilityStatement.status = source.status || 'active';
    capabilityStatement.experimental = source.experimental ?? undefined;
    capabilityStatement.date = source.date || undefined;
    capabilityStatement.publisher = source.publisher || undefined;
    capabilityStatement.contact = source.contact?.length
      ? source.contact.map(contact => ({
        name: contact.name,
        telecom: contact.telecom?.map(t => ({
          system: t.system,
          value: t.value,
          use: t.use
        }))
      }))
      : undefined;
    capabilityStatement.description = source.description || undefined;
    capabilityStatement.useContext = source.useContext?.length
      ? source.useContext.map(ctx => ({
        code: ctx.code ? mapCodeableConcept(ctx.code) : undefined,
        value: ctx.value ? { value: ctx.value } : undefined
      }))
      : undefined;
    capabilityStatement.jurisdiction = source.jurisdiction?.length
      ? source.jurisdiction.map(mapCodeableConcept)
      : undefined;
    capabilityStatement.purpose = source.purpose || undefined;
    capabilityStatement.copyright = source.copyright || undefined;
    capabilityStatement.copyrightLabel = source.copyrightLabel || undefined;
    capabilityStatement.kind = source.kind || undefined;
    capabilityStatement.instantiates = source.instantiates?.length ? source.instantiates : undefined;
    capabilityStatement.imports = source.imports?.length ? source.imports : undefined;
    capabilityStatement.software = source.software ? {
      name: source.software.name,
      version: source.software.version,
      releaseDate: source.software.releaseDate
    } : undefined;
    capabilityStatement.implementation = source.implementation ? {
      description: source.implementation.description,
      url: source.implementation.url,
      custodian: source.implementation.custodian
        ? { reference: resolveRef('Organization', source.implementation.custodian) || `Organization/${source.implementation.custodian}` }
        : undefined
    } : undefined;
    capabilityStatement.fhirVersion = source.fhirVersion || undefined;
    capabilityStatement.format = source.format?.length ? source.format : undefined;
    capabilityStatement.patchFormat = source.patchFormat?.length ? source.patchFormat : undefined;
    capabilityStatement.acceptLanguage = source.acceptLanguage?.length ? source.acceptLanguage : undefined;
    capabilityStatement.implementationGuide = source.implementationGuide?.length ? source.implementationGuide : undefined;
    capabilityStatement.rest = source.rest?.length
      ? source.rest.map(rest => ({
        mode: rest.mode,
        documentation: rest.documentation
      }))
      : undefined;
    capabilityStatement.messaging = source.messaging?.length
      ? source.messaging.map(msg => ({
        endpoint: msg.endpoint?.map(endpoint => ({
          protocol: endpoint.protocol ? mapCoding(endpoint.protocol) : undefined,
          address: endpoint.address
        })),
        documentation: msg.documentation
      }))
      : undefined;
    capabilityStatement.document = source.document?.length
      ? source.document.map(doc => ({
        mode: doc.mode,
        documentation: doc.documentation,
        profile: doc.profile
      }))
      : undefined;

    const summary = capabilityStatement.title || capabilityStatement.name || capabilityStatement.url;
    if (summary) capabilityStatement.text = makeNarrative('CapabilityStatement', summary);

    if (operation === 'delete') {
      capabilityStatement.status = 'retired';
    }

    const entry: any = {
      resource: capabilityStatement,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `CapabilityStatement?identifier=${identifierSystem}|${identifierValue || capabilityStatement.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `CapabilityStatement/${capabilityStatement.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}

function mapCoding(source?: { system?: string; code?: string; display?: string }) {
  if (!source) return undefined;
  return {
    system: source.system,
    code: source.code,
    display: source.display
  };
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
