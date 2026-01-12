
import {
    CanonicalModel,
    CanonicalPatient,
    CanonicalEncounter,
    CanonicalObservation,
    CanonicalPractitioner,
    CanonicalPractitionerRole,
    CanonicalOrganization,
    CanonicalMedication,
    CanonicalMedicationRequest,
    CanonicalDocumentReference,
    CanonicalMedicationStatement,
    CanonicalMedicationAdministration,
    CanonicalProcedure,
    CanonicalCondition,
    CanonicalAppointment,
    CanonicalSchedule,
    CanonicalSlot,
    CanonicalDiagnosticReport,
    CanonicalRelatedPerson,
    CanonicalLocation,
    CanonicalEpisodeOfCare,
    CanonicalSpecimen,
    CanonicalImagingStudy,
    CanonicalAllergyIntolerance,
    CanonicalImmunization,
    CanonicalCapabilityStatement,
    CanonicalOperationOutcome
} from '../../shared/types/canonical.types.js';

/**
 * Parse FHIR R4 JSON input into Canonical Model
 * This allows R4 data to be normalized and re-mapped to R5 consistent with other formats
 */
export function parseR4(input: string): CanonicalModel {
    let data: any;
    try {
        data = JSON.parse(input);
    } catch (e) {
        throw new Error('Invalid JSON input for R4 parser');
    }

    const model: CanonicalModel = {
        messageType: 'R4-IMPORT',
        patient: { name: {} }, // Default empty patient
        observations: [],
        medications: [],
        medicationRequests: [],
        medicationStatements: [],
        medicationAdministrations: [],
        procedures: [],
        conditions: [],
        appointments: [],
        schedules: [],
        slots: [],
        diagnosticReports: [],
        relatedPersons: [],
        locations: [],
        episodesOfCare: [],
        specimens: [],
        imagingStudies: [],
        allergyIntolerances: [],
        immunizations: [],
        capabilityStatements: [],
        operationOutcomes: [],
        practitioners: [],
        practitionerRoles: [],
        organizations: [],
        documentReferences: [],
        allergies: [],
        diagnoses: []
    };

    // Handle Bundle or Single Resource
    const resources = data.resourceType === 'Bundle' && data.entry
        ? data.entry.map((e: any) => e.resource).filter(Boolean)
        : [data];

    for (const res of resources) {
        if (!res || !res.resourceType) continue;

        switch (res.resourceType) {
            case 'Patient':
                model.patient = mapR4Patient(res);
                break;
            case 'Encounter':
                model.encounter = mapR4Encounter(res);
                break;
            case 'Observation':
                const obs = mapR4Observation(res);
                if (obs) model.observations?.push(obs);
                break;
            case 'Practitioner':
                const pract = mapR4Practitioner(res);
                if (pract) model.practitioners?.push(pract);
                break;
            case 'PractitionerRole':
                const role = mapR4PractitionerRole(res);
                if (role) model.practitionerRoles?.push(role);
                break;
            case 'Organization':
                const org = mapR4Organization(res);
                if (org) model.organizations?.push(org);
                break;
            case 'Medication':
                const med = mapR4Medication(res);
                if (med) model.medications?.push(med);
                break;
            case 'MedicationRequest':
                const medReq = mapR4MedicationRequest(res);
                if (medReq) model.medicationRequests?.push(medReq);
                break;
            case 'MedicationStatement':
                const medStatement = mapR4MedicationStatement(res);
                if (medStatement) model.medicationStatements?.push(medStatement);
                break;
            case 'Procedure':
                const proc = mapR4Procedure(res);
                if (proc) model.procedures?.push(proc);
                break;
            case 'Condition':
                const condition = mapR4Condition(res);
                if (condition) model.conditions?.push(condition);
                break;
            case 'Appointment':
                const appointment = mapR4Appointment(res);
                if (appointment) model.appointments?.push(appointment);
                break;
            case 'Schedule':
                const schedule = mapR4Schedule(res);
                if (schedule) model.schedules?.push(schedule);
                break;
            case 'Slot':
                const slot = mapR4Slot(res);
                if (slot) model.slots?.push(slot);
                break;
            case 'DiagnosticReport':
                const report = mapR4DiagnosticReport(res);
                if (report) model.diagnosticReports?.push(report);
                break;
            case 'RelatedPerson':
                const related = mapR4RelatedPerson(res);
                if (related) model.relatedPersons?.push(related);
                break;
            case 'Location':
                const location = mapR4Location(res);
                if (location) model.locations?.push(location);
                break;
            case 'EpisodeOfCare':
                const episode = mapR4EpisodeOfCare(res);
                if (episode) model.episodesOfCare?.push(episode);
                break;
            case 'Specimen':
                const specimen = mapR4Specimen(res);
                if (specimen) model.specimens?.push(specimen);
                break;
            case 'ImagingStudy':
                const imagingStudy = mapR4ImagingStudy(res);
                if (imagingStudy) model.imagingStudies?.push(imagingStudy);
                break;
            case 'AllergyIntolerance':
                const allergy = mapR4AllergyIntolerance(res);
                if (allergy) model.allergyIntolerances?.push(allergy);
                break;
            case 'MedicationAdministration':
                const medicationAdministration = mapR4MedicationAdministration(res);
                if (medicationAdministration) model.medicationAdministrations?.push(medicationAdministration);
                break;
            case 'Immunization':
                const immunization = mapR4Immunization(res);
                if (immunization) model.immunizations?.push(immunization);
                break;
            case 'CapabilityStatement':
                const capability = mapR4CapabilityStatement(res);
                if (capability) model.capabilityStatements?.push(capability);
                break;
            case 'OperationOutcome':
                const outcome = mapR4OperationOutcome(res);
                if (outcome) model.operationOutcomes?.push(outcome);
                break;
            case 'DocumentReference':
                const docRef = mapR4DocumentReference(res);
                if (docRef) model.documentReferences?.push(docRef);
                break;
        }
    }

    return model;
}

function mapR4Patient(pt: any): CanonicalPatient {
    const name = pt.name?.[0] || {};
    return {
        id: pt.id,
        identifier: pt.identifier?.[0]?.value,
        name: {
            family: name.family,
            given: name.given
        },
        gender: pt.gender,
        birthDate: pt.birthDate,
        address: pt.address?.map((a: any) => ({
            line: a.line,
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            country: a.country,
            use: a.use
        })),
        telecom: pt.telecom?.map((t: any) => ({
            system: t.system,
            value: t.value,
            use: t.use
        })),
        active: pt.active
    };
}

function mapR4Encounter(enc: any): CanonicalEncounter {
    const participantIds = (enc.participant || [])
        .map((p: any) => p.individual?.reference || p.actor?.reference)
        .map((ref: string | undefined) => ref?.replace('Practitioner/', ''))
        .filter(Boolean);

    return {
        id: enc.id,
        class: enc.class?.code,
        status: enc.status,
        start: enc.period?.start,
        location: enc.location?.[0]?.location?.display,
        participantPractitionerIds: participantIds.length > 0 ? participantIds : undefined,
        serviceProviderOrganizationId: enc.serviceProvider?.reference?.replace('Organization/', '')
    };
}

function mapR4Observation(obs: any): CanonicalObservation {
    return {
        valueType: obs.valueQuantity ? 'NM' : 'ST',
        code: {
            system: obs.code?.coding?.[0]?.system,
            code: obs.code?.coding?.[0]?.code,
            display: obs.code?.coding?.[0]?.display
        },
        value: obs.valueQuantity?.value ?? obs.valueString,
        unit: obs.valueQuantity?.unit,
        status: obs.status,
        date: obs.effectiveDateTime,
        referenceRange: obs.referenceRange?.[0]?.text,
        abnormalFlags: obs.interpretation?.map((i: any) => i.coding?.[0]?.code).filter(Boolean)
    };
}

function mapR4Practitioner(pract: any): CanonicalPractitioner {
    const name = pract.name?.[0] || {};
    return {
        id: pract.id,
        identifier: pract.identifier?.[0]?.value,
        name: {
            family: name.family,
            given: name.given,
            prefix: name.prefix,
            suffix: name.suffix
        },
        telecom: pract.telecom?.map((t: any) => ({
            system: t.system,
            value: t.value,
            use: t.use
        })),
        address: pract.address?.map((a: any) => ({
            line: a.line,
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            country: a.country,
            use: a.use
        })),
        gender: pract.gender,
        birthDate: pract.birthDate,
        qualification: pract.qualification?.map((q: any) => ({
            code: {
                system: q.code?.coding?.[0]?.system,
                code: q.code?.coding?.[0]?.code,
                display: q.code?.coding?.[0]?.display
            }
        })),
        active: pract.active
    };
}

function mapR4PractitionerRole(role: any): CanonicalPractitionerRole {
    return {
        id: role.id,
        practitionerId: role.practitioner?.reference?.replace('Practitioner/', ''),
        organizationId: role.organization?.reference?.replace('Organization/', ''),
        code: role.code?.map((c: any) => ({
            system: c.coding?.[0]?.system,
            code: c.coding?.[0]?.code,
            display: c.coding?.[0]?.display
        })),
        specialty: role.specialty?.map((s: any) => ({
            system: s.coding?.[0]?.system,
            code: s.coding?.[0]?.code,
            display: s.coding?.[0]?.display
        })),
        period: role.period ? {
            start: role.period.start,
            end: role.period.end
        } : undefined,
        active: role.active
    };
}

function mapR4Organization(org: any): CanonicalOrganization {
    return {
        id: org.id,
        identifier: org.identifier?.[0]?.value,
        name: org.name,
        alias: org.alias,
        type: org.type?.map((t: any) => ({
            system: t.coding?.[0]?.system,
            code: t.coding?.[0]?.code,
            display: t.coding?.[0]?.display
        })),
        telecom: org.telecom?.map((t: any) => ({
            system: t.system,
            value: t.value,
            use: t.use
        })),
        address: org.address?.map((a: any) => ({
            line: a.line,
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            country: a.country,
            use: a.use
        })),
        partOf: org.partOf?.reference?.replace('Organization/', ''),
        active: org.active
    };
}

function mapR4Medication(med: any): CanonicalMedication {
    return {
        id: med.id,
        identifier: med.identifier?.[0]?.value,
        code: med.code ? {
            coding: med.code.coding?.map((c: any) => ({
                system: c.system,
                code: c.code,
                display: c.display
            })),
            text: med.code.text
        } : undefined,
        form: med.form ? {
            coding: med.form.coding?.map((c: any) => ({
                system: c.system,
                code: c.code,
                display: c.display
            }))
        } : undefined,
        manufacturer: med.manufacturer?.reference?.replace('Organization/', ''),
        amount: med.amount ? {
            value: med.amount.numerator?.value,
            unit: med.amount.numerator?.unit
        } : undefined,
        status: med.status,
        active: med.status === 'active'
    };
}

function mapR4MedicationRequest(medReq: any): CanonicalMedicationRequest {
    return {
        id: medReq.id,
        identifier: medReq.identifier?.[0]?.value,
        status: medReq.status,
        intent: medReq.intent,
        medicationCodeableConcept: medReq.medicationCodeableConcept ? {
            coding: medReq.medicationCodeableConcept.coding?.map((c: any) => ({
                system: c.system,
                code: c.code,
                display: c.display
            })),
            text: medReq.medicationCodeableConcept.text
        } : undefined,
        medicationReference: medReq.medicationReference?.reference?.replace('Medication/', ''),
        subject: medReq.subject?.reference?.replace('Patient/', ''),
        encounter: medReq.encounter?.reference?.replace('Encounter/', ''),
        authoredOn: medReq.authoredOn,
        requester: medReq.requester?.reference?.replace('Practitioner/', ''),
        performer: medReq.performer?.reference?.replace('Practitioner/', ''),
        dosageInstruction: medReq.dosageInstruction?.map((d: any) => ({
            text: d.text,
            timing: d.timing,
            doseQuantity: d.doseAndRate?.[0]?.doseQuantity ? {
                value: d.doseAndRate[0].doseQuantity.value,
                unit: d.doseAndRate[0].doseQuantity.unit
            } : undefined
        })),
        active: medReq.status === 'active'
    };
}

function mapR4MedicationStatement(statement: any): CanonicalMedicationStatement {
    const medicationCoding = statement.medicationCodeableConcept?.coding?.[0];
    const medText = statement.medicationCodeableConcept?.text;

    return {
        id: statement.id,
        identifier: statement.identifier?.[0]?.value,
        status: statement.status,
        category: statement.category?.map((cat: any) => ({
            system: cat.coding?.[0]?.system,
            code: cat.coding?.[0]?.code,
            display: cat.coding?.[0]?.display
        })),
        medicationCodeableConcept: medicationCoding || medText ? {
            coding: medicationCoding ? [{
                system: medicationCoding.system,
                code: medicationCoding.code,
                display: medicationCoding.display
            }] : undefined,
            text: medText
        } : undefined,
        medicationReference: statement.medicationReference?.reference?.replace('Medication/', ''),
        subject: statement.subject?.reference?.replace('Patient/', ''),
        encounter: statement.encounter?.reference?.replace('Encounter/', ''),
        effectiveDateTime: statement.effectiveDateTime,
        effectivePeriod: statement.effectivePeriod ? {
            start: statement.effectivePeriod.start,
            end: statement.effectivePeriod.end
        } : undefined,
        dateAsserted: statement.dateAsserted,
        author: statement.informationSource?.reference?.replace('Practitioner/', ''),
        informationSource: statement.informationSource?.reference ? [statement.informationSource.reference] : undefined,
        reason: statement.reasonCode?.map((reason: any) => ({
            code: {
                system: reason.coding?.[0]?.system,
                code: reason.coding?.[0]?.code,
                display: reason.coding?.[0]?.display
            }
        })),
        note: statement.note?.map((note: any) => note.text).filter(Boolean),
        dosage: statement.dosage?.map((dosage: any) => ({
            text: dosage.text,
            timing: dosage.timing,
            doseQuantity: dosage.doseAndRate?.[0]?.doseQuantity ? {
                value: dosage.doseAndRate[0].doseQuantity.value,
                unit: dosage.doseAndRate[0].doseQuantity.unit
            } : undefined,
            route: dosage.route ? {
                coding: dosage.route.coding?.map((c: any) => ({
                    system: c.system,
                    code: c.code,
                    display: c.display
                })),
                text: dosage.route.text
            } : undefined
        }))
    };
}

function mapR4MedicationAdministration(admin: any): CanonicalMedicationAdministration {
    const medCoding = admin.medicationCodeableConcept?.coding?.[0];
    const medText = admin.medicationCodeableConcept?.text;
    const statusReason = admin.statusReason?.map((reason: any) => reason.coding?.[0]).filter(Boolean);
    const category = admin.category?.map((cat: any) => cat.coding?.[0]).filter(Boolean);
    const dosage = admin.dosage;

    return {
        id: admin.id,
        identifier: admin.identifier?.[0]?.value,
        basedOn: admin.basedOn?.map((ref: any) => ref.reference).filter(Boolean),
        partOf: admin.partOf?.map((ref: any) => ref.reference).filter(Boolean),
        status: admin.status,
        statusReason: statusReason?.map((coding: any) => ({
            system: coding.system,
            code: coding.code,
            display: coding.display
        })),
        category: category?.map((coding: any) => ({
            system: coding.system,
            code: coding.code,
            display: coding.display
        })),
        medicationCodeableConcept: medCoding || medText ? {
            coding: medCoding ? [{
                system: medCoding.system,
                code: medCoding.code,
                display: medCoding.display
            }] : undefined,
            text: medText
        } : undefined,
        medicationReference: admin.medicationReference?.reference?.replace('Medication/', ''),
        subject: admin.subject?.reference?.replace('Patient/', ''),
        encounter: admin.encounter?.reference?.replace('Encounter/', ''),
        supportingInformation: admin.supportingInformation?.map((ref: any) => ref.reference).filter(Boolean),
        occurrenceDateTime: admin.occurrenceDateTime,
        occurrencePeriod: admin.occurrencePeriod ? {
            start: admin.occurrencePeriod.start,
            end: admin.occurrencePeriod.end
        } : undefined,
        occurrenceTiming: admin.occurrenceTiming,
        recorded: admin.recorded,
        isSubPotent: admin.isSubPotent,
        subPotentReason: admin.subPotentReason?.map((reason: any) => ({
            system: reason.coding?.[0]?.system,
            code: reason.coding?.[0]?.code,
            display: reason.coding?.[0]?.display
        })),
        performer: admin.performer?.map((perf: any) => ({
            function: perf.function?.coding?.[0] ? {
                system: perf.function.coding[0].system,
                code: perf.function.coding[0].code,
                display: perf.function.coding[0].display
            } : undefined,
            actor: perf.actor?.reference?.split('/').pop()
        })),
        reason: admin.reasonCode?.map((reason: any) => ({
            code: reason.coding?.[0] ? {
                system: reason.coding[0].system,
                code: reason.coding[0].code,
                display: reason.coding[0].display
            } : undefined
        })),
        request: admin.request?.reference?.replace('MedicationRequest/', ''),
        device: admin.device?.map((device: any) => device.reference?.split('/').pop()).filter(Boolean),
        note: admin.note?.map((note: any) => note.text).filter(Boolean),
        dosage: dosage ? {
            text: dosage.text,
            site: dosage.site?.coding?.[0] ? {
                system: dosage.site.coding[0].system,
                code: dosage.site.coding[0].code,
                display: dosage.site.coding[0].display
            } : undefined,
            route: dosage.route?.coding?.[0] ? {
                system: dosage.route.coding[0].system,
                code: dosage.route.coding[0].code,
                display: dosage.route.coding[0].display
            } : undefined,
            method: dosage.method?.coding?.[0] ? {
                system: dosage.method.coding[0].system,
                code: dosage.method.coding[0].code,
                display: dosage.method.coding[0].display
            } : undefined,
            dose: dosage.dose ? {
                value: dosage.dose.value,
                unit: dosage.dose.unit
            } : undefined,
            rateRatio: dosage.rateRatio,
            rateQuantity: dosage.rateQuantity ? {
                value: dosage.rateQuantity.value,
                unit: dosage.rateQuantity.unit
            } : undefined
        } : undefined,
        eventHistory: admin.eventHistory?.map((ref: any) => ref.reference).filter(Boolean)
    };
}

function mapR4CapabilityStatement(statement: any): CanonicalCapabilityStatement {
    const versionAlgorithmCoding = statement.versionAlgorithmCoding;
    return {
        id: statement.id,
        url: statement.url,
        identifier: statement.identifier?.map((id: any) => id.value).filter(Boolean),
        version: statement.version,
        versionAlgorithmString: statement.versionAlgorithmString,
        versionAlgorithmCoding: versionAlgorithmCoding
            ? {
                system: versionAlgorithmCoding.system,
                code: versionAlgorithmCoding.code,
                display: versionAlgorithmCoding.display
            }
            : undefined,
        name: statement.name,
        title: statement.title,
        status: statement.status,
        experimental: statement.experimental,
        date: statement.date,
        publisher: statement.publisher,
        contact: statement.contact?.map((contact: any) => ({
            name: contact.name,
            telecom: contact.telecom?.map((t: any) => ({
                system: t.system,
                value: t.value,
                use: t.use
            }))
        })),
        description: statement.description,
        useContext: statement.useContext?.map((ctx: any) => ({
            code: ctx.code?.coding?.[0]
                ? {
                    system: ctx.code.coding[0].system,
                    code: ctx.code.coding[0].code,
                    display: ctx.code.coding[0].display
                }
                : undefined,
            value: ctx.valueCodeableConcept?.text || ctx.valueString
        })),
        jurisdiction: statement.jurisdiction?.map((j: any) => ({
            system: j.coding?.[0]?.system,
            code: j.coding?.[0]?.code,
            display: j.coding?.[0]?.display
        })),
        purpose: statement.purpose,
        copyright: statement.copyright,
        copyrightLabel: statement.copyrightLabel,
        kind: statement.kind,
        instantiates: statement.instantiates,
        imports: statement.imports,
        software: statement.software
            ? {
                name: statement.software.name,
                version: statement.software.version,
                releaseDate: statement.software.releaseDate
            }
            : undefined,
        implementation: statement.implementation
            ? {
                description: statement.implementation.description,
                url: statement.implementation.url,
                custodian: statement.implementation.custodian?.reference?.replace('Organization/', '')
            }
            : undefined,
        fhirVersion: statement.fhirVersion,
        format: statement.format,
        patchFormat: statement.patchFormat,
        acceptLanguage: statement.acceptLanguage,
        implementationGuide: statement.implementationGuide,
        rest: statement.rest?.map((rest: any) => ({
            mode: rest.mode,
            documentation: rest.documentation
        })),
        messaging: statement.messaging?.map((msg: any) => ({
            endpoint: msg.endpoint?.map((ep: any) => ({
                protocol: ep.protocol
                    ? {
                        system: ep.protocol.system,
                        code: ep.protocol.code,
                        display: ep.protocol.display
                    }
                    : undefined,
                address: ep.address
            })),
            documentation: msg.documentation
        })),
        document: statement.document?.map((doc: any) => ({
            mode: doc.mode,
            documentation: doc.documentation,
            profile: doc.profile
        }))
    };
}

function mapR4OperationOutcome(outcome: any): CanonicalOperationOutcome {
    return {
        id: outcome.id,
        issue: outcome.issue?.map((issue: any) => ({
            severity: issue.severity,
            code: issue.code,
            details: issue.details?.coding?.[0]
                ? {
                    system: issue.details.coding[0].system,
                    code: issue.details.coding[0].code,
                    display: issue.details.coding[0].display
                }
                : undefined,
            diagnostics: issue.diagnostics,
            location: issue.location,
            expression: issue.expression
        }))
    };
}

function mapR4Procedure(proc: any): CanonicalProcedure {
    return {
        id: proc.id,
        identifier: proc.identifier?.[0]?.value,
        status: proc.status,
        category: proc.category?.map((cat: any) => ({
            system: cat.coding?.[0]?.system,
            code: cat.coding?.[0]?.code,
            display: cat.coding?.[0]?.display
        })),
        code: proc.code ? {
            coding: proc.code.coding?.map((c: any) => ({
                system: c.system,
                code: c.code,
                display: c.display
            })),
            text: proc.code.text
        } : undefined,
        subject: proc.subject?.reference?.replace('Patient/', ''),
        encounter: proc.encounter?.reference?.replace('Encounter/', ''),
        occurrenceDateTime: proc.performedDateTime || proc.occurrenceDateTime,
        occurrencePeriod: proc.performedPeriod || proc.occurrencePeriod ? {
            start: (proc.performedPeriod || proc.occurrencePeriod)?.start,
            end: (proc.performedPeriod || proc.occurrencePeriod)?.end
        } : undefined,
        recorded: proc.recorded,
        performer: proc.performer?.map((p: any) => ({
            actor: p.actor?.reference?.replace(/^(Practitioner|Organization|Patient)\//, ''),
            onBehalfOf: p.onBehalfOf?.reference?.replace('Organization/', ''),
            function: p.function?.coding?.[0] ? {
                system: p.function.coding[0].system,
                code: p.function.coding[0].code,
                display: p.function.coding[0].display
            } : undefined,
            period: p.period ? {
                start: p.period.start,
                end: p.period.end
            } : undefined
        })),
        reason: proc.reasonCode?.map((reason: any) => ({
            code: {
                system: reason.coding?.[0]?.system,
                code: reason.coding?.[0]?.code,
                display: reason.coding?.[0]?.display
            }
        })),
        bodySite: proc.bodySite?.map((site: any) => ({
            system: site.coding?.[0]?.system,
            code: site.coding?.[0]?.code,
            display: site.coding?.[0]?.display
        })),
        note: proc.note?.map((note: any) => note.text).filter(Boolean),
        location: proc.location?.reference?.replace('Location/', '')
    };
}

function mapR4Condition(cond: any): CanonicalCondition {
    return {
        id: cond.id,
        identifier: cond.identifier?.[0]?.value,
        clinicalStatus: cond.clinicalStatus?.coding?.[0] ? {
            system: cond.clinicalStatus.coding[0].system,
            code: cond.clinicalStatus.coding[0].code,
            display: cond.clinicalStatus.coding[0].display
        } : undefined,
        verificationStatus: cond.verificationStatus?.coding?.[0] ? {
            system: cond.verificationStatus.coding[0].system,
            code: cond.verificationStatus.coding[0].code,
            display: cond.verificationStatus.coding[0].display
        } : undefined,
        category: cond.category?.map((cat: any) => ({
            system: cat.coding?.[0]?.system,
            code: cat.coding?.[0]?.code,
            display: cat.coding?.[0]?.display
        })),
        severity: cond.severity?.coding?.[0] ? {
            system: cond.severity.coding[0].system,
            code: cond.severity.coding[0].code,
            display: cond.severity.coding[0].display
        } : undefined,
        code: cond.code ? {
            coding: cond.code.coding?.map((c: any) => ({
                system: c.system,
                code: c.code,
                display: c.display
            })),
            text: cond.code.text
        } : undefined,
        bodySite: cond.bodySite?.map((site: any) => ({
            system: site.coding?.[0]?.system,
            code: site.coding?.[0]?.code,
            display: site.coding?.[0]?.display
        })),
        subject: cond.subject?.reference?.replace('Patient/', ''),
        encounter: cond.encounter?.reference?.replace('Encounter/', ''),
        onsetDateTime: cond.onsetDateTime,
        onsetPeriod: cond.onsetPeriod ? {
            start: cond.onsetPeriod.start,
            end: cond.onsetPeriod.end
        } : undefined,
        onsetString: cond.onsetString,
        abatementDateTime: cond.abatementDateTime,
        abatementPeriod: cond.abatementPeriod ? {
            start: cond.abatementPeriod.start,
            end: cond.abatementPeriod.end
        } : undefined,
        abatementString: cond.abatementString,
        recordedDate: cond.recordedDate,
        note: cond.note?.map((note: any) => note.text).filter(Boolean)
    };
}

function mapR4Appointment(appt: any): CanonicalAppointment {
    return {
        id: appt.id,
        identifier: appt.identifier?.[0]?.value,
        status: appt.status,
        description: appt.description,
        start: appt.start,
        end: appt.end,
        minutesDuration: appt.minutesDuration,
        created: appt.created,
        cancellationDate: appt.cancellationDate,
        subject: appt.subject?.reference?.replace('Patient/', ''),
        participant: appt.participant?.map((participant: any) => ({
            actor: participant.actor?.reference?.replace(/^(Patient|Practitioner|Location|Organization)\//, ''),
            status: participant.status,
            required: participant.required,
            period: participant.period ? {
                start: participant.period.start,
                end: participant.period.end
            } : undefined
        }))
    };
}

function mapR4Schedule(schedule: any): CanonicalSchedule {
    return {
        id: schedule.id,
        identifier: schedule.identifier?.[0]?.value,
        active: schedule.active,
        name: schedule.name,
        actor: schedule.actor?.map((actor: any) => actor.reference?.replace(/^(Practitioner|PractitionerRole|Location|Organization|Patient|HealthcareService)\//, '')).filter(Boolean),
        planningHorizon: schedule.planningHorizon ? {
            start: schedule.planningHorizon.start,
            end: schedule.planningHorizon.end
        } : undefined,
        comment: schedule.comment,
        serviceCategory: schedule.serviceCategory?.map((cat: any) => ({
            system: cat.coding?.[0]?.system,
            code: cat.coding?.[0]?.code,
            display: cat.coding?.[0]?.display
        })),
        serviceType: schedule.serviceType?.map((service: any) => ({
            system: service.concept?.coding?.[0]?.system,
            code: service.concept?.coding?.[0]?.code,
            display: service.concept?.coding?.[0]?.display
        })),
        specialty: schedule.specialty?.map((spec: any) => ({
            system: spec.coding?.[0]?.system,
            code: spec.coding?.[0]?.code,
            display: spec.coding?.[0]?.display
        }))
    };
}

function mapR4Slot(slot: any): CanonicalSlot {
    return {
        id: slot.id,
        identifier: slot.identifier?.[0]?.value,
        schedule: slot.schedule?.reference?.replace('Schedule/', ''),
        status: slot.status,
        start: slot.start,
        end: slot.end,
        overbooked: slot.overbooked,
        comment: slot.comment,
        serviceCategory: slot.serviceCategory?.map((cat: any) => ({
            system: cat.coding?.[0]?.system,
            code: cat.coding?.[0]?.code,
            display: cat.coding?.[0]?.display
        })),
        serviceType: slot.serviceType?.map((service: any) => ({
            system: service.concept?.coding?.[0]?.system,
            code: service.concept?.coding?.[0]?.code,
            display: service.concept?.coding?.[0]?.display
        })),
        specialty: slot.specialty?.map((spec: any) => ({
            system: spec.coding?.[0]?.system,
            code: spec.coding?.[0]?.code,
            display: spec.coding?.[0]?.display
        })),
        appointmentType: slot.appointmentType?.map((type: any) => ({
            system: type.coding?.[0]?.system,
            code: type.coding?.[0]?.code,
            display: type.coding?.[0]?.display
        }))
    };
}

function mapR4DiagnosticReport(report: any): CanonicalDiagnosticReport {
    return {
        id: report.id,
        identifier: report.identifier?.[0]?.value,
        status: report.status,
        category: report.category?.map((cat: any) => ({
            system: cat.coding?.[0]?.system,
            code: cat.coding?.[0]?.code,
            display: cat.coding?.[0]?.display
        })),
        code: report.code ? {
            coding: report.code.coding?.map((c: any) => ({
                system: c.system,
                code: c.code,
                display: c.display
            })),
            text: report.code.text
        } : undefined,
        subject: report.subject?.reference?.replace('Patient/', ''),
        encounter: report.encounter?.reference?.replace('Encounter/', ''),
        effectiveDateTime: report.effectiveDateTime,
        effectivePeriod: report.effectivePeriod ? {
            start: report.effectivePeriod.start,
            end: report.effectivePeriod.end
        } : undefined,
        issued: report.issued,
        performer: report.performer?.map((p: any) => p.reference?.replace(/^(Organization|Practitioner|PractitionerRole)\//, '')).filter(Boolean),
        resultsInterpreter: report.resultsInterpreter?.map((p: any) => p.reference?.replace(/^(Organization|Practitioner|PractitionerRole)\//, '')).filter(Boolean),
        specimen: report.specimen?.map((s: any) => s.reference?.replace('Specimen/', '')).filter(Boolean),
        result: report.result?.map((r: any) => r.reference?.replace('Observation/', '')).filter(Boolean),
        conclusion: report.conclusion,
        note: report.note?.map((note: any) => note.text).filter(Boolean)
    };
}

function mapR4RelatedPerson(rp: any): CanonicalRelatedPerson {
    const name = rp.name?.[0];
    return {
        id: rp.id,
        identifier: rp.identifier?.[0]?.value,
        active: rp.active,
        patient: rp.patient?.reference?.replace('Patient/', ''),
        relationship: rp.relationship?.map((rel: any) => ({
            system: rel.coding?.[0]?.system,
            code: rel.coding?.[0]?.code,
            display: rel.coding?.[0]?.display
        })),
        name: name ? [{
            family: name.family,
            given: name.given
        }] : undefined,
        telecom: rp.telecom?.map((t: any) => ({
            system: t.system,
            value: t.value,
            use: t.use
        })),
        gender: rp.gender,
        birthDate: rp.birthDate,
        address: rp.address?.map((a: any) => ({
            line: a.line,
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            country: a.country,
            use: a.use
        }))
    };
}

function mapR4Location(loc: any): CanonicalLocation {
    return {
        id: loc.id,
        identifier: loc.identifier?.[0]?.value,
        status: loc.status,
        name: loc.name,
        alias: loc.alias,
        description: loc.description,
        mode: loc.mode,
        type: loc.type?.map((type: any) => ({
            system: type.coding?.[0]?.system,
            code: type.coding?.[0]?.code,
            display: type.coding?.[0]?.display
        })),
        address: loc.address ? {
            line: loc.address.line,
            city: loc.address.city,
            state: loc.address.state,
            postalCode: loc.address.postalCode,
            country: loc.address.country
        } : undefined,
        position: loc.position ? {
            longitude: loc.position.longitude,
            latitude: loc.position.latitude,
            altitude: loc.position.altitude
        } : undefined,
        managingOrganization: loc.managingOrganization?.reference?.replace('Organization/', ''),
        partOf: loc.partOf?.reference?.replace('Location/', ''),
        active: loc.status ? loc.status === 'active' : undefined
    };
}

function mapR4EpisodeOfCare(eoc: any): CanonicalEpisodeOfCare {
    return {
        id: eoc.id,
        identifier: eoc.identifier?.[0]?.value,
        status: eoc.status,
        statusHistory: eoc.statusHistory?.map((history: any) => ({
            status: history.status,
            period: history.period ? {
                start: history.period.start,
                end: history.period.end
            } : undefined
        })),
        type: eoc.type?.map((type: any) => ({
            system: type.coding?.[0]?.system,
            code: type.coding?.[0]?.code,
            display: type.coding?.[0]?.display
        })),
        reason: eoc.reason?.flatMap((reason: any) => {
            const concepts = reason.value?.map((value: any) => value.concept).filter(Boolean) ?? [];
            return concepts.map((concept: any) => ({
                code: {
                    system: concept.coding?.[0]?.system,
                    code: concept.coding?.[0]?.code,
                    display: concept.coding?.[0]?.display || concept.text
                }
            }));
        }),
        diagnosis: eoc.diagnosis?.flatMap((diagnosis: any) => {
            const concepts = diagnosis.condition?.map((value: any) => value.concept).filter(Boolean) ?? [];
            return concepts.map((concept: any) => ({
                condition: {
                    system: concept.coding?.[0]?.system,
                    code: concept.coding?.[0]?.code,
                    display: concept.coding?.[0]?.display || concept.text
                }
            }));
        }),
        patient: eoc.patient?.reference?.replace('Patient/', ''),
        managingOrganization: eoc.managingOrganization?.reference?.replace('Organization/', ''),
        period: eoc.period ? {
            start: eoc.period.start,
            end: eoc.period.end
        } : undefined,
        referralRequest: eoc.referralRequest?.map((ref: any) => ref.reference?.replace('ServiceRequest/', '')).filter(Boolean),
        careManager: eoc.careManager?.reference?.replace(/^(Practitioner|PractitionerRole)\//, ''),
        careTeam: eoc.careTeam?.map((ref: any) => ref.reference?.replace('CareTeam/', '')).filter(Boolean),
        account: eoc.account?.map((ref: any) => ref.reference?.replace('Account/', '')).filter(Boolean),
        active: eoc.status ? eoc.status === 'active' : undefined
    };
}

function mapR4Specimen(spec: any): CanonicalSpecimen {
    const collectedPeriod = spec.collection?.collectedPeriod;
    const quantity = spec.collection?.quantity;
    const duration = spec.collection?.duration;
    const fasting = spec.collection?.fastingStatusDuration;
    const container = spec.container?.[0];
    const processing = spec.processing?.[0];

    return {
        id: spec.id,
        identifier: spec.identifier?.[0]?.value,
        accessionIdentifier: spec.accessionIdentifier?.value,
        status: spec.status,
        type: spec.type?.coding?.[0] ? {
            system: spec.type.coding[0].system,
            code: spec.type.coding[0].code,
            display: spec.type.coding[0].display
        } : undefined,
        subject: spec.subject?.reference?.replace(/^(Patient|Group|Location|Device|Substance|BiologicallyDerivedProduct)\//, ''),
        receivedTime: spec.receivedTime,
        parent: spec.parent?.map((ref: any) => ref.reference?.replace('Specimen/', '')).filter(Boolean),
        request: spec.request?.map((ref: any) => ref.reference?.replace('ServiceRequest/', '')).filter(Boolean),
        combined: spec.combined,
        role: spec.role?.map((role: any) => ({
            system: role.coding?.[0]?.system,
            code: role.coding?.[0]?.code,
            display: role.coding?.[0]?.display
        })),
        feature: spec.feature?.map((feature: any) => ({
            type: feature.type?.coding?.[0] ? {
                system: feature.type.coding[0].system,
                code: feature.type.coding[0].code,
                display: feature.type.coding[0].display
            } : undefined,
            description: feature.description
        })),
        collection: spec.collection ? {
            collector: spec.collection.collector?.reference?.replace(/^(Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
            collectedDateTime: spec.collection.collectedDateTime,
            collectedPeriod: collectedPeriod ? { start: collectedPeriod.start, end: collectedPeriod.end } : undefined,
            duration: duration ? { value: duration.value, unit: duration.unit } : undefined,
            quantity: quantity ? { value: quantity.value, unit: quantity.unit } : undefined,
            method: spec.collection.method?.coding?.[0] ? {
                system: spec.collection.method.coding[0].system,
                code: spec.collection.method.coding[0].code,
                display: spec.collection.method.coding[0].display
            } : undefined,
            device: spec.collection.device?.reference?.replace('Device/', ''),
            procedure: spec.collection.procedure?.reference?.replace('Procedure/', ''),
            bodySite: spec.collection.bodySite?.concept?.coding?.[0] ? {
                system: spec.collection.bodySite.concept.coding[0].system,
                code: spec.collection.bodySite.concept.coding[0].code,
                display: spec.collection.bodySite.concept.coding[0].display
            } : undefined,
            fastingStatusCodeableConcept: spec.collection.fastingStatusCodeableConcept?.coding?.[0] ? {
                system: spec.collection.fastingStatusCodeableConcept.coding[0].system,
                code: spec.collection.fastingStatusCodeableConcept.coding[0].code,
                display: spec.collection.fastingStatusCodeableConcept.coding[0].display
            } : undefined,
            fastingStatusDuration: fasting ? { value: fasting.value, unit: fasting.unit } : undefined
        } : undefined,
        processing: processing ? [{
            description: processing.description,
            method: processing.method?.coding?.[0] ? {
                system: processing.method.coding[0].system,
                code: processing.method.coding[0].code,
                display: processing.method.coding[0].display
            } : undefined,
            additive: processing.additive?.map((ref: any) => ref.reference?.replace('Substance/', '')).filter(Boolean),
            timeDateTime: processing.timeDateTime,
            timePeriod: processing.timePeriod ? { start: processing.timePeriod.start, end: processing.timePeriod.end } : undefined
        }] : undefined,
        container: container ? [{
            device: container.device?.reference?.replace('Device/', ''),
            location: container.location?.reference?.replace('Location/', ''),
            specimenQuantity: container.specimenQuantity ? { value: container.specimenQuantity.value, unit: container.specimenQuantity.unit } : undefined
        }] : undefined,
        condition: spec.condition?.map((condition: any) => ({
            system: condition.coding?.[0]?.system,
            code: condition.coding?.[0]?.code,
            display: condition.coding?.[0]?.display
        })),
        note: spec.note?.map((note: any) => note.text).filter(Boolean)
    };
}

function mapR4ImagingStudy(study: any): CanonicalImagingStudy {
    return {
        id: study.id,
        identifier: study.identifier?.[0]?.value,
        status: study.status,
        modality: study.modality?.map((mod: any) => ({
            system: mod.coding?.[0]?.system,
            code: mod.coding?.[0]?.code,
            display: mod.coding?.[0]?.display
        })),
        subject: study.subject?.reference?.replace(/^(Patient|Group|Device)\//, ''),
        encounter: study.encounter?.reference?.replace('Encounter/', ''),
        started: study.started,
        basedOn: study.basedOn?.map((ref: any) => ref.reference?.replace(/^(Appointment|AppointmentResponse|CarePlan|ServiceRequest|Task)\//, '')).filter(Boolean),
        partOf: study.partOf?.map((ref: any) => ref.reference?.replace('Procedure/', '')).filter(Boolean),
        referrer: study.referrer?.reference?.replace(/^(Practitioner|PractitionerRole)\//, ''),
        endpoint: study.endpoint?.map((ref: any) => ref.reference?.replace('Endpoint/', '')).filter(Boolean),
        numberOfSeries: study.numberOfSeries,
        numberOfInstances: study.numberOfInstances,
        procedure: study.procedure?.map((proc: any) => {
            const concept = proc.concept?.coding?.[0];
            return concept ? {
                system: concept.system,
                code: concept.code,
                display: concept.display
            } : undefined;
        }).filter(Boolean),
        location: study.location?.reference?.replace('Location/', ''),
        reason: study.reason?.flatMap((reason: any) => {
            const concepts = reason.value?.map((value: any) => value.concept).filter(Boolean) ?? [];
            return concepts.map((concept: any) => ({
                code: {
                    system: concept.coding?.[0]?.system,
                    code: concept.coding?.[0]?.code,
                    display: concept.coding?.[0]?.display || concept.text
                }
            }));
        }),
        note: study.note?.map((note: any) => note.text).filter(Boolean),
        description: study.description,
        series: study.series?.map((series: any) => ({
            uid: series.uid,
            number: series.number,
            modality: series.modality?.coding?.[0] ? {
                system: series.modality.coding[0].system,
                code: series.modality.coding[0].code,
                display: series.modality.coding[0].display
            } : undefined,
            description: series.description,
            numberOfInstances: series.numberOfInstances,
            endpoint: series.endpoint?.map((ref: any) => ref.reference?.replace('Endpoint/', '')).filter(Boolean),
            bodySite: series.bodySite?.concept?.coding?.[0] ? {
                system: series.bodySite.concept.coding[0].system,
                code: series.bodySite.concept.coding[0].code,
                display: series.bodySite.concept.coding[0].display
            } : undefined,
            laterality: series.laterality?.coding?.[0] ? {
                system: series.laterality.coding[0].system,
                code: series.laterality.coding[0].code,
                display: series.laterality.coding[0].display
            } : undefined,
            specimen: series.specimen?.map((ref: any) => ref.reference?.replace('Specimen/', '')).filter(Boolean),
            started: series.started,
            performer: series.performer?.map((perf: any) => ({
                function: perf.function?.coding?.[0] ? {
                    system: perf.function.coding[0].system,
                    code: perf.function.coding[0].code,
                    display: perf.function.coding[0].display
                } : undefined,
                actor: perf.actor?.reference?.replace(/^(CareTeam|Device|HealthcareService|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, '')
            })),
            instance: series.instance?.map((instance: any) => ({
                uid: instance.uid,
                sopClass: instance.sopClass ? {
                    system: instance.sopClass.system,
                    code: instance.sopClass.code,
                    display: instance.sopClass.display
                } : undefined,
                number: instance.number,
                title: instance.title
            }))
        }))
    };
}

function mapR4AllergyIntolerance(allergy: any): CanonicalAllergyIntolerance {
    return {
        id: allergy.id,
        identifier: allergy.identifier?.[0]?.value,
        clinicalStatus: allergy.clinicalStatus?.coding?.[0] ? {
            system: allergy.clinicalStatus.coding[0].system,
            code: allergy.clinicalStatus.coding[0].code,
            display: allergy.clinicalStatus.coding[0].display
        } : undefined,
        verificationStatus: allergy.verificationStatus?.coding?.[0] ? {
            system: allergy.verificationStatus.coding[0].system,
            code: allergy.verificationStatus.coding[0].code,
            display: allergy.verificationStatus.coding[0].display
        } : undefined,
        type: allergy.type ? {
            code: allergy.type,
            display: allergy.type
        } : undefined,
        category: allergy.category?.length ? allergy.category : undefined,
        criticality: allergy.criticality,
        code: allergy.code?.coding?.[0] ? {
            system: allergy.code.coding[0].system,
            code: allergy.code.coding[0].code,
            display: allergy.code.coding[0].display
        } : undefined,
        patient: allergy.patient?.reference?.replace('Patient/', ''),
        encounter: allergy.encounter?.reference?.replace('Encounter/', ''),
        onsetDateTime: allergy.onsetDateTime,
        onsetPeriod: allergy.onsetPeriod ? {
            start: allergy.onsetPeriod.start,
            end: allergy.onsetPeriod.end
        } : undefined,
        onsetString: allergy.onsetString,
        recordedDate: allergy.recordedDate,
        participant: allergy.participant?.map((p: any) => ({
            function: p.function?.coding?.[0] ? {
                system: p.function.coding[0].system,
                code: p.function.coding[0].code,
                display: p.function.coding[0].display
            } : undefined,
            actor: p.actor?.reference?.replace(/^(CareTeam|Device|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, '')
        })),
        lastOccurrence: allergy.lastOccurrence,
        note: allergy.note?.map((note: any) => note.text).filter(Boolean),
        reaction: allergy.reaction?.map((reaction: any) => ({
            substance: reaction.substance?.coding?.[0] ? {
                system: reaction.substance.coding[0].system,
                code: reaction.substance.coding[0].code,
                display: reaction.substance.coding[0].display
            } : undefined,
            manifestation: reaction.manifestation?.map((manifestation: any) => ({
                system: manifestation.concept?.coding?.[0]?.system,
                code: manifestation.concept?.coding?.[0]?.code,
                display: manifestation.concept?.coding?.[0]?.display || manifestation.concept?.text
            })).filter((m: any) => m.code || m.display),
            description: reaction.description,
            onset: reaction.onset,
            severity: reaction.severity,
            exposureRoute: reaction.exposureRoute?.coding?.[0] ? {
                system: reaction.exposureRoute.coding[0].system,
                code: reaction.exposureRoute.coding[0].code,
                display: reaction.exposureRoute.coding[0].display
            } : undefined,
            note: reaction.note?.map((note: any) => note.text).filter(Boolean)
        }))
    };
}

function mapR4Immunization(immunization: any): CanonicalImmunization {
    const vaccineCoding = immunization.vaccineCode?.coding?.[0];
    const statusReasonCoding = immunization.statusReason?.coding?.[0];
    const siteCoding = immunization.site?.coding?.[0];
    const routeCoding = immunization.route?.coding?.[0];
    const performer = immunization.performer?.[0];
    const reaction = immunization.reaction?.[0];
    const reactionManifestation = reaction?.manifestation?.[0]?.coding?.[0];
    const protocol = immunization.protocolApplied?.[0];

    return {
        id: immunization.id,
        identifier: immunization.identifier?.[0]?.value,
        basedOn: immunization.basedOn?.map((ref: any) => ref.reference)?.filter(Boolean),
        status: immunization.status,
        statusReason: statusReasonCoding ? {
            system: statusReasonCoding.system,
            code: statusReasonCoding.code,
            display: statusReasonCoding.display
        } : undefined,
        vaccineCode: vaccineCoding ? {
            system: vaccineCoding.system,
            code: vaccineCoding.code,
            display: vaccineCoding.display
        } : undefined,
        manufacturer: immunization.manufacturer?.reference?.replace('Organization/', '') || undefined,
        lotNumber: immunization.lotNumber,
        expirationDate: immunization.expirationDate,
        patient: immunization.patient?.reference?.replace('Patient/', ''),
        encounter: immunization.encounter?.reference?.replace('Encounter/', ''),
        supportingInformation: immunization.supportingInformation?.map((ref: any) => ref.reference)?.filter(Boolean),
        occurrenceDateTime: immunization.occurrenceDateTime,
        occurrenceString: immunization.occurrenceString,
        primarySource: immunization.primarySource,
        informationSource: immunization.informationSource?.reference?.replace('Organization/', ''),
        location: immunization.location?.reference?.replace('Location/', ''),
        site: siteCoding ? { system: siteCoding.system, code: siteCoding.code, display: siteCoding.display } : undefined,
        route: routeCoding ? { system: routeCoding.system, code: routeCoding.code, display: routeCoding.display } : undefined,
        doseQuantity: immunization.doseQuantity ? {
            value: immunization.doseQuantity.value,
            unit: immunization.doseQuantity.unit
        } : undefined,
        performer: performer ? [{
            function: performer.function?.coding?.[0] ? {
                system: performer.function.coding[0].system,
                code: performer.function.coding[0].code,
                display: performer.function.coding[0].display
            } : undefined,
            actor: performer.actor?.reference?.split('/').pop()
        }] : undefined,
        note: immunization.note?.map((note: any) => note.text).filter(Boolean),
        reason: immunization.reasonCode?.map((reason: any) => ({
            code: reason.coding?.[0]
                ? {
                    system: reason.coding[0].system,
                    code: reason.coding[0].code,
                    display: reason.coding[0].display
                }
                : undefined
        })),
        isSubpotent: immunization.isSubpotent,
        subpotentReason: immunization.subpotentReason?.map((reason: any) => ({
            system: reason.coding?.[0]?.system,
            code: reason.coding?.[0]?.code,
            display: reason.coding?.[0]?.display
        })),
        programEligibility: immunization.programEligibility?.map((program: any) => ({
            program: program.program?.coding?.[0] ? {
                system: program.program.coding[0].system,
                code: program.program.coding[0].code,
                display: program.program.coding[0].display
            } : undefined,
            programStatus: program.programStatus?.coding?.[0] ? {
                system: program.programStatus.coding[0].system,
                code: program.programStatus.coding[0].code,
                display: program.programStatus.coding[0].display
            } : undefined
        })),
        fundingSource: immunization.fundingSource?.coding?.[0] ? {
            system: immunization.fundingSource.coding[0].system,
            code: immunization.fundingSource.coding[0].code,
            display: immunization.fundingSource.coding[0].display
        } : undefined,
        reaction: reaction ? [{
            date: reaction.date,
            manifestation: reactionManifestation ? {
                system: reactionManifestation.system,
                code: reactionManifestation.code,
                display: reactionManifestation.display
            } : undefined,
            reported: reaction.reported
        }] : undefined,
        protocolApplied: protocol ? [{
            series: protocol.series,
            authority: protocol.authority?.reference?.replace('Organization/', ''),
            targetDisease: protocol.targetDisease?.map((disease: any) => ({
                system: disease.coding?.[0]?.system,
                code: disease.coding?.[0]?.code,
                display: disease.coding?.[0]?.display
            })),
            doseNumber: protocol.doseNumberString || protocol.doseNumberPositiveInt?.toString(),
            seriesDoses: protocol.seriesDosesString || protocol.seriesDosesPositiveInt?.toString()
        }] : undefined
    };
}

function mapR4DocumentReference(docRef: any): CanonicalDocumentReference {
    return {
        id: docRef.id,
        identifier: docRef.identifier?.[0]?.value,
        status: docRef.status,
        type: docRef.type ? {
            coding: docRef.type.coding?.map((c: any) => ({
                system: c.system,
                code: c.code,
                display: c.display
            }))
        } : undefined,
        category: docRef.category?.map((cat: any) => ({
            coding: cat.coding?.map((c: any) => ({
                system: c.system,
                code: c.code,
                display: c.display
            }))
        })),
        subject: docRef.subject?.reference?.replace('Patient/', ''),
        date: docRef.date,
        author: docRef.author?.map((a: any) => a.reference?.replace(/^(Practitioner|Organization)\//, '')),
        custodian: docRef.custodian?.reference?.replace('Organization/', ''),
        content: docRef.content?.map((c: any) => ({
            attachment: {
                contentType: c.attachment?.contentType,
                url: c.attachment?.url,
                title: c.attachment?.title,
                data: c.attachment?.data,
                format: c.format?.code
            }
        })),
        description: docRef.description,
        context: docRef.context ? {
            encounter: docRef.context.encounter?.map((e: any) => e.reference?.replace('Encounter/', '')),
            period: docRef.context.period
        } : undefined,
        active: docRef.status === 'current'
    };
}
