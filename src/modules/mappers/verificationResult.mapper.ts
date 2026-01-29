import crypto from 'crypto';
import verificationResultTemplate from '../../shared/templates/verificationResult.json' with { type: 'json' };
import type { CanonicalVerificationResult, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface VerificationResultMapperArgs {
  verificationResults?: CanonicalVerificationResult[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapVerificationResults({
  verificationResults,
  operation,
  registry,
  resolveRef
}: VerificationResultMapperArgs) {
  if (!verificationResults || verificationResults.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of verificationResults) {
    const verification = structuredClone(verificationResultTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id;

    verification.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${verification.id}`;

    registry.register(
      'VerificationResult',
      {
        identifier: source.id || verification.id,
        id: verification.id
      },
      fullUrl
    );

    verification.target = source.target?.length
      ? source.target.map(target => ({ reference: resolveRef('Resource', target) || target }))
      : undefined;
    verification.targetLocation = source.targetLocation?.length ? source.targetLocation : undefined;
    verification.need = source.need ? mapCodeableConcept(source.need) : undefined;
    verification.status = source.status || undefined;
    verification.statusDate = source.statusDate || undefined;
    verification.validationType = source.validationType ? mapCodeableConcept(source.validationType) : undefined;
    verification.validationProcess = source.validationProcess?.length
      ? source.validationProcess.map(mapCodeableConcept)
      : undefined;
    verification.frequency = source.frequency?.text ? { text: source.frequency.text } : undefined;
    verification.lastPerformed = source.lastPerformed || undefined;
    verification.nextScheduled = source.nextScheduled || undefined;
    verification.failureAction = source.failureAction ? mapCodeableConcept(source.failureAction) : undefined;

    verification.primarySource = source.primarySource?.length
      ? source.primarySource.map(primary => ({
          who: primary.who ? { reference: resolveRef('Organization', primary.who) || primary.who } : undefined,
          type: primary.type?.length ? primary.type.map(mapCodeableConcept) : undefined,
          communicationMethod: primary.communicationMethod?.length ? primary.communicationMethod.map(mapCodeableConcept) : undefined,
          validationStatus: primary.validationStatus ? mapCodeableConcept(primary.validationStatus) : undefined,
          validationDate: primary.validationDate || undefined,
          canPushUpdates: primary.canPushUpdates ? mapCodeableConcept(primary.canPushUpdates) : undefined,
          pushTypeAvailable: primary.pushTypeAvailable?.length ? primary.pushTypeAvailable.map(mapCodeableConcept) : undefined
        }))
      : undefined;

    verification.attestation = source.attestation ? {
      who: source.attestation.who ? { reference: resolveRef('Organization', source.attestation.who) || source.attestation.who } : undefined,
      onBehalfOf: source.attestation.onBehalfOf ? { reference: resolveRef('Organization', source.attestation.onBehalfOf) || source.attestation.onBehalfOf } : undefined,
      communicationMethod: source.attestation.communicationMethod ? mapCodeableConcept(source.attestation.communicationMethod) : undefined,
      date: source.attestation.date || undefined,
      sourceIdentityCertificate: source.attestation.sourceIdentityCertificate || undefined,
      proxyIdentityCertificate: source.attestation.proxyIdentityCertificate || undefined,
      proxySignature: source.attestation.proxySignature ? { data: source.attestation.proxySignature } : undefined,
      sourceSignature: source.attestation.sourceSignature ? { data: source.attestation.sourceSignature } : undefined
    } : undefined;

    verification.validator = source.validator?.length
      ? source.validator.map(validator => ({
          organization: validator.organization ? { reference: resolveRef('Organization', validator.organization) || validator.organization } : undefined,
          identityCertificate: validator.identityCertificate || undefined,
          attestationSignature: validator.attestationSignature ? { data: validator.attestationSignature } : undefined
        }))
      : undefined;

    const summary = verification.status || verification.id;
    if (summary) verification.text = makeNarrative('VerificationResult', summary);

    if (operation === 'delete') {
      verification.status = 'entered-in-error';
    }

    const entry: any = {
      resource: verification,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `VerificationResult?identifier=${identifierSystem}|${identifierValue || verification.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `VerificationResult/${verification.id}`
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
