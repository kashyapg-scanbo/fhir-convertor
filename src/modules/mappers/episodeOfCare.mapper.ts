import crypto from 'crypto';
import episodeTemplate from '../../shared/templates/episodeOfCare.json' with { type: 'json' };
import type { CanonicalEpisodeOfCare, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface EpisodeOfCareMapperArgs {
  episodesOfCare?: CanonicalEpisodeOfCare[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
}

export function mapEpisodesOfCare({
  episodesOfCare,
  operation,
  registry,
  resolveRef,
  patientFullUrl
}: EpisodeOfCareMapperArgs) {
  if (!episodesOfCare || episodesOfCare.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < episodesOfCare.length; index++) {
    const source = episodesOfCare[index];
    const episode = structuredClone(episodeTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    episode.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${episode.id}`;
    episode.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'EpisodeOfCare',
      {
        identifier: source.id || source.identifier || episode.id,
        id: episode.id
      },
      fullUrl
    );

    episode.status = source.status || 'active';
    episode.statusHistory = source.statusHistory?.length
      ? source.statusHistory
        .map(history => ({
          status: history.status,
          period: history.period ? { start: history.period.start, end: history.period.end } : undefined
        }))
        .filter(history => history.status || history.period)
      : undefined;

    episode.type = source.type?.length
      ? source.type.map(type => mapCodeableConcept(type))
      : undefined;

    episode.reason = source.reason?.length
      ? source.reason
        .map(reason => mapReason(reason.code))
        .filter(Boolean)
      : undefined;

    episode.diagnosis = source.diagnosis?.length
      ? source.diagnosis
        .map(diagnosis => mapDiagnosis(diagnosis.condition))
        .filter(Boolean)
      : undefined;

    const patientReference = resolveRef('Patient', source.patient) || patientFullUrl || (source.patient ? `Patient/${source.patient}` : undefined);
    episode.patient = patientReference ? { reference: patientReference } : undefined;

    episode.managingOrganization = source.managingOrganization
      ? { reference: resolveRef('Organization', source.managingOrganization) || `Organization/${source.managingOrganization}` }
      : undefined;

    episode.period = source.period
      ? { start: source.period.start, end: source.period.end }
      : undefined;

    episode.referralRequest = source.referralRequest?.length
      ? source.referralRequest.map(ref => ({ reference: resolveRef('ServiceRequest', ref) || `ServiceRequest/${ref}` }))
      : undefined;

    episode.careManager = source.careManager
      ? { reference: resolveCareManagerRef(resolveRef, source.careManager) }
      : undefined;

    episode.careTeam = source.careTeam?.length
      ? source.careTeam.map(ref => ({ reference: resolveRef('CareTeam', ref) || `CareTeam/${ref}` }))
      : undefined;

    episode.account = source.account?.length
      ? source.account.map(ref => ({ reference: resolveRef('Account', ref) || `Account/${ref}` }))
      : undefined;

    const summary = episode.status || episode.id;
    if (summary) episode.text = makeNarrative('EpisodeOfCare', summary);

    if (operation === 'delete') {
      episode.status = 'entered-in-error';
    }

    const entry: any = {
      resource: episode,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `EpisodeOfCare?identifier=${identifierSystem}|${identifierValue || episode.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `EpisodeOfCare/${episode.id}`
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

function mapReason(code?: { system?: string; code?: string; display?: string }) {
  if (!code) return undefined;
  const concept = mapCodeableConcept(code);
  return concept ? { value: [{ concept }] } : undefined;
}

function mapDiagnosis(condition?: { system?: string; code?: string; display?: string }) {
  if (!condition) return undefined;
  const concept = mapCodeableConcept(condition);
  return concept ? { condition: [{ concept }] } : undefined;
}

function resolveCareManagerRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;

  return (
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    `Practitioner/${id}`
  );
}
