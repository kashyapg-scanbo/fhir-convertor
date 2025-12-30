
import { XMLParser } from 'fast-xml-parser';
import {
    CanonicalModel,
    CanonicalPatient,
    CanonicalEncounter,
    CanonicalPractitioner,
    CanonicalPractitionerRole,
    CanonicalOrganization,
    CanonicalObservation,
    CanonicalMedication,
    CanonicalMedicationRequest
} from '../../shared/types/canonical.types.js';

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text'
});

/**
 * Parse generic HL7 v3 XML messages (PRPA, etc.) into Canonical Model
 * Note: This is a best-effort parser for generic V3 messages
 */
export function parseHL7v3(input: string): CanonicalModel {
    let xml: any;
    try {
        xml = parser.parse(input);
    } catch (e) {
        throw new Error('Invalid XML input for HL7v3 parser');
    }

    // Detect root element name (skip XML declarations / processing instructions)
    const rootKey = Object.keys(xml).find(key => !key.startsWith('?'));
    const root = rootKey ? xml[rootKey] : undefined;

    if (!root) {
        throw new Error('Empty or invalid HL7v3 message');
    }

    const model: CanonicalModel = {
        messageType: rootKey,
        patient: { name: {} }, // Default
        observations: [],
        medications: [],
        medicationRequests: [],
        practitioners: [],
        practitionerRoles: [],
        organizations: [],
        documentReferences: [],
        allergies: [],
        diagnoses: []
    };

    const controlAct = root.controlActProcess || root.ControlActProcess;
    if (controlAct) {
        const subject = controlAct.subject || controlAct.Subject;
        const subjects = Array.isArray(subject) ? subject : [subject];

        for (const sub of subjects) {
            if (!sub) continue;

            const registrationEvent = sub.registrationEvent || sub.RegistrationEvent;
            if (registrationEvent) {
                const ptSubject = registrationEvent.subject1 || registrationEvent.Subject1;
                const patient = ptSubject?.patient || ptSubject?.Patient;
                if (patient) {
                    model.patient = mapV3Patient(patient);
                }

                const custodian = registrationEvent.custodian || registrationEvent.Custodian;
                if (custodian) {
                    const org = mapV3Organization(custodian);
                    if (org) model.organizations?.push(org);
                }
            }

            const encounterEvent = sub.encounterEvent || sub.EncounterEvent;
                if (encounterEvent) {
                    const encounter = mapV3Encounter(encounterEvent);
                    if (encounter) model.encounter = encounter;

                    const responsibleParty = encounterEvent.responsibleParty || encounterEvent.ResponsibleParty;
                    if (responsibleParty) {
                        const pract = mapV3PractitionerFromResponsible(responsibleParty);
                        if (pract) model.practitioners?.push(pract);

                        const role = mapV3PractitionerRoleFromResponsible(responsibleParty);
                        if (role) model.practitionerRoles?.push(role);
                    }
                }

            const observationEvent = sub.observationEvent || sub.ObservationEvent;
            if (observationEvent) {
                const obs = mapV3Observation(observationEvent);
                if (obs) model.observations?.push(obs);
            }

            const substanceAdministration = sub.substanceAdministration || sub.SubstanceAdministration;
            if (substanceAdministration) {
                const { medication, medicationRequest } = mapV3Medication(substanceAdministration);
                if (medication) model.medications?.push(medication);
                if (medicationRequest) model.medicationRequests?.push(medicationRequest);
            }
        }
    }

    const author = root.author || root.Author;
    if (author) {
        const authors = Array.isArray(author) ? author : [author];
        for (const auth of authors) {
            const assignedAuthor = auth.assignedAuthor || auth.AssignedAuthor;
            if (assignedAuthor) {
                const pract = mapV3Practitioner(assignedAuthor);
                if (pract) model.practitioners?.push(pract);

                const org = mapV3OrganizationFromAssigned(assignedAuthor);
                if (org) model.organizations?.push(org);

                const role = mapV3PractitionerRoleFromAssigned(assignedAuthor);
                if (role) model.practitionerRoles?.push(role);
            }
        }
    }

    return model;
}

function mapV3Patient(pt: any): CanonicalPatient {
    const person = pt.patientPerson || pt.PatientPerson;
    const name = person?.name || person?.Name;
    const addr = pt.addr || pt.Addr;
    const telecom = pt.telecom || pt.Telecom;

    let family = '';
    let given: string[] = [];

    if (Array.isArray(name)) {
        const primaryName = name[0];
        family = extractText(primaryName?.family || primaryName?.Family);
        const givenParts = primaryName?.given || primaryName?.Given;
        given = Array.isArray(givenParts)
            ? givenParts.map(extractText).filter(Boolean)
            : givenParts ? [extractText(givenParts)] : [];
    } else if (name) {
        family = extractText(name.family || name.Family);
        const givenParts = name.given || name.Given;
        given = Array.isArray(givenParts)
            ? givenParts.map(extractText).filter(Boolean)
            : givenParts ? [extractText(givenParts)] : [];
    }

    const ids = pt.id || pt.Id;
    const idInfo = pickV3Id(ids);
    const genderCode = person?.administrativeGenderCode?.['@_code'];

    return {
        id: idInfo.id,
        identifier: idInfo.identifier,
        name: {
            family: family,
            given: given
        },
        gender: mapGenderCode(genderCode),
        birthDate: formatV3Date(person?.birthTime?.['@_value']),
        address: addr ? mapV3Addresses(addr) : undefined,
        telecom: telecom ? mapV3Telecom(telecom) : undefined,
        active: pt.statusCode?.['@_code'] === 'active'
    };
}

function mapV3Encounter(encounterEvent: any): CanonicalEncounter | undefined {
    const ids = encounterEvent.id || encounterEvent.Id;
    const idInfo = pickV3Id(ids);

    const code = encounterEvent.code || encounterEvent.Code;
    const encounterClass = code?.['@_code'];

    const effectiveTime = encounterEvent.effectiveTime || encounterEvent.EffectiveTime;
    const startTime = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];

    const location = encounterEvent.location || encounterEvent.Location;
    const facility = location?.healthCareFacility || location?.HealthCareFacility;
    const locationDetail = facility?.location || facility?.Location;

    let locationStr = '';
    if (locationDetail) {
        const parts = [];
        if (locationDetail.pointOfCare) parts.push(extractText(locationDetail.pointOfCare));
        if (locationDetail.room) parts.push('Room ' + extractText(locationDetail.room));
        if (locationDetail.bed) parts.push('Bed ' + extractText(locationDetail.bed));
        locationStr = parts.join(', ');
    }

    const status = mapEncounterStatus(encounterEvent.statusCode?.['@_code']);
    const responsibleParty = encounterEvent.responsibleParty || encounterEvent.ResponsibleParty;
    const assignedEntity = responsibleParty?.assignedEntity || responsibleParty?.AssignedEntity;
    const assignedEntityIdInfo = assignedEntity ? pickV3Id(assignedEntity.id || assignedEntity.Id) : { id: undefined, identifier: undefined };
    const representedOrg = assignedEntity?.representedOrganization || assignedEntity?.RepresentedOrganization;
    const representedOrgIdInfo = representedOrg ? pickV3Id(representedOrg.id || representedOrg.Id) : { id: undefined, identifier: undefined };
    const participantId = assignedEntityIdInfo.identifier || assignedEntityIdInfo.id;

    return {
        id: idInfo.id,
        class: mapEncounterClass(encounterClass),
        status: status,
        start: formatV3DateTime(startTime),
        location: locationStr || undefined,
        participantPractitionerIds: participantId ? [participantId] : undefined,
        serviceProviderOrganizationId: representedOrgIdInfo.identifier || representedOrgIdInfo.id
    };
}

function mapV3Practitioner(assignedAuthor: any): CanonicalPractitioner | undefined {
    const person = assignedAuthor.assignedPerson || assignedAuthor.AssignedPerson;
    if (!person) return undefined;

    const name = person.name || person.Name;
    const ids = assignedAuthor.id || assignedAuthor.Id;
    const idInfo = pickV3Id(ids);
    const telecom = assignedAuthor.telecom || assignedAuthor.Telecom;
    const addr = assignedAuthor.addr || assignedAuthor.Addr;

    let family = '';
    let given: string[] = [];
    let prefix: string[] = [];
    let suffix: string[] = [];

    if (name) {
        family = extractText(name.family || name.Family);
        const givenParts = name.given || name.Given;
        given = Array.isArray(givenParts)
            ? givenParts.map(extractText).filter(Boolean)
            : givenParts ? [extractText(givenParts)] : [];
        const prefixParts = name.prefix || name.Prefix;
        prefix = Array.isArray(prefixParts)
            ? prefixParts.map(extractText).filter(Boolean)
            : prefixParts ? [extractText(prefixParts)] : [];
        const suffixParts = name.suffix || name.Suffix;
        suffix = Array.isArray(suffixParts)
            ? suffixParts.map(extractText).filter(Boolean)
            : suffixParts ? [extractText(suffixParts)] : [];
    }

    return {
        id: idInfo.id,
        identifier: idInfo.identifier,
        name: {
            family: family,
            given: given,
            prefix: prefix,
            suffix: suffix
        },
        telecom: telecom ? mapV3Telecom(telecom) : undefined,
        address: addr ? mapV3Addresses(addr) : undefined
    };
}

function mapV3PractitionerFromResponsible(responsibleParty: any): CanonicalPractitioner | undefined {
    const assignedEntity = responsibleParty.assignedEntity || responsibleParty.AssignedEntity;
    if (!assignedEntity) return undefined;

    const person = assignedEntity.assignedPerson || assignedEntity.AssignedPerson;
    if (!person) return undefined;

    const name = person.name || person.Name;
    const ids = assignedEntity.id || assignedEntity.Id;
    const idInfo = pickV3Id(ids);
    const telecom = assignedEntity.telecom || assignedEntity.Telecom;
    const addr = assignedEntity.addr || assignedEntity.Addr;

    let family = '';
    let given: string[] = [];
    let prefix: string[] = [];
    let suffix: string[] = [];

    if (name) {
        family = extractText(name.family || name.Family);
        const givenParts = name.given || name.Given;
        given = Array.isArray(givenParts)
            ? givenParts.map(extractText).filter(Boolean)
            : givenParts ? [extractText(givenParts)] : [];
        const prefixParts = name.prefix || name.Prefix;
        prefix = Array.isArray(prefixParts)
            ? prefixParts.map(extractText).filter(Boolean)
            : prefixParts ? [extractText(prefixParts)] : [];
        const suffixParts = name.suffix || name.Suffix;
        suffix = Array.isArray(suffixParts)
            ? suffixParts.map(extractText).filter(Boolean)
            : suffixParts ? [extractText(suffixParts)] : [];
    }

    return {
        id: idInfo.id,
        identifier: idInfo.identifier,
        name: {
            family: family,
            given: given,
            prefix: prefix,
            suffix: suffix
        },
        telecom: telecom ? mapV3Telecom(telecom) : undefined,
        address: addr ? mapV3Addresses(addr) : undefined
    };
}

function mapV3Organization(custodian: any): CanonicalOrganization | undefined {
    const assignedCustodian = custodian.assignedCustodian || custodian.AssignedCustodian;
    const org = assignedCustodian?.representedCustodianOrganization ||
        assignedCustodian?.RepresentedCustodianOrganization;

    if (!org) return undefined;
    return mapV3OrganizationNode(org);
}

function mapV3OrganizationFromAssigned(assignedAuthor: any): CanonicalOrganization | undefined {
    const org = assignedAuthor.representedOrganization || assignedAuthor.RepresentedOrganization;
    if (!org) return undefined;

    return mapV3OrganizationNode(org);
}

function mapV3Observation(obsEvent: any): CanonicalObservation | undefined {
    const obs = obsEvent.observation || obsEvent.Observation;
    if (!obs) return undefined;

    const code = obs.code || obs.Code;
    const value = obs.value || obs.Value;
    const effectiveTime = obs.effectiveTime || obs.EffectiveTime;
    const performer = obs.performer || obs.Performer;
    const method = obs.methodCode || obs.MethodCode;
    const targetSite = obs.targetSiteCode || obs.TargetSiteCode;

    return {
        code: {
            system: code?.['@_codeSystem'],
            code: code?.['@_code'],
            display: code?.['@_displayName']
        },
        value: readV3Value(value),
        unit: value?.['@_unit'],
        status: 'final',
        date: formatV3DateTime(effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value']),
        method: method ? {
            code: method?.['@_code'],
            description: method?.['@_displayName']
        } : undefined,
        site: targetSite ? {
            code: targetSite?.['@_code'],
            display: targetSite?.['@_displayName']
        } : undefined,
        observer: mapV3Observers(performer)
    };
}

function mapV3Medication(substanceAdmin: any): { medication?: CanonicalMedication, medicationRequest?: CanonicalMedicationRequest } {
    const consumable = substanceAdmin.consumable || substanceAdmin.Consumable;
    const manufacturedProduct = consumable?.manufacturedProduct || consumable?.ManufacturedProduct;
    const manufacturedMaterial = manufacturedProduct?.manufacturedMaterial || manufacturedProduct?.ManufacturedMaterial;
    const code = manufacturedMaterial?.code || manufacturedMaterial?.Code;

    const medCode = code?.['@_code'];
    const medDisplay = code?.['@_displayName'];

    if (!medCode) return {};

    const medication: CanonicalMedication = {
        id: medCode,
        identifier: medCode,
        code: {
            coding: [{
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: medCode,
                display: medDisplay
            }],
            text: medDisplay
        }
    };

    const medicationRequest: CanonicalMedicationRequest = {
        id: `MEDREQ-${medCode}`,
        status: 'active',
        intent: 'order',
        medicationReference: medCode
    };

    const dose = substanceAdmin.doseQuantity || substanceAdmin.DoseQuantity;
    const route = substanceAdmin.routeCode || substanceAdmin.RouteCode;
    const timing = substanceAdmin.effectiveTime || substanceAdmin.EffectiveTime;
    if (dose || route || timing) {
        const doseQuantity = dose ? {
            value: dose?.['@_value'] ? Number(dose['@_value']) : undefined,
            unit: dose?.['@_unit']
        } : undefined;
        medicationRequest.dosageInstruction = [{
            text: buildV3DoseText(dose, route),
            timing: timing ? { event: [formatV3DateTime(timing?.['@_value'] || timing?.low?.['@_value'])].filter(Boolean) } : undefined,
            doseQuantity: doseQuantity,
            route: route ? {
                coding: [{
                    code: route?.['@_code'],
                    display: route?.['@_displayName']
                }]
            } : undefined
        }];
    }

    return { medication, medicationRequest };
}

function mapV3Address(addr: any): any {
    const addrObj = Array.isArray(addr) ? addr[0] : addr;
    return {
        line: extractTextArray(addrObj.streetAddressLine || addrObj.StreetAddressLine),
        city: extractText(addrObj.city || addrObj.City),
        state: extractText(addrObj.state || addrObj.State),
        postalCode: extractText(addrObj.postalCode || addrObj.PostalCode),
        country: extractText(addrObj.country || addrObj.Country),
        use: addrObj['@_use']
    };
}

function mapV3Telecom(telecom: any): any[] {
    const telecoms = Array.isArray(telecom) ? telecom : [telecom];
    return telecoms.map(t => ({
        system: inferTelecomSystem(t['@_value']),
        value: cleanTelecomValue(t['@_value']),
        use: t['@_use']
    })).filter(t => t.value);
}

function mapV3Addresses(addr: any): any[] {
    const addrs = Array.isArray(addr) ? addr : [addr];
    return addrs.map(mapV3Address).filter(a => a.line?.length || a.city || a.state || a.postalCode || a.country);
}

function mapV3OrganizationNode(org: any): CanonicalOrganization | undefined {
    if (!org) return undefined;
    const ids = org.id || org.Id;
    const idInfo = pickV3Id(ids);
    const name = extractText(org.name || org.Name);
    const telecom = org.telecom || org.Telecom;
    const addr = org.addr || org.Addr;
    const code = org.code || org.Code;

    return {
        id: idInfo.id || name,
        identifier: idInfo.identifier,
        name: name,
        telecom: telecom ? mapV3Telecom(telecom) : undefined,
        address: addr ? mapV3Addresses(addr) : undefined,
        type: code ? [{
            system: code?.['@_codeSystem'],
            code: code?.['@_code'],
            display: code?.['@_displayName']
        }] : undefined
    };
}

function mapV3PractitionerRoleFromAssigned(assignedAuthor: any): CanonicalPractitionerRole | undefined {
    const assignedPerson = assignedAuthor.assignedPerson || assignedAuthor.AssignedPerson;
    if (!assignedPerson) return undefined;
    const ids = assignedAuthor.id || assignedAuthor.Id;
    const idInfo = pickV3Id(ids);
    const org = assignedAuthor.representedOrganization || assignedAuthor.RepresentedOrganization;
    const orgIdInfo = org ? pickV3Id(org.id || org.Id) : { id: undefined, identifier: undefined };
    const code = assignedAuthor.code || assignedAuthor.Code;

    if (!idInfo.id && !idInfo.identifier) return undefined;
    return {
        id: idInfo.identifier || idInfo.id,
        practitionerId: idInfo.identifier || idInfo.id,
        organizationId: orgIdInfo.identifier || orgIdInfo.id,
        code: code ? [{
            system: code?.['@_codeSystem'],
            code: code?.['@_code'],
            display: code?.['@_displayName']
        }] : undefined
    };
}

function mapV3PractitionerRoleFromResponsible(responsibleParty: any): CanonicalPractitionerRole | undefined {
    const assignedEntity = responsibleParty.assignedEntity || responsibleParty.AssignedEntity;
    if (!assignedEntity) return undefined;
    const ids = assignedEntity.id || assignedEntity.Id;
    const idInfo = pickV3Id(ids);
    const org = assignedEntity.representedOrganization || assignedEntity.RepresentedOrganization;
    const orgIdInfo = org ? pickV3Id(org.id || org.Id) : { id: undefined, identifier: undefined };
    const code = assignedEntity.code || assignedEntity.Code;

    if (!idInfo.id && !idInfo.identifier) return undefined;
    return {
        id: idInfo.identifier || idInfo.id,
        practitionerId: idInfo.identifier || idInfo.id,
        organizationId: orgIdInfo.identifier || orgIdInfo.id,
        code: code ? [{
            system: code?.['@_codeSystem'],
            code: code?.['@_code'],
            display: code?.['@_displayName']
        }] : undefined
    };
}

// Helper functions (extractText, formatV3Date, etc.)
function extractText(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value['#text']) return value['#text'];
    return '';
}

function extractTextArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(extractText).filter(Boolean);
    return [extractText(value)].filter(Boolean);
}

function readV3Value(value: any): string | number | Array<string | number> | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) {
        return value.map(readV3Value).filter(v => v !== undefined) as Array<string | number>;
    }
    if (value['@_value'] !== undefined) return value['@_value'];
    if (value['@_code'] !== undefined) return value['@_code'];
    return extractText(value);
}

function mapV3Observers(performer: any): Array<{ id?: string; name?: string; qualification?: string; }> | undefined {
    if (!performer) return undefined;
    const performers = Array.isArray(performer) ? performer : [performer];
    const observers = performers.map(p => {
        const assignedEntity = p.assignedEntity || p.AssignedEntity;
        const assignedPerson = assignedEntity?.assignedPerson || assignedEntity?.AssignedPerson;
        const ids = assignedEntity?.id || assignedEntity?.Id;
        const idInfo = pickV3Id(ids);
        const nameNode = assignedPerson?.name || assignedPerson?.Name;
        const family = extractText(nameNode?.family || nameNode?.Family);
        const givenParts = nameNode?.given || nameNode?.Given;
        const given = Array.isArray(givenParts)
            ? givenParts.map(extractText).filter(Boolean).join(' ')
            : extractText(givenParts);
        const displayName = [given, family].filter(Boolean).join(' ').trim();
        return {
            id: idInfo.identifier || idInfo.id,
            name: displayName || undefined
        };
    }).filter(o => o.id || o.name);
    return observers.length > 0 ? observers : undefined;
}

function inferTelecomSystem(value: string): 'phone' | 'email' | 'fax' | 'url' | 'other' {
    if (!value) return 'other';
    if (value.startsWith('tel:')) return 'phone';
    if (value.startsWith('mailto:')) return 'email';
    if (value.startsWith('fax:')) return 'fax';
    if (value.startsWith('http')) return 'url';
    if (value.includes('@')) return 'email';
    return 'phone';
}

function cleanTelecomValue(value: string): string {
    if (!value) return '';
    return value.replace(/^(tel:|mailto:|fax:)/, '');
}

function formatV3Date(value?: string): string | undefined {
    if (value && value.length >= 8) {
        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    }
    return undefined;
}

function formatV3DateTime(value?: string): string | undefined {
    if (value && value.length >= 8) {
        let date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
        if (value.length >= 14) {
            date += `T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}Z`;
        } else {
            date += `T00:00:00Z`;
        }
        return date;
    }
    return undefined;
}

function mapGenderCode(code?: string): string {
    if (!code) return 'unknown';
    const c = code.toUpperCase();
    if (c === 'M' || c === 'MALE') return 'male';
    if (c === 'F' || c === 'FEMALE') return 'female';
    return 'unknown';
}

function pickV3Id(ids: any): { id?: string; identifier?: string } {
    if (!ids) return {};
    const first = Array.isArray(ids) ? ids[0] : ids;
    const extension = first?.['@_extension'];
    const root = first?.['@_root'];
    const idValue = extension || root;
    return {
        id: idValue,
        identifier: idValue
    };
}

function buildV3DoseText(dose: any, route: any): string | undefined {
    const doseValue = dose?.['@_value'];
    const doseUnit = dose?.['@_unit'];
    const routeDisplay = route?.['@_displayName'] || route?.['@_code'];
    const parts = [];
    if (doseValue) parts.push(`${doseValue}${doseUnit ? ' ' + doseUnit : ''}`);
    if (routeDisplay) parts.push(`via ${routeDisplay}`);
    return parts.length > 0 ? parts.join(' ') : undefined;
}

function mapEncounterStatus(status?: string): string {
    if (!status) return 'unknown';
    const s = status.toLowerCase();

    // FHIR R5 Status validation
    if (s === 'active') return 'in-progress';
    if (s === 'completed' || s === 'finished') return 'completed';
    if (s === 'aborted' || s === 'cancelled') return 'cancelled';
    if (s === 'planned' || s === 'new') return 'planned';

    return 'unknown';
}

function mapEncounterClass(code?: string): string {
    if (!code) return 'AMB';
    const codeUpper = code.toUpperCase();

    if (codeUpper === 'IMP' || codeUpper === 'INPATIENT') return 'IMP';
    if (codeUpper === 'AMB' || codeUpper === 'AMBULATORY') return 'AMB';
    if (codeUpper === 'EMER' || codeUpper === 'EMERGENCY') return 'EMER';
    if (codeUpper === 'VR' || codeUpper === 'VIRTUAL') return 'VR';

    return 'AMB';
}
