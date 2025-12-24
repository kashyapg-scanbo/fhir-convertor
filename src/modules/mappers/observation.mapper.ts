import crypto from 'crypto';
import observationTemplate from '../../shared/templates/observation.json' with { type: 'json' };
import type { CanonicalObservation } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative, mapAbnormalFlag } from './utils.js';

interface ObservationMapperArgs {
  observations?: CanonicalObservation[];
  registry: FullUrlRegistry;
  patientFullUrl: string;
  encounterFullUrl?: string;
}

const loincVitalSigns = new Set([
  '8867-4',
  '9279-1',
  '8310-5',
  '8480-6',
  '8462-4',
  '85354-9',
  '8302-2',
  '3141-9',
  '8331-1',
  '59408-5'
]);

const allowedInterpretationCodes = new Set(['L', 'LL', 'H', 'HH', 'A', 'AA', 'N', 'S', 'R', 'I']);
const ucumUnitMap: Record<string, string> = {
  'beats/min': '/min',
  'beat/min': '/min',
  'bpm': '/min',
  'beats per minute': '/min',
  '/min': '/min'
};

const systolicCode = '8480-6';
const diastolicCode = '8462-4';
const bpPanelCode = '85354-9';

function getPrimaryCoding(obs: CanonicalObservation) {
  return Array.isArray(obs.code) ? obs.code[0] : obs.code;
}

function absoluteSystem(system?: string) {
  if (!system) return undefined;
  return /^https?:\/\//i.test(system) ? system : undefined;
}

function normalizeSystem(system?: string) {
  if (!system) return undefined;
  if (/^https?:\/\//i.test(system)) return system;
  if (system.toUpperCase() === 'LN' || system.toLowerCase().includes('loinc')) return 'http://loinc.org';
  return undefined;
}

function resolveUnitCode(unit?: string, unitCode?: string) {
  const key = (unitCode || unit || '').toLowerCase();
  return ucumUnitMap[key] || unitCode || unit || '1';
}

function buildQuantity(value: string | number, unit?: string, unitCode?: string) {
  return {
    value: Number(value),
    unit: unit || undefined,
    system: 'http://unitsofmeasure.org',
    code: resolveUnitCode(unit, unitCode)
  };
}

export function mapObservations({
  observations,
  registry,
  patientFullUrl,
  encounterFullUrl
}: ObservationMapperArgs) {
  if (!observations || observations.length === 0) {
    return [];
  }

  const usedObservations = new Set<CanonicalObservation>();
  const bpGroups = new Map<string, { systolic?: CanonicalObservation; diastolic?: CanonicalObservation }>();

  observations.forEach(obs => {
    const coding = getPrimaryCoding(obs);
    const code = coding?.code;
    if (code !== systolicCode && code !== diastolicCode) return;
    const key = obs.date || 'unknown-date';
    const group = bpGroups.get(key) || {};
    if (code === systolicCode) group.systolic = obs;
    if (code === diastolicCode) group.diastolic = obs;
    bpGroups.set(key, group);
  });

  const entries: any[] = [];
  bpGroups.forEach(group => {
    if (!group.systolic || !group.diastolic) return;
    const bpResource = structuredClone(observationTemplate) as any;
    bpResource.id = crypto.randomUUID();
    bpResource.status = group.systolic.status || group.diastolic.status || 'final';
    bpResource.subject = { reference: patientFullUrl };
    bpResource.encounter = encounterFullUrl ? { reference: encounterFullUrl } : undefined;
    bpResource.effectiveDateTime = group.systolic.date || group.diastolic.date || new Date().toISOString();
    bpResource.category = [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'vital-signs',
        display: 'Vital Signs'
      }]
    }];
    bpResource.code = {
      coding: [{
        system: 'http://loinc.org',
        code: bpPanelCode,
        display: 'Blood pressure panel with all children optional'
      }]
    };

    const systolicValue = Array.isArray(group.systolic.value)
      ? group.systolic.value[0]
      : group.systolic.value;
    const diastolicValue = Array.isArray(group.diastolic.value)
      ? group.diastolic.value[0]
      : group.diastolic.value;

    bpResource.component = [
      {
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: systolicCode,
            display: 'Systolic blood pressure'
          }]
        },
        valueQuantity: buildQuantity(systolicValue as string | number, group.systolic.unit, group.systolic.unitCode)
      },
      {
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: diastolicCode,
            display: 'Diastolic blood pressure'
          }]
        },
        valueQuantity: buildQuantity(diastolicValue as string | number, group.diastolic.unit, group.diastolic.unitCode)
      }
    ];

    const bpFullUrl = `urn:uuid:${bpResource.id}`;
    registry.register(
      'Observation',
      {
        identifier: String(group.systolic.setId ?? bpResource.id),
        id: bpResource.id
      },
      bpFullUrl
    );

    bpResource.identifier = undefined;
    bpResource.instantiatesCanonical = undefined;
    bpResource.instantiatesReference = undefined;
    bpResource.basedOn = undefined;
    bpResource.triggeredBy = undefined;
    bpResource.partOf = undefined;
    bpResource.focus = undefined;
    bpResource.effectivePeriod = undefined;
    bpResource.effectiveTiming = undefined;
    bpResource.effectiveInstant = undefined;
    bpResource.issued = undefined;
    bpResource.performer = undefined;
    bpResource.valueQuantity = undefined;
    bpResource.valueCodeableConcept = undefined;
    bpResource.valueString = undefined;
    bpResource.valueBoolean = undefined;
    bpResource.valueInteger = undefined;
    bpResource.valueRange = undefined;
    bpResource.valueRatio = undefined;
    bpResource.valueSampledData = undefined;
    bpResource.valueTime = undefined;
    bpResource.valueDateTime = undefined;
    bpResource.valuePeriod = undefined;
    bpResource.valueAttachment = undefined;
    bpResource.valueReference = undefined;
    bpResource.dataAbsentReason = undefined;
    bpResource.interpretation = undefined;
    bpResource.note = undefined;
    bpResource.bodySite = undefined;
    bpResource.bodyStructure = undefined;
    bpResource.method = undefined;
    bpResource.specimen = undefined;
    bpResource.device = undefined;
    bpResource.referenceRange = undefined;
    bpResource.hasMember = undefined;
    bpResource.derivedFrom = undefined;

    entries.push({ resource: bpResource, fullUrl: bpFullUrl });
    usedObservations.add(group.systolic);
    usedObservations.add(group.diastolic);
  });

  for (let index = 0; index < observations.length; index++) {
    const obs = observations[index];
    if (usedObservations.has(obs)) {
      continue;
    }
    const resource = structuredClone(observationTemplate) as any;

    resource.id = crypto.randomUUID();
    resource.category = undefined;
    resource.component = undefined;
    if (obs.setId) {
      resource.identifier = [{ system: 'urn:hl7-org:v2', value: String(obs.setId) }];
    } else {
      resource.identifier = undefined;
    }

    resource.subject = { reference: patientFullUrl };
    if (encounterFullUrl) {
      resource.encounter = { reference: encounterFullUrl };
    } else {
      resource.encounter = undefined;
    }

    const primaryCode = getPrimaryCoding(obs);
    const obsSummary = primaryCode?.code || primaryCode?.display || '';
    if (obsSummary) resource.text = makeNarrative('Observation', String(obsSummary));

    resource.status = obs.status || 'final';
    resource.effectiveDateTime = obs.date || new Date().toISOString();

    if (obs.code) {
      const codes = Array.isArray(obs.code) ? obs.code : [obs.code];
      resource.code = {
        coding: codes.map((coding: any) => {
          const result: any = {
            system: normalizeSystem(coding.system) || 'http://loinc.org',
            code: coding.code || ''
          };
          if (coding.display && !result.system.includes('loinc')) {
            result.display = coding.display;
          }
          return result;
        })
      };
    } else {
      resource.code = undefined;
    }

    if (obs.value !== undefined) {
      if (Array.isArray(obs.value)) {
        const firstValue = obs.value.find(v => v !== undefined && v !== null);
        if (firstValue !== undefined) {
          resource.valueQuantity = buildQuantity(firstValue, obs.unit, obs.unitCode);
        }
        if (obs.value.length > 1) {
          if (!resource.note) resource.note = [];
          resource.note.push({
            text: `Additional values: ${obs.value.slice(1).join(', ')}`
          });
        }
      } else if (obs.valueType === 'CWE') {
        resource.valueCodeableConcept = {
          coding: [{
            system: normalizeSystem(obs.unitSystem),
            code: String(obs.value),
            display: obs.unit
          }]
        };
      } else {
        const valueType = obs.valueType || 'NM';
        if (valueType === 'NM' || valueType === 'SN' || !isNaN(Number(obs.value))) {
          resource.valueQuantity = buildQuantity(obs.value as string | number, obs.unit, obs.unitCode);
        } else {
          resource.valueString = String(obs.value);
        }
      }
    }

    if (obs.referenceRange) {
      resource.referenceRange = [{
        text: obs.referenceRange
      }];
    }

    if (!resource.interpretation) resource.interpretation = [];
    const interpretationSet = new Set<string>();

    if (obs.abnormalFlags && obs.abnormalFlags.length > 0) {
      obs.abnormalFlags.forEach((flag: string) => {
        if (!flag || interpretationSet.has(flag)) return;
        const upper = flag.toUpperCase();
        if (!allowedInterpretationCodes.has(upper)) return;
        interpretationSet.add(upper);
        resource.interpretation.push({
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: upper,
            display: mapAbnormalFlag(upper)
          }]
        });
      });
    }

    if (obs.interpretation && obs.interpretation.length > 0) {
      obs.interpretation.forEach((interp: string) => {
        if (!interp || interpretationSet.has(interp)) return;
        const upper = interp.toUpperCase();
        if (!allowedInterpretationCodes.has(upper)) return;
        interpretationSet.add(upper);
        resource.interpretation.push({
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: upper,
            display: mapAbnormalFlag(upper)
          }]
        });
      });
    }

    if (obs.method) {
      resource.method = {
        coding: [{
          code: obs.method.code || '',
          display: obs.method.description || ''
        }]
      };
    }

    if (obs.observer && obs.observer.length > 0) {
      const performers = obs.observer
        .map((observer: any) => ({
          display: observer.name || (observer.id ? `ID: ${observer.id}` : undefined),
          identifier: observer.id ? {
            value: observer.id,
            system: 'urn:hl7-org:v2'
          } : undefined
        }))
        .filter((p: any) => p.display || p.identifier);
      if (performers.length > 0) {
        resource.performer = performers;
      }
    }

    if (obs.device) {
      const identifiers = [];
      if (obs.device.uid) {
        identifiers.push({
          system: 'urn:ietf:rfc:4122',
          value: obs.device.uid
        });
      }
      if (obs.device.oid) {
        identifiers.push({
          system: `urn:oid:${obs.device.oid}`,
          value: obs.device.oid
        });
      }
      if (identifiers.length > 0) {
        resource.device = { identifier: identifiers[0] };
      }
    }

    if (obs.site) {
      resource.bodySite = {
        coding: [{
          code: obs.site.code || '',
          display: obs.site.display || ''
        }]
      };
    }

    if (obs.performerOrganization) {
      if (!resource.performer) resource.performer = [];
      const orgPerformer: any = {
        display: obs.performerOrganization.name || undefined
      };
      if (obs.performerOrganization.name) {
        orgPerformer.identifier = {
          system: 'urn:hl7-org:v2',
          value: obs.performerOrganization.name
        };
      }
      if (orgPerformer.display || orgPerformer.identifier) {
        resource.performer.push(orgPerformer);
      }

      if (obs.performerOrganization.address) {
        if (!resource.note) resource.note = [];
        resource.note.push({
          text: `Organization Address: ${[
            obs.performerOrganization.address.city,
            obs.performerOrganization.address.state,
            obs.performerOrganization.address.postalCode,
            obs.performerOrganization.address.country
          ].filter(Boolean).join(', ')}`
        });
      }
    }

    if (obs.producer) {
      if (!resource.note) resource.note = [];
      resource.note.push({
        text: `Producer: ${obs.producer.organizationId || ''} (${obs.producer.system || ''})`
      });
    }

    if (obs.category) {
      const categories = obs.category
        .map((cat: any) => {
          if (!cat.code) return null;
          return {
            coding: [{
              system: absoluteSystem(cat.system),
              code: cat.code,
              display: cat.display
            }]
          };
        })
        .filter(Boolean);
      if (categories.length > 0) resource.category = categories;
    }

    const primaryCoding = Array.isArray(resource.code?.coding) ? resource.code.coding[0] : null;
    if ((!resource.category || resource.category.length === 0) && primaryCoding) {
      const sys = String(primaryCoding.system || '').toLowerCase();
      const code = String(primaryCoding.code || '');
      if ((sys.includes('loinc') && loincVitalSigns.has(code)) ||
        /heart|pulse|temperature|respiratory|blood pressure|bp|oxygen/i.test(String(primaryCoding.display || ''))) {
        resource.category = [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }]
        }];
      }
    }

    if (obs.components) {
      resource.component = obs.components
        .map((c: any) => {
          if (!c.code?.code) return null;
          return {
            code: {
              coding: [{
                system: absoluteSystem(c.code.system),
                code: c.code.code,
                display: c.code.display
              }]
            },
            valueCodeableConcept: c.valueCodeableConcept
              ? { coding: [c.valueCodeableConcept] }
              : undefined
          };
        })
        .filter(Boolean);
    }

    const obsFullUrl = `urn:uuid:${resource.id}`;
    registry.register(
      'Observation',
      {
        identifier: String(obs.setId ?? resource.id),
        id: resource.id
      },
      obsFullUrl
    );

    resource.instantiatesCanonical = undefined;
    resource.instantiatesReference = undefined;
    resource.basedOn = undefined;
    resource.triggeredBy = undefined;
    resource.partOf = undefined;
    resource.focus = undefined;
    resource.effectivePeriod = undefined;
    resource.effectiveTiming = undefined;
    resource.effectiveInstant = undefined;
    resource.issued = undefined;
    resource.dataAbsentReason = undefined;
    resource.bodyStructure = undefined;
    resource.specimen = undefined;
    resource.hasMember = undefined;
    resource.derivedFrom = undefined;
    if (!resource.note?.length) resource.note = undefined;
    if (!resource.interpretation?.length) resource.interpretation = undefined;
    if (!resource.category?.length) resource.category = undefined;
    if (!resource.referenceRange?.length) resource.referenceRange = undefined;
    if (!resource.performer?.length) resource.performer = undefined;
    if (!resource.component?.length) resource.component = undefined;

    if (!resource.valueQuantity) resource.valueQuantity = undefined;
    if (!resource.valueCodeableConcept) resource.valueCodeableConcept = undefined;
    if (!resource.valueString) resource.valueString = undefined;
    resource.valueBoolean = undefined;
    resource.valueInteger = undefined;
    resource.valueRange = undefined;
    resource.valueRatio = undefined;
    resource.valueSampledData = undefined;
    resource.valueTime = undefined;
    resource.valueDateTime = undefined;
    resource.valuePeriod = undefined;
    resource.valueAttachment = undefined;
    resource.valueReference = undefined;

    entries.push({ resource, fullUrl: obsFullUrl });
  }

  return entries;
}
