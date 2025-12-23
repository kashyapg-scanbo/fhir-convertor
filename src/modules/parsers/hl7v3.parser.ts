
import { XMLParser } from 'fast-xml-parser';
import {
    CanonicalModel,
    CanonicalPatient,
    CanonicalEncounter,
    CanonicalPractitioner,
    CanonicalOrganization,
    CanonicalObservation
} from '../../shared/types/canonical.types.js';

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text'
});

/**
 * Parse generic HL7 v3 XML messages (PRPA, etc.) into Canonical Model
 * Note: This is a best-effort parser for generic V3 messages
 * For CDA documents, use the dedicated CDA parser
 */
export function parseHL7v3(input: string): CanonicalModel {
    let xml: any;
    try {
        xml = parser.parse(input);
    } catch (e) {
        throw new Error('Invalid XML input for HL7v3 parser');
    }

    // Detect root element name (could be generic)
    const rootKey = Object.keys(xml)[0];
    const root = xml[rootKey];

    if (!root) {
        throw new Error('Empty or invalid HL7v3 message');
    }

    const model: CanonicalModel = {
        messageType: rootKey, // e.g., PRPA_IN201305UV02
        patient: { name: {} },
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

    // Generic traversal to find Subject/Patient Role
    // HL7 v3 messages typically follow ControlAct -> Subject -> RegistrationEvent -> Subject1 -> Patient

    const controlAct = root.controlActProcess || root.ControlActProcess;
    if (controlAct) {
        const subject = controlAct.subject || controlAct.Subject;
        // Handle array of subjects or single
        const subjects = Array.isArray(subject) ? subject : [subject];

        for (const sub of subjects) {
            if (!sub) continue;

            // Try to find Patient in common locations
            const registrationEvent = sub.registrationEvent || sub.RegistrationEvent;
            if (registrationEvent) {
                const ptSubject = registrationEvent.subject1 || registrationEvent.Subject1;
                const patient = ptSubject?.patient || ptSubject?.Patient;
                if (patient) {
                    model.patient = mapV3Patient(patient);
                }

                // Extract custodian organization if present
                const custodian = registrationEvent.custodian || registrationEvent.Custodian;
                if (custodian) {
                    const org = mapV3Organization(custodian);
                    if (org) model.organizations?.push(org);
                }
            }

            // Try observation event
            const observationEvent = sub.observationEvent || sub.ObservationEvent;
            if (observationEvent) {
                const obs = mapV3Observation(observationEvent);
                if (obs) model.observations?.push(obs);
            }
        }
    }

    // Extract author/provider information
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

    // Name handling (HL7 v3 name parts have 'use' and 'part' with types)
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
    const identifier = Array.isArray(ids) ? ids[0]?.['@_extension'] : ids?.['@_extension'];

    return {
        identifier: identifier,
        name: {
            family: family,
            given: given
        },
        gender: person?.administrativeGenderCode?.['@_code'],
        birthDate: formatV3Date(person?.birthTime?.['@_value']),
        address: addr ? [mapV3Address(addr)] : undefined,
        telecom: telecom ? mapV3Telecom(telecom) : undefined,
        active: pt.statusCode?.['@_code'] === 'active'
    };
}

function mapV3Practitioner(assignedAuthor: any): CanonicalPractitioner | undefined {
    const person = assignedAuthor.assignedPerson || assignedAuthor.AssignedPerson;
    if (!person) return undefined;

    const name = person.name || person.Name;
    const ids = assignedAuthor.id || assignedAuthor.Id;
    const identifier = Array.isArray(ids) ? ids[0]?.['@_extension'] : ids?.['@_extension'];

    let family = '';
    let given: string[] = [];

    if (name) {
        family = extractText(name.family || name.Family);
        const givenParts = name.given || name.Given;
        given = Array.isArray(givenParts)
            ? givenParts.map(extractText).filter(Boolean)
            : givenParts ? [extractText(givenParts)] : [];
    }

    return {
        id: identifier,
        identifier: identifier,
        name: {
            family: family,
            given: given
        }
    };
}

function mapV3Organization(custodian: any): CanonicalOrganization | undefined {
    const assignedCustodian = custodian.assignedCustodian || custodian.AssignedCustodian;
    const org = assignedCustodian?.representedCustodianOrganization ||
        assignedCustodian?.RepresentedCustodianOrganization;

    if (!org) return undefined;

    const ids = org.id || org.Id;
    const identifier = Array.isArray(ids) ? ids[0]?.['@_extension'] : ids?.['@_extension'];
    const name = extractText(org.name || org.Name);

    return {
        id: identifier || name,
        identifier: identifier,
        name: name
    };
}

function mapV3OrganizationFromAssigned(assignedAuthor: any): CanonicalOrganization | undefined {
    const org = assignedAuthor.representedOrganization || assignedAuthor.RepresentedOrganization;
    if (!org) return undefined;

    const ids = org.id || org.Id;
    const identifier = Array.isArray(ids) ? ids[0]?.['@_extension'] : ids?.['@_extension'];
    const name = extractText(org.name || org.Name);

    return {
        id: identifier || name,
        identifier: identifier,
        name: name
    };
}

function mapV3Observation(obsEvent: any): CanonicalObservation | undefined {
    const obs = obsEvent.observation || obsEvent.Observation;
    if (!obs) return undefined;

    const code = obs.code || obs.Code;
    const value = obs.value || obs.Value;

    return {
        code: {
            system: code?.['@_codeSystem'],
            code: code?.['@_code'],
            display: code?.['@_displayName']
        },
        value: value?.['@_value'] || extractText(value),
        unit: value?.['@_unit'],
        status: 'final'
    };
}

function mapV3Address(addr: any): any {
    const addrObj = Array.isArray(addr) ? addr[0] : addr;
    return {
        line: extractTextArray(addrObj.streetAddressLine || addrObj.StreetAddressLine),
        city: extractText(addrObj.city || addrObj.City),
        state: extractText(addrObj.state || addrObj.State),
        postalCode: extractText(addrObj.postalCode || addrObj.PostalCode),
        country: extractText(addrObj.country || addrObj.Country)
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
    if (!value) return undefined;
    // V3 dates are typically YYYYMMDD or YYYYMMDDHHMMSS
    const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }
    return undefined;
}
