
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
    CanonicalProcedure,
    CanonicalCondition,
    CanonicalAppointment,
    CanonicalSchedule,
    CanonicalSlot,
    CanonicalDiagnosticReport,
    CanonicalRelatedPerson,
    CanonicalLocation,
    CanonicalEpisodeOfCare
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
        procedures: [],
        conditions: [],
        appointments: [],
        schedules: [],
        slots: [],
        diagnosticReports: [],
        relatedPersons: [],
        locations: [],
        episodesOfCare: [],
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
