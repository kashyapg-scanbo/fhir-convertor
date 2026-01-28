
import {
    CanonicalModel,
    CanonicalPatient,
    CanonicalEncounter,
    CanonicalEncounterHistory,
    CanonicalFlag,
    CanonicalList,
    CanonicalNutritionIntake,
    CanonicalNutritionOrder,
    CanonicalObservation,
    CanonicalPractitioner,
    CanonicalPractitionerRole,
    CanonicalOrganization,
    CanonicalMedication,
    CanonicalMedicationRequest,
    CanonicalDocumentReference,
    CanonicalMedicationStatement,
    CanonicalMedicationAdministration,
    CanonicalMedicationDispense,
    CanonicalDeviceDispense,
    CanonicalDeviceRequest,
    CanonicalDeviceUsage,
    CanonicalProcedure,
    CanonicalCondition,
    CanonicalAppointment,
    CanonicalAppointmentResponse,
    CanonicalClaim,
    CanonicalClaimResponse,
    CanonicalExplanationOfBenefit,
    CanonicalComposition,
    CanonicalCoverage,
    CanonicalBinary,
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
    CanonicalOperationOutcome,
    CanonicalParameters,
    CanonicalCarePlan,
    CanonicalCareTeam,
    CanonicalGoal,
    CanonicalRiskAssessment,
    CanonicalServiceRequest,
    CanonicalTask,
    CanonicalCommunication,
    CanonicalCommunicationRequest,
    CanonicalQuestionnaire,
    CanonicalQuestionnaireResponse,
    CanonicalCodeSystem,
    CanonicalValueSet,
    CanonicalConceptMap,
    CanonicalNamingSystem,
    CanonicalTerminologyCapabilities,
    CanonicalProvenance,
    CanonicalAuditEvent,
    CanonicalConsent,
    CanonicalAccount
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
        medicationDispenses: [],
        deviceDispenses: [],
        deviceRequests: [],
        deviceUsages: [],
        encounterHistories: [],
        flags: [],
        lists: [],
        nutritionIntakes: [],
        nutritionOrders: [],
        riskAssessments: [],
        procedures: [],
        conditions: [],
        appointments: [],
        appointmentResponses: [],
        claims: [],
        claimResponses: [],
        explanationOfBenefits: [],
        compositions: [],
        coverages: [],
        accounts: [],
        carePlans: [],
        careTeams: [],
        goals: [],
        serviceRequests: [],
        tasks: [],
        communications: [],
        communicationRequests: [],
        questionnaires: [],
        questionnaireResponses: [],
        codeSystems: [],
        valueSets: [],
        conceptMaps: [],
        namingSystems: [],
        terminologyCapabilities: [],
        provenances: [],
        auditEvents: [],
        consents: [],
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
        parameters: [],
        practitioners: [],
        practitionerRoles: [],
        organizations: [],
        documentReferences: [],
        binaries: [],
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
            case 'AppointmentResponse':
                const appointmentResponse = mapR4AppointmentResponse(res);
                if (appointmentResponse) model.appointmentResponses?.push(appointmentResponse);
                break;
            case 'Claim':
                const claim = mapR4Claim(res);
                if (claim) model.claims?.push(claim);
                break;
            case 'ClaimResponse':
                const claimResponse = mapR4ClaimResponse(res);
                if (claimResponse) model.claimResponses?.push(claimResponse);
                break;
            case 'ExplanationOfBenefit':
                const explanationOfBenefit = mapR4ExplanationOfBenefit(res);
                if (explanationOfBenefit) model.explanationOfBenefits?.push(explanationOfBenefit);
                break;
            case 'Composition':
                const composition = mapR4Composition(res);
                if (composition) model.compositions?.push(composition);
                break;
            case 'Coverage':
                const coverage = mapR4Coverage(res);
                if (coverage) model.coverages?.push(coverage);
                break;
            case 'Account':
                const account = mapR4Account(res);
                if (account) model.accounts?.push(account);
                break;
            case 'CarePlan':
                const carePlan = mapR4CarePlan(res);
                if (carePlan) model.carePlans?.push(carePlan);
                break;
            case 'CareTeam':
                const careTeam = mapR4CareTeam(res);
                if (careTeam) model.careTeams?.push(careTeam);
                break;
            case 'Goal':
                const goal = mapR4Goal(res);
                if (goal) model.goals?.push(goal);
                break;
            case 'ServiceRequest':
                const serviceRequest = mapR4ServiceRequest(res);
                if (serviceRequest) model.serviceRequests?.push(serviceRequest);
                break;
            case 'Task':
                const task = mapR4Task(res);
                if (task) model.tasks?.push(task);
                break;
            case 'Communication':
                const communication = mapR4Communication(res);
                if (communication) model.communications?.push(communication);
                break;
            case 'CommunicationRequest':
                const communicationRequest = mapR4CommunicationRequest(res);
                if (communicationRequest) model.communicationRequests?.push(communicationRequest);
                break;
            case 'Questionnaire':
                const questionnaire = mapR4Questionnaire(res);
                if (questionnaire) model.questionnaires?.push(questionnaire);
                break;
            case 'QuestionnaireResponse':
                const questionnaireResponse = mapR4QuestionnaireResponse(res);
                if (questionnaireResponse) model.questionnaireResponses?.push(questionnaireResponse);
                break;
            case 'CodeSystem':
                const codeSystem = mapR4CodeSystem(res);
                if (codeSystem) model.codeSystems?.push(codeSystem);
                break;
            case 'ValueSet':
                const valueSet = mapR4ValueSet(res);
                if (valueSet) model.valueSets?.push(valueSet);
                break;
            case 'ConceptMap':
                const conceptMap = mapR4ConceptMap(res);
                if (conceptMap) model.conceptMaps?.push(conceptMap);
                break;
            case 'NamingSystem':
                const namingSystem = mapR4NamingSystem(res);
                if (namingSystem) model.namingSystems?.push(namingSystem);
                break;
            case 'TerminologyCapabilities':
                const terminologyCapabilities = mapR4TerminologyCapabilities(res);
                if (terminologyCapabilities) model.terminologyCapabilities?.push(terminologyCapabilities);
                break;
            case 'Provenance':
                const provenance = mapR4Provenance(res);
                if (provenance) model.provenances?.push(provenance);
                break;
            case 'AuditEvent':
                const auditEvent = mapR4AuditEvent(res);
                if (auditEvent) model.auditEvents?.push(auditEvent);
                break;
            case 'Consent':
                const consent = mapR4Consent(res);
                if (consent) model.consents?.push(consent);
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
            case 'MedicationDispense':
                const medicationDispense = mapR4MedicationDispense(res);
                if (medicationDispense) model.medicationDispenses?.push(medicationDispense);
                break;
            case 'DeviceDispense':
                const deviceDispense = mapR4DeviceDispense(res);
                if (deviceDispense) model.deviceDispenses?.push(deviceDispense);
                break;
            case 'DeviceRequest':
                const deviceRequest = mapR4DeviceRequest(res);
                if (deviceRequest) model.deviceRequests?.push(deviceRequest);
                break;
            case 'DeviceUsage':
                const deviceUsage = mapR4DeviceUsage(res);
                if (deviceUsage) model.deviceUsages?.push(deviceUsage);
                break;
            case 'EncounterHistory':
                const encounterHistory = mapR4EncounterHistory(res);
                if (encounterHistory) model.encounterHistories?.push(encounterHistory);
                break;
            case 'Flag':
                const flag = mapR4Flag(res);
                if (flag) model.flags?.push(flag);
                break;
            case 'List':
                const list = mapR4List(res);
                if (list) model.lists?.push(list);
                break;
            case 'NutritionIntake':
                const nutritionIntake = mapR4NutritionIntake(res);
                if (nutritionIntake) model.nutritionIntakes?.push(nutritionIntake);
                break;
            case 'NutritionOrder':
                const nutritionOrder = mapR4NutritionOrder(res);
                if (nutritionOrder) model.nutritionOrders?.push(nutritionOrder);
                break;
            case 'RiskAssessment':
                const riskAssessment = mapR4RiskAssessment(res);
                if (riskAssessment) model.riskAssessments?.push(riskAssessment);
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
            case 'Parameters':
                const parameters = mapR4Parameters(res);
                if (parameters) model.parameters?.push(parameters);
                break;
            case 'DocumentReference':
                const docRef = mapR4DocumentReference(res);
                if (docRef) model.documentReferences?.push(docRef);
                break;
            case 'Binary':
                const binary = mapR4Binary(res);
                if (binary) model.binaries?.push(binary);
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

function mapR4MedicationDispense(dispense: any): CanonicalMedicationDispense {
    return {
        id: dispense.id,
        identifier: dispense.identifier?.[0]?.value,
        basedOn: dispense.basedOn?.map((ref: any) => ref.reference).filter(Boolean),
        partOf: dispense.partOf?.map((ref: any) => ref.reference).filter(Boolean),
        status: dispense.status,
        statusChanged: dispense.statusChanged,
        category: dispense.category?.map((cat: any) => cat.coding?.[0]).filter(Boolean).map((coding: any) => ({
            system: coding.system,
            code: coding.code,
            display: coding.display
        })),
        medicationCodeableConcept: dispense.medicationCodeableConcept ? {
            coding: dispense.medicationCodeableConcept.coding?.map((coding: any) => ({
                system: coding.system,
                code: coding.code,
                display: coding.display
            })),
            text: dispense.medicationCodeableConcept.text
        } : undefined,
        medicationReference: dispense.medicationReference?.reference?.replace('Medication/', ''),
        subject: dispense.subject?.reference?.replace('Patient/', ''),
        encounter: dispense.encounter?.reference?.replace('Encounter/', ''),
        supportingInformation: dispense.supportingInformation?.map((ref: any) => ref.reference).filter(Boolean),
        performer: dispense.performer?.map((perf: any) => ({
            function: perf.function?.coding?.[0] ? {
                system: perf.function.coding[0].system,
                code: perf.function.coding[0].code,
                display: perf.function.coding[0].display
            } : undefined,
            actor: perf.actor?.reference?.split('/').pop()
        })),
        location: dispense.location?.reference?.replace('Location/', ''),
        authorizingPrescription: dispense.authorizingPrescription?.map((ref: any) => ref.reference).filter(Boolean),
        type: dispense.type?.coding?.[0] ? {
            system: dispense.type.coding[0].system,
            code: dispense.type.coding[0].code,
            display: dispense.type.coding[0].display
        } : undefined,
        quantity: dispense.quantity ? {
            value: dispense.quantity.value,
            unit: dispense.quantity.unit
        } : undefined,
        daysSupply: dispense.daysSupply ? {
            value: dispense.daysSupply.value,
            unit: dispense.daysSupply.unit
        } : undefined,
        recorded: dispense.recorded,
        whenPrepared: dispense.whenPrepared,
        whenHandedOver: dispense.whenHandedOver,
        destination: dispense.destination?.reference?.replace('Location/', ''),
        receiver: dispense.receiver?.map((ref: any) => ref.reference).filter(Boolean),
        note: dispense.note?.map((note: any) => note.text).filter(Boolean),
        renderedDosageInstruction: dispense.renderedDosageInstruction,
        dosageInstruction: dispense.dosageInstruction,
        substitution: dispense.substitution ? {
            wasSubstituted: dispense.substitution.wasSubstituted,
            type: dispense.substitution.type?.coding?.[0] ? {
                system: dispense.substitution.type.coding[0].system,
                code: dispense.substitution.type.coding[0].code,
                display: dispense.substitution.type.coding[0].display
            } : undefined,
            reason: dispense.substitution.reason?.map((r: any) => ({
                system: r?.coding?.[0]?.system,
                code: r?.coding?.[0]?.code,
                display: r?.coding?.[0]?.display
            })),
            responsibleParty: dispense.substitution.responsibleParty?.reference
        } : undefined,
        eventHistory: dispense.eventHistory?.map((ref: any) => ref.reference).filter(Boolean)
    };
}

function mapR4DeviceDispense(dispense: any): CanonicalDeviceDispense {
    return {
        id: dispense.id,
        identifier: dispense.identifier?.map((id: any) => ({
            system: id.system,
            value: id.value,
            type: id.type?.coding?.[0] ? {
                system: id.type.coding[0].system,
                code: id.type.coding[0].code,
                display: id.type.coding[0].display
            } : undefined
        })),
        basedOn: dispense.basedOn?.map((ref: any) => ref.reference).filter(Boolean),
        partOf: dispense.partOf?.map((ref: any) => ref.reference).filter(Boolean),
        status: dispense.status,
        statusReason: dispense.statusReason ? {
            concept: dispense.statusReason.concept?.coding?.[0] ? {
                system: dispense.statusReason.concept.coding[0].system,
                code: dispense.statusReason.concept.coding[0].code,
                display: dispense.statusReason.concept.coding[0].display
            } : undefined,
            reference: dispense.statusReason.reference?.reference?.split('/').pop()
        } : undefined,
        category: dispense.category?.map((cat: any) => cat.coding?.[0]).filter(Boolean).map((coding: any) => ({
            system: coding.system,
            code: coding.code,
            display: coding.display
        })),
        deviceCodeableConcept: dispense.device?.concept?.coding?.[0] ? {
            system: dispense.device.concept.coding[0].system,
            code: dispense.device.concept.coding[0].code,
            display: dispense.device.concept.coding[0].display
        } : undefined,
        deviceReference: dispense.device?.reference?.reference?.split('/').pop(),
        subject: dispense.subject?.reference?.split('/').pop(),
        receiver: dispense.receiver?.reference?.split('/').pop(),
        encounter: dispense.encounter?.reference?.replace('Encounter/', ''),
        supportingInformation: dispense.supportingInformation?.map((ref: any) => ref.reference).filter(Boolean),
        performer: dispense.performer?.map((perf: any) => ({
            function: perf.function?.coding?.[0] ? {
                system: perf.function.coding[0].system,
                code: perf.function.coding[0].code,
                display: perf.function.coding[0].display
            } : undefined,
            actor: perf.actor?.reference?.split('/').pop()
        })),
        location: dispense.location?.reference?.replace('Location/', ''),
        type: dispense.type?.coding?.[0] ? {
            system: dispense.type.coding[0].system,
            code: dispense.type.coding[0].code,
            display: dispense.type.coding[0].display
        } : undefined,
        quantity: dispense.quantity ? {
            value: dispense.quantity.value,
            unit: dispense.quantity.unit,
            system: dispense.quantity.system,
            code: dispense.quantity.code
        } : undefined,
        preparedDate: dispense.preparedDate,
        whenHandedOver: dispense.whenHandedOver,
        destination: dispense.destination?.reference?.replace('Location/', ''),
        note: dispense.note?.map((note: any) => note.text).filter(Boolean),
        usageInstruction: dispense.usageInstruction,
        eventHistory: dispense.eventHistory?.map((ref: any) => ref.reference).filter(Boolean)
    };
}

function mapR4DeviceRequest(request: any): CanonicalDeviceRequest {
    const reasonReferences = [
        ...(request.reasonReference || []).map((ref: any) => ref.reference).filter(Boolean),
        ...(request.reason || []).map((reason: any) => reason.reference).filter(Boolean)
    ];
    const reasonCodes = (request.reasonCode || []).map((code: any) => code.text || code.coding?.[0]?.code).filter(Boolean);

    return {
        id: request.id,
        identifier: request.identifier?.map((id: any) => ({
            system: id.system,
            value: id.value,
            type: id.type?.coding?.[0] ? {
                system: id.type.coding[0].system,
                code: id.type.coding[0].code,
                display: id.type.coding[0].display
            } : undefined
        })),
        instantiatesCanonical: request.instantiatesCanonical,
        instantiatesUri: request.instantiatesUri,
        basedOn: request.basedOn?.map((ref: any) => ref.reference).filter(Boolean),
        replaces: request.replaces?.map((ref: any) => ref.reference?.replace(/^DeviceRequest\//, '')).filter(Boolean),
        groupIdentifier: request.groupIdentifier ? {
            system: request.groupIdentifier.system,
            value: request.groupIdentifier.value,
            type: request.groupIdentifier.type?.coding?.[0] ? {
                system: request.groupIdentifier.type.coding[0].system,
                code: request.groupIdentifier.type.coding[0].code,
                display: request.groupIdentifier.type.coding[0].display
            } : undefined
        } : undefined,
        status: request.status,
        intent: request.intent,
        priority: request.priority,
        doNotPerform: request.doNotPerform,
        codeCodeableConcept: request.codeCodeableConcept?.coding?.[0] ? {
            system: request.codeCodeableConcept.coding[0].system,
            code: request.codeCodeableConcept.coding[0].code,
            display: request.codeCodeableConcept.coding[0].display
        } : undefined,
        codeReference: request.codeReference?.reference?.split('/').pop(),
        quantity: request.quantity?.value,
        parameter: request.parameter?.map((param: any) => ({
            code: param.code?.coding?.[0]
                ? {
                    system: param.code.coding[0].system,
                    code: param.code.coding[0].code,
                    display: param.code.coding[0].display
                }
                : undefined,
            valueCodeableConcept: param.valueCodeableConcept?.coding?.[0]
                ? {
                    system: param.valueCodeableConcept.coding[0].system,
                    code: param.valueCodeableConcept.coding[0].code,
                    display: param.valueCodeableConcept.coding[0].display
                }
                : undefined,
            valueQuantity: param.valueQuantity
                ? {
                    value: param.valueQuantity.value,
                    unit: param.valueQuantity.unit,
                    system: param.valueQuantity.system,
                    code: param.valueQuantity.code
                }
                : undefined,
            valueBoolean: param.valueBoolean
        })),
        subject: request.subject?.reference?.replace(/^(Device|Group|Location|Patient)\//, ''),
        encounter: request.encounter?.reference?.replace(/^Encounter\//, ''),
        occurrenceDateTime: request.occurrenceDateTime,
        occurrencePeriod: request.occurrencePeriod ? { start: request.occurrencePeriod.start, end: request.occurrencePeriod.end } : undefined,
        occurrenceTiming: request.occurrenceTiming?.code?.text || request.occurrenceTiming?.code?.coding?.[0]?.code,
        authoredOn: request.authoredOn,
        requester: request.requester?.reference?.replace(/^(Device|Organization|Practitioner|PractitionerRole)\//, ''),
        performer: request.performer?.reference?.replace(/^(CareTeam|Device|HealthcareService|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
        reason: [...reasonReferences, ...reasonCodes].filter(Boolean),
        asNeeded: request.asNeededBoolean,
        asNeededFor: request.asNeededCodeableConcept?.coding?.[0]
            ? {
                system: request.asNeededCodeableConcept.coding[0].system,
                code: request.asNeededCodeableConcept.coding[0].code,
                display: request.asNeededCodeableConcept.coding[0].display
            }
            : undefined,
        insurance: request.insurance?.map((ref: any) => ref.reference?.replace(/^(ClaimResponse|Coverage)\//, '')).filter(Boolean),
        supportingInfo: request.supportingInfo?.map((info: any) => info.reference).filter(Boolean),
        note: request.note?.map((note: any) => note.text).filter(Boolean),
        relevantHistory: request.relevantHistory?.map((ref: any) => ref.reference).filter(Boolean)
    };
}

function mapR4DeviceUsage(usage: any): CanonicalDeviceUsage {
    return {
        id: usage.id,
        identifier: usage.identifier?.map((id: any) => ({
            system: id.system,
            value: id.value,
            type: id.type?.coding?.[0] ? {
                system: id.type.coding[0].system,
                code: id.type.coding[0].code,
                display: id.type.coding[0].display
            } : undefined
        })),
        basedOn: usage.basedOn?.map((ref: any) => ref.reference?.replace(/^ServiceRequest\//, '')).filter(Boolean),
        status: usage.status,
        category: usage.category?.map((cat: any) => cat.coding?.[0]).filter(Boolean).map((coding: any) => ({
            system: coding.system,
            code: coding.code,
            display: coding.display
        })),
        patient: usage.patient?.reference?.replace(/^Patient\//, ''),
        derivedFrom: usage.derivedFrom?.map((ref: any) => ref.reference).filter(Boolean),
        context: usage.context?.reference?.replace(/^(Encounter|EpisodeOfCare)\//, ''),
        timingTiming: usage.timingTiming?.code?.text || usage.timingTiming?.code?.coding?.[0]?.code,
        timingPeriod: usage.timingPeriod ? { start: usage.timingPeriod.start, end: usage.timingPeriod.end } : undefined,
        timingDateTime: usage.timingDateTime,
        dateAsserted: usage.dateAsserted,
        usageStatus: usage.usageStatus?.coding?.[0]
            ? {
                system: usage.usageStatus.coding[0].system,
                code: usage.usageStatus.coding[0].code,
                display: usage.usageStatus.coding[0].display
            }
            : undefined,
        usageReason: usage.usageReason?.map((reason: any) => reason.coding?.[0]).filter(Boolean).map((coding: any) => ({
            system: coding.system,
            code: coding.code,
            display: coding.display
        })),
        adherence: usage.adherence ? {
            code: usage.adherence.code?.coding?.[0]
                ? {
                    system: usage.adherence.code.coding[0].system,
                    code: usage.adherence.code.coding[0].code,
                    display: usage.adherence.code.coding[0].display
                }
                : undefined,
            reason: usage.adherence.reason?.map((reason: any) => reason.coding?.[0]).filter(Boolean).map((coding: any) => ({
                system: coding.system,
                code: coding.code,
                display: coding.display
            }))
        } : undefined,
        informationSource: usage.informationSource?.reference?.replace(/^(Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
        deviceCodeableConcept: usage.device?.concept?.coding?.[0]
            ? {
                system: usage.device.concept.coding[0].system,
                code: usage.device.concept.coding[0].code,
                display: usage.device.concept.coding[0].display
            }
            : undefined,
        deviceReference: usage.device?.reference?.reference?.split('/').pop(),
        reason: usage.reason?.map((ref: any) => ref.reference).filter(Boolean),
        bodySite: usage.bodySite?.reference?.split('/').pop(),
        note: usage.note?.map((note: any) => note.text).filter(Boolean)
    };
}

function mapR4EncounterHistory(history: any): CanonicalEncounterHistory {
    return {
        id: history.id,
        encounter: history.encounter?.reference?.replace(/^Encounter\//, ''),
        identifier: history.identifier?.map((id: any) => ({
            system: id.system,
            value: id.value,
            type: id.type?.coding?.[0] ? {
                system: id.type.coding[0].system,
                code: id.type.coding[0].code,
                display: id.type.coding[0].display
            } : undefined
        })),
        status: history.status,
        class: history.class?.coding?.[0]
            ? {
                system: history.class.coding[0].system,
                code: history.class.coding[0].code,
                display: history.class.coding[0].display
            }
            : undefined,
        type: history.type?.map((type: any) => type.coding?.[0]).filter(Boolean).map((coding: any) => ({
            system: coding.system,
            code: coding.code,
            display: coding.display
        })),
        serviceType: history.serviceType?.map((service: any) => ({
            concept: service.concept?.coding?.[0]
                ? {
                    system: service.concept.coding[0].system,
                    code: service.concept.coding[0].code,
                    display: service.concept.coding[0].display
                }
                : undefined,
            reference: service.reference?.reference?.replace(/^HealthcareService\//, '')
        })),
        subject: history.subject?.reference?.replace(/^(Group|Patient)\//, ''),
        subjectStatus: history.subjectStatus?.coding?.[0]
            ? {
                system: history.subjectStatus.coding[0].system,
                code: history.subjectStatus.coding[0].code,
                display: history.subjectStatus.coding[0].display
            }
            : undefined,
        actualPeriod: history.actualPeriod ? { start: history.actualPeriod.start, end: history.actualPeriod.end } : undefined,
        plannedStartDate: history.plannedStartDate,
        plannedEndDate: history.plannedEndDate,
        length: history.length
            ? {
                value: history.length.value,
                unit: history.length.unit,
                system: history.length.system,
                code: history.length.code
            }
            : undefined,
        location: history.location?.map((loc: any) => ({
            location: loc.location?.reference?.replace(/^Location\//, ''),
            form: loc.form?.coding?.[0]
                ? {
                    system: loc.form.coding[0].system,
                    code: loc.form.coding[0].code,
                    display: loc.form.coding[0].display
                }
                : undefined
        }))
    };
}

function mapR4Flag(flag: any): CanonicalFlag {
    return {
        id: flag.id,
        identifier: flag.identifier?.map((id: any) => ({
            system: id.system,
            value: id.value,
            type: id.type?.coding?.[0] ? {
                system: id.type.coding[0].system,
                code: id.type.coding[0].code,
                display: id.type.coding[0].display
            } : undefined
        })),
        status: flag.status,
        category: flag.category?.map((cat: any) => cat.coding?.[0]).filter(Boolean).map((coding: any) => ({
            system: coding.system,
            code: coding.code,
            display: coding.display
        })),
        code: flag.code?.coding?.[0]
            ? {
                system: flag.code.coding[0].system,
                code: flag.code.coding[0].code,
                display: flag.code.coding[0].display
            }
            : undefined,
        subject: flag.subject?.reference?.replace(/^(Group|Location|Medication|Organization|Patient|PlanDefinition|Practitioner|PractitionerRole|Procedure|RelatedPerson)\//, ''),
        period: flag.period ? { start: flag.period.start, end: flag.period.end } : undefined,
        encounter: flag.encounter?.reference?.replace(/^Encounter\//, ''),
        author: flag.author?.reference?.replace(/^(Device|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, '')
    };
}

function mapR4List(list: any): CanonicalList {
    const entry = list.entry?.map((item: any) => ({
        flag: item.flag?.coding?.[0]
            ? {
                system: item.flag.coding[0].system,
                code: item.flag.coding[0].code,
                display: item.flag.coding[0].display
            }
            : undefined,
        deleted: item.deleted,
        date: item.date,
        item: item.item?.reference
    }));

    return {
        id: list.id,
        identifier: list.identifier?.map((id: any) => ({
            system: id.system,
            value: id.value,
            type: id.type?.coding?.[0] ? {
                system: id.type.coding[0].system,
                code: id.type.coding[0].code,
                display: id.type.coding[0].display
            } : undefined
        })),
        status: list.status,
        mode: list.mode,
        title: list.title,
        code: list.code?.coding?.[0]
            ? {
                system: list.code.coding[0].system,
                code: list.code.coding[0].code,
                display: list.code.coding[0].display
            }
            : undefined,
        subject: list.subject?.map((ref: any) => ref.reference).filter(Boolean),
        encounter: list.encounter?.reference?.replace(/^Encounter\//, ''),
        date: list.date,
        source: list.source?.reference?.replace(/^(CareTeam|Device|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
        orderedBy: list.orderedBy?.coding?.[0]
            ? {
                system: list.orderedBy.coding[0].system,
                code: list.orderedBy.coding[0].code,
                display: list.orderedBy.coding[0].display
            }
            : undefined,
        note: list.note?.map((note: any) => note.text).filter(Boolean),
        entry: entry?.length ? entry : undefined,
        emptyReason: list.emptyReason?.coding?.[0]
            ? {
                system: list.emptyReason.coding[0].system,
                code: list.emptyReason.coding[0].code,
                display: list.emptyReason.coding[0].display
            }
            : undefined
    };
}

function mapR4NutritionIntake(intake: any): CanonicalNutritionIntake {
    return {
        id: intake.id,
        identifier: intake.identifier?.map((id: any) => ({
            system: id.system,
            value: id.value,
            type: id.type?.coding?.[0] ? {
                system: id.type.coding[0].system,
                code: id.type.coding[0].code,
                display: id.type.coding[0].display
            } : undefined
        })),
        instantiatesCanonical: intake.instantiatesCanonical,
        instantiatesUri: intake.instantiatesUri,
        basedOn: intake.basedOn?.map((ref: any) => ref.reference?.replace(/^(CarePlan|NutritionOrder|ServiceRequest)\//, '')).filter(Boolean),
        partOf: intake.partOf?.map((ref: any) => ref.reference?.replace(/^(NutritionIntake|Observation|Procedure)\//, '')).filter(Boolean),
        status: intake.status,
        statusReason: intake.statusReason?.map((reason: any) => reason.coding?.[0]).filter(Boolean).map((coding: any) => ({
            system: coding.system,
            code: coding.code,
            display: coding.display
        })),
        code: intake.code?.coding?.[0]
            ? {
                system: intake.code.coding[0].system,
                code: intake.code.coding[0].code,
                display: intake.code.coding[0].display
            }
            : undefined,
        subject: intake.subject?.reference?.replace(/^(Group|Patient)\//, ''),
        encounter: intake.encounter?.reference?.replace(/^Encounter\//, ''),
        occurrenceDateTime: intake.occurrenceDateTime,
        occurrencePeriod: intake.occurrencePeriod ? { start: intake.occurrencePeriod.start, end: intake.occurrencePeriod.end } : undefined,
        recorded: intake.recorded,
        reportedBoolean: intake.reportedBoolean,
        reportedReference: intake.reportedReference?.reference?.replace(/^(Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
        consumedItem: intake.consumedItem?.map((item: any) => ({
            type: item.type?.coding?.[0]
                ? {
                    system: item.type.coding[0].system,
                    code: item.type.coding[0].code,
                    display: item.type.coding[0].display
                }
                : undefined,
            nutritionProductCodeableConcept: item.nutritionProduct?.concept?.coding?.[0]
                ? {
                    system: item.nutritionProduct.concept.coding[0].system,
                    code: item.nutritionProduct.concept.coding[0].code,
                    display: item.nutritionProduct.concept.coding[0].display
                }
                : undefined,
            nutritionProductReference: item.nutritionProduct?.reference?.reference?.replace(/^NutritionProduct\//, ''),
            schedule: item.schedule?.code?.text || item.schedule?.code?.coding?.[0]?.code,
            amount: item.amount
                ? {
                    value: item.amount.value,
                    unit: item.amount.unit,
                    system: item.amount.system,
                    code: item.amount.code
                }
                : undefined,
            rate: item.rate
                ? {
                    value: item.rate.value,
                    unit: item.rate.unit,
                    system: item.rate.system,
                    code: item.rate.code
                }
                : undefined,
            notConsumed: item.notConsumed,
            notConsumedReason: item.notConsumedReason?.coding?.[0]
                ? {
                    system: item.notConsumedReason.coding[0].system,
                    code: item.notConsumedReason.coding[0].code,
                    display: item.notConsumedReason.coding[0].display
                }
                : undefined
        })),
        ingredientLabel: intake.ingredientLabel?.map((item: any) => ({
            nutrientCodeableConcept: item.nutrient?.concept?.coding?.[0]
                ? {
                    system: item.nutrient.concept.coding[0].system,
                    code: item.nutrient.concept.coding[0].code,
                    display: item.nutrient.concept.coding[0].display
                }
                : undefined,
            nutrientReference: item.nutrient?.reference?.reference?.replace(/^Substance\//, ''),
            amount: item.amount
                ? {
                    value: item.amount.value,
                    unit: item.amount.unit,
                    system: item.amount.system,
                    code: item.amount.code
                }
                : undefined
        })),
        performer: intake.performer?.map((perf: any) => ({
            function: perf.function?.coding?.[0]
                ? {
                    system: perf.function.coding[0].system,
                    code: perf.function.coding[0].code,
                    display: perf.function.coding[0].display
                }
                : undefined,
            actor: perf.actor?.reference?.split('/').pop()
        })),
        location: intake.location?.reference?.replace(/^Location\//, ''),
        derivedFrom: intake.derivedFrom?.map((ref: any) => ref.reference).filter(Boolean),
        reason: intake.reason?.map((ref: any) => ref.reference).filter(Boolean),
        note: intake.note?.map((note: any) => note.text).filter(Boolean)
    };
}

function mapR4NutritionOrder(order: any): CanonicalNutritionOrder {
    return {
        id: order.id,
        identifier: order.identifier?.map((id: any) => ({
            system: id.system,
            value: id.value,
            type: id.type?.coding?.[0] ? {
                system: id.type.coding[0].system,
                code: id.type.coding[0].code,
                display: id.type.coding[0].display
            } : undefined
        })),
        instantiatesCanonical: order.instantiatesCanonical,
        instantiatesUri: order.instantiatesUri,
        instantiates: order.instantiates,
        basedOn: order.basedOn?.map((ref: any) => ref.reference?.replace(/^(CarePlan|NutritionOrder|ServiceRequest)\//, '')).filter(Boolean),
        groupIdentifier: order.groupIdentifier ? {
            system: order.groupIdentifier.system,
            value: order.groupIdentifier.value,
            type: order.groupIdentifier.type?.coding?.[0] ? {
                system: order.groupIdentifier.type.coding[0].system,
                code: order.groupIdentifier.type.coding[0].code,
                display: order.groupIdentifier.type.coding[0].display
            } : undefined
        } : undefined,
        status: order.status,
        intent: order.intent,
        priority: order.priority,
        subject: order.subject?.reference?.replace(/^(Group|Patient)\//, ''),
        encounter: order.encounter?.reference?.replace(/^Encounter\//, ''),
        supportingInformation: order.supportingInformation?.map((ref: any) => ref.reference).filter(Boolean),
        dateTime: order.dateTime,
        orderer: order.orderer?.reference?.replace(/^(Practitioner|PractitionerRole)\//, ''),
        performer: order.performer?.map((perf: any) => ({
            concept: perf.concept?.coding?.[0]
                ? {
                    system: perf.concept.coding[0].system,
                    code: perf.concept.coding[0].code,
                    display: perf.concept.coding[0].display
                }
                : undefined,
            reference: perf.reference?.reference?.split('/').pop()
        })),
        allergyIntolerance: order.allergyIntolerance?.map((ref: any) => ref.reference?.replace(/^AllergyIntolerance\//, '')).filter(Boolean),
        foodPreferenceModifier: order.foodPreferenceModifier?.map((mod: any) => mod.coding?.[0]).filter(Boolean).map((coding: any) => ({
            system: coding.system,
            code: coding.code,
            display: coding.display
        })),
        excludeFoodModifier: order.excludeFoodModifier?.map((mod: any) => mod.coding?.[0]).filter(Boolean).map((coding: any) => ({
            system: coding.system,
            code: coding.code,
            display: coding.display
        })),
        outsideFoodAllowed: order.outsideFoodAllowed,
        oralDiet: order.oralDiet ? {
            type: order.oralDiet.type?.map((type: any) => type.coding?.[0]).filter(Boolean).map((coding: any) => ({
                system: coding.system,
                code: coding.code,
                display: coding.display
            })),
            scheduleTiming: order.oralDiet.schedule?.timing?.[0]?.code?.text || order.oralDiet.schedule?.timing?.[0]?.code?.coding?.[0]?.code,
            asNeeded: order.oralDiet.schedule?.asNeeded,
            asNeededFor: order.oralDiet.schedule?.asNeededFor?.coding?.[0]
                ? {
                    system: order.oralDiet.schedule.asNeededFor.coding[0].system,
                    code: order.oralDiet.schedule.asNeededFor.coding[0].code,
                    display: order.oralDiet.schedule.asNeededFor.coding[0].display
                }
                : undefined,
            nutrient: order.oralDiet.nutrient?.map((nutrient: any) => ({
                modifier: nutrient.modifier?.coding?.[0]
                    ? {
                        system: nutrient.modifier.coding[0].system,
                        code: nutrient.modifier.coding[0].code,
                        display: nutrient.modifier.coding[0].display
                    }
                    : undefined,
                amount: nutrient.amount
                    ? {
                        value: nutrient.amount.value,
                        unit: nutrient.amount.unit,
                        system: nutrient.amount.system,
                        code: nutrient.amount.code
                    }
                    : undefined
            })),
            texture: order.oralDiet.texture?.map((texture: any) => ({
                modifier: texture.modifier?.coding?.[0]
                    ? {
                        system: texture.modifier.coding[0].system,
                        code: texture.modifier.coding[0].code,
                        display: texture.modifier.coding[0].display
                    }
                    : undefined,
                foodType: texture.foodType?.coding?.[0]
                    ? {
                        system: texture.foodType.coding[0].system,
                        code: texture.foodType.coding[0].code,
                        display: texture.foodType.coding[0].display
                    }
                    : undefined
            })),
            fluidConsistencyType: order.oralDiet.fluidConsistencyType?.map((fluid: any) => fluid.coding?.[0]).filter(Boolean).map((coding: any) => ({
                system: coding.system,
                code: coding.code,
                display: coding.display
            })),
            instruction: order.oralDiet.instruction
        } : undefined,
        supplement: order.supplement?.map((supp: any) => ({
            typeCodeableConcept: supp.type?.concept?.coding?.[0]
                ? {
                    system: supp.type.concept.coding[0].system,
                    code: supp.type.concept.coding[0].code,
                    display: supp.type.concept.coding[0].display
                }
                : undefined,
            typeReference: supp.type?.reference?.reference?.replace(/^NutritionProduct\//, ''),
            productName: supp.productName,
            scheduleTiming: supp.schedule?.timing?.[0]?.code?.text || supp.schedule?.timing?.[0]?.code?.coding?.[0]?.code,
            asNeeded: supp.schedule?.asNeeded,
            asNeededFor: supp.schedule?.asNeededFor?.coding?.[0]
                ? {
                    system: supp.schedule.asNeededFor.coding[0].system,
                    code: supp.schedule.asNeededFor.coding[0].code,
                    display: supp.schedule.asNeededFor.coding[0].display
                }
                : undefined,
            quantity: supp.quantity
                ? {
                    value: supp.quantity.value,
                    unit: supp.quantity.unit,
                    system: supp.quantity.system,
                    code: supp.quantity.code
                }
                : undefined,
            instruction: supp.instruction
        })),
        enteralFormula: order.enteralFormula ? {
            baseFormulaTypeCodeableConcept: order.enteralFormula.baseFormulaType?.concept?.coding?.[0]
                ? {
                    system: order.enteralFormula.baseFormulaType.concept.coding[0].system,
                    code: order.enteralFormula.baseFormulaType.concept.coding[0].code,
                    display: order.enteralFormula.baseFormulaType.concept.coding[0].display
                }
                : undefined,
            baseFormulaTypeReference: order.enteralFormula.baseFormulaType?.reference?.reference?.replace(/^NutritionProduct\//, ''),
            baseFormulaProductName: order.enteralFormula.baseFormulaProductName,
            deliveryDevice: order.enteralFormula.deliveryDevice?.map((dev: any) => dev.reference?.reference?.replace(/^DeviceDefinition\//, '')).filter(Boolean),
            additive: order.enteralFormula.additive?.map((add: any) => ({
                typeCodeableConcept: add.type?.concept?.coding?.[0]
                    ? {
                        system: add.type.concept.coding[0].system,
                        code: add.type.concept.coding[0].code,
                        display: add.type.concept.coding[0].display
                    }
                    : undefined,
                typeReference: add.type?.reference?.reference?.replace(/^NutritionProduct\//, ''),
                productName: add.productName,
                quantity: add.quantity
                    ? {
                        value: add.quantity.value,
                        unit: add.quantity.unit,
                        system: add.quantity.system,
                        code: add.quantity.code
                    }
                    : undefined
            })),
            caloricDensity: order.enteralFormula.caloricDensity
                ? {
                    value: order.enteralFormula.caloricDensity.value,
                    unit: order.enteralFormula.caloricDensity.unit,
                    system: order.enteralFormula.caloricDensity.system,
                    code: order.enteralFormula.caloricDensity.code
                }
                : undefined,
            routeOfAdministration: order.enteralFormula.routeOfAdministration?.coding?.[0]
                ? {
                    system: order.enteralFormula.routeOfAdministration.coding[0].system,
                    code: order.enteralFormula.routeOfAdministration.coding[0].code,
                    display: order.enteralFormula.routeOfAdministration.coding[0].display
                }
                : undefined,
            administration: order.enteralFormula.administration?.map((admin: any) => ({
                scheduleTiming: admin.schedule?.timing?.[0]?.code?.text || admin.schedule?.timing?.[0]?.code?.coding?.[0]?.code,
                asNeeded: admin.schedule?.asNeeded,
                asNeededFor: admin.schedule?.asNeededFor?.coding?.[0]
                    ? {
                        system: admin.schedule.asNeededFor.coding[0].system,
                        code: admin.schedule.asNeededFor.coding[0].code,
                        display: admin.schedule.asNeededFor.coding[0].display
                    }
                    : undefined,
                quantity: admin.quantity
                    ? {
                        value: admin.quantity.value,
                        unit: admin.quantity.unit,
                        system: admin.quantity.system,
                        code: admin.quantity.code
                    }
                    : undefined,
                rateQuantity: admin.rateQuantity
                    ? {
                        value: admin.rateQuantity.value,
                        unit: admin.rateQuantity.unit,
                        system: admin.rateQuantity.system,
                        code: admin.rateQuantity.code
                    }
                    : undefined,
                rateRatio: admin.rateRatio ? JSON.stringify(admin.rateRatio) : undefined
            })),
            maxVolumeToDeliver: order.enteralFormula.maxVolumeToDeliver
                ? {
                    value: order.enteralFormula.maxVolumeToDeliver.value,
                    unit: order.enteralFormula.maxVolumeToDeliver.unit,
                    system: order.enteralFormula.maxVolumeToDeliver.system,
                    code: order.enteralFormula.maxVolumeToDeliver.code
                }
                : undefined,
            administrationInstruction: order.enteralFormula.administrationInstruction
        } : undefined,
        note: order.note?.map((note: any) => note.text).filter(Boolean)
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

function mapR4Parameters(parameters: any): CanonicalParameters | undefined {
    const entries = parameters.parameter?.map((param: any) => {
        const entry: any = { name: param.name };
        for (const [key, value] of Object.entries(param)) {
            if (!key.startsWith('value') || value === undefined) continue;
            entry[key] = value;
            break;
        }
        return entry;
    }).filter((entry: any) => entry.name);

    if (!entries || entries.length === 0) return undefined;
    return {
        id: parameters.id,
        parameter: entries
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

function mapR4AppointmentResponse(response: any): CanonicalAppointmentResponse {
    return {
        id: response.id,
        identifier: response.identifier?.[0]?.value,
        appointment: response.appointment?.reference?.replace(/^Appointment\//, ''),
        proposedNewTime: response.proposedNewTime,
        start: response.start,
        end: response.end,
        participantType: response.participantType?.map((type: any) => ({
            system: type.coding?.[0]?.system,
            code: type.coding?.[0]?.code,
            display: type.coding?.[0]?.display || type.text
        })),
        actor: response.actor?.reference?.replace(/^(Device|Group|HealthcareService|Location|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
        participantStatus: response.participantStatus,
        comment: response.comment,
        recurring: response.recurring,
        occurrenceDate: response.occurrenceDate,
        recurrenceId: response.recurrenceId
    };
}

function mapR4Claim(claim: any): CanonicalClaim {
    const mapCodeable = (source: any) => {
        if (!source) return undefined;
        const coding = source.coding?.[0];
        return {
            system: coding?.system,
            code: coding?.code,
            display: coding?.display || source.text
        };
    };

    const mapIdentifier = (source: any) => {
        if (!source) return undefined;
        return {
            system: source.system,
            value: source.value,
            type: mapCodeable(source.type)
        };
    };

    const mapPeriod = (source: any) => source ? {
        start: source.start,
        end: source.end
    } : undefined;

    const mapMoney = (source: any) => source ? {
        value: source.value,
        currency: source.currency
    } : undefined;

    const mapQuantity = (source: any) => source ? {
        value: source.value,
        unit: source.unit,
        system: source.system,
        code: source.code
    } : undefined;

    const mapAddress = (source: any) => source ? {
        line: source.line,
        city: source.city,
        state: source.state,
        postalCode: source.postalCode,
        country: source.country
    } : undefined;

    const stripRef = (value?: string, pattern?: RegExp) => {
        if (!value) return undefined;
        if (pattern) return value.replace(pattern, '');
        return value.replace(/^[A-Za-z]+\//, '');
    };

    const mapItem = (item: any) => ({
        sequence: item.sequence,
        traceNumber: item.traceNumber?.map(mapIdentifier).filter(Boolean),
        careTeamSequence: item.careTeamSequence,
        diagnosisSequence: item.diagnosisSequence,
        procedureSequence: item.procedureSequence,
        informationSequence: item.informationSequence,
        revenue: mapCodeable(item.revenue),
        category: mapCodeable(item.category),
        productOrService: mapCodeable(item.productOrService),
        productOrServiceEnd: mapCodeable(item.productOrServiceEnd),
        request: item.request?.map((ref: any) => stripRef(ref.reference)).filter(Boolean),
        modifier: item.modifier?.map(mapCodeable),
        programCode: item.programCode?.map(mapCodeable),
        servicedDate: item.servicedDate,
        servicedPeriod: mapPeriod(item.servicedPeriod),
        locationCodeableConcept: mapCodeable(item.locationCodeableConcept),
        locationAddress: mapAddress(item.locationAddress),
        locationReference: item.locationReference?.reference?.replace(/^Location\//, ''),
        patientPaid: mapMoney(item.patientPaid),
        quantity: mapQuantity(item.quantity),
        unitPrice: mapMoney(item.unitPrice),
        factor: item.factor,
        tax: mapMoney(item.tax),
        net: mapMoney(item.net),
        udi: item.udi?.map((ref: any) => ref.reference?.replace(/^Device\//, '')).filter(Boolean),
        bodySite: item.bodySite?.map((site: any) => ({
            site: site.site?.map((entry: any) => mapCodeable(entry.concept)),
            subSite: site.subSite?.map(mapCodeable)
        })),
        encounter: item.encounter?.map((ref: any) => ref.reference?.replace(/^Encounter\//, '')).filter(Boolean),
        detail: item.detail?.map(mapDetail)
    });

    const mapDetail = (detail: any) => ({
        sequence: detail.sequence,
        traceNumber: detail.traceNumber?.map(mapIdentifier).filter(Boolean),
        revenue: mapCodeable(detail.revenue),
        category: mapCodeable(detail.category),
        productOrService: mapCodeable(detail.productOrService),
        productOrServiceEnd: mapCodeable(detail.productOrServiceEnd),
        modifier: detail.modifier?.map(mapCodeable),
        programCode: detail.programCode?.map(mapCodeable),
        patientPaid: mapMoney(detail.patientPaid),
        quantity: mapQuantity(detail.quantity),
        unitPrice: mapMoney(detail.unitPrice),
        factor: detail.factor,
        tax: mapMoney(detail.tax),
        net: mapMoney(detail.net),
        udi: detail.udi?.map((ref: any) => ref.reference?.replace(/^Device\//, '')).filter(Boolean),
        subDetail: detail.subDetail?.map(mapSubDetail)
    });

    const mapSubDetail = (sub: any) => ({
        sequence: sub.sequence,
        traceNumber: sub.traceNumber?.map(mapIdentifier).filter(Boolean),
        revenue: mapCodeable(sub.revenue),
        category: mapCodeable(sub.category),
        productOrService: mapCodeable(sub.productOrService),
        productOrServiceEnd: mapCodeable(sub.productOrServiceEnd),
        modifier: sub.modifier?.map(mapCodeable),
        programCode: sub.programCode?.map(mapCodeable),
        patientPaid: mapMoney(sub.patientPaid),
        quantity: mapQuantity(sub.quantity),
        unitPrice: mapMoney(sub.unitPrice),
        factor: sub.factor,
        tax: mapMoney(sub.tax),
        net: mapMoney(sub.net),
        udi: sub.udi?.map((ref: any) => ref.reference?.replace(/^Device\//, '')).filter(Boolean)
    });

    return {
        id: claim.id,
        identifier: claim.identifier?.map(mapIdentifier).filter(Boolean),
        traceNumber: claim.traceNumber?.map(mapIdentifier).filter(Boolean),
        status: claim.status,
        type: mapCodeable(claim.type),
        subType: mapCodeable(claim.subType),
        use: claim.use,
        patient: stripRef(claim.patient?.reference, /^Patient\//),
        billablePeriod: mapPeriod(claim.billablePeriod),
        created: claim.created,
        enterer: stripRef(claim.enterer?.reference, /^(Patient|Practitioner|PractitionerRole|RelatedPerson)\//),
        insurer: stripRef(claim.insurer?.reference, /^Organization\//),
        provider: stripRef(claim.provider?.reference, /^(Organization|Practitioner|PractitionerRole)\//),
        priority: mapCodeable(claim.priority),
        fundsReserve: mapCodeable(claim.fundsReserve),
        related: claim.related?.map((rel: any) => ({
            claim: stripRef(rel.claim?.reference, /^Claim\//),
            relationship: mapCodeable(rel.relationship),
            reference: rel.reference ? { system: rel.reference.system, value: rel.reference.value } : undefined
        })),
        prescription: stripRef(claim.prescription?.reference, /^(DeviceRequest|MedicationRequest|VisionPrescription)\//),
        originalPrescription: stripRef(claim.originalPrescription?.reference, /^(DeviceRequest|MedicationRequest|VisionPrescription)\//),
        payee: claim.payee ? {
            type: mapCodeable(claim.payee.type),
            party: stripRef(claim.payee.party?.reference, /^(Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//)
        } : undefined,
        referral: stripRef(claim.referral?.reference, /^ServiceRequest\//),
        encounter: claim.encounter?.map((ref: any) => stripRef(ref.reference, /^Encounter\//)).filter(Boolean),
        facility: stripRef(claim.facility?.reference, /^(Location|Organization)\//),
        diagnosisRelatedGroup: mapCodeable(claim.diagnosisRelatedGroup),
        event: claim.event?.map((evt: any) => ({
            type: mapCodeable(evt.type),
            whenDateTime: evt.whenDateTime,
            whenPeriod: mapPeriod(evt.whenPeriod)
        })),
        careTeam: claim.careTeam?.map((team: any) => ({
            sequence: team.sequence,
            provider: stripRef(team.provider?.reference, /^(Organization|Practitioner|PractitionerRole)\//),
            responsible: team.responsible,
            role: mapCodeable(team.role),
            specialty: mapCodeable(team.specialty)
        })),
        supportingInfo: claim.supportingInfo?.map((info: any) => ({
            sequence: info.sequence,
            category: mapCodeable(info.category),
            code: mapCodeable(info.code),
            timingDate: info.timingDate,
            timingPeriod: mapPeriod(info.timingPeriod),
            valueBoolean: info.valueBoolean,
            valueString: info.valueString,
            valueQuantity: mapQuantity(info.valueQuantity),
            valueAttachment: info.valueAttachment ? {
                contentType: info.valueAttachment.contentType,
                url: info.valueAttachment.url,
                title: info.valueAttachment.title,
                data: info.valueAttachment.data
            } : undefined,
            valueReference: stripRef(info.valueReference?.reference),
            valueIdentifier: info.valueIdentifier ? { system: info.valueIdentifier.system, value: info.valueIdentifier.value } : undefined,
            reason: mapCodeable(info.reason)
        })),
        diagnosis: claim.diagnosis?.map((diag: any) => ({
            sequence: diag.sequence,
            diagnosisCodeableConcept: mapCodeable(diag.diagnosisCodeableConcept),
            diagnosisReference: stripRef(diag.diagnosisReference?.reference, /^Condition\//),
            type: diag.type?.map(mapCodeable),
            onAdmission: mapCodeable(diag.onAdmission)
        })),
        procedure: claim.procedure?.map((proc: any) => ({
            sequence: proc.sequence,
            type: proc.type?.map(mapCodeable),
            date: proc.date,
            procedureCodeableConcept: mapCodeable(proc.procedureCodeableConcept),
            procedureReference: stripRef(proc.procedureReference?.reference, /^Procedure\//),
            udi: proc.udi?.map((ref: any) => stripRef(ref.reference, /^Device\//)).filter(Boolean)
        })),
        insurance: claim.insurance?.map((ins: any) => ({
            sequence: ins.sequence,
            focal: ins.focal,
            identifier: ins.identifier ? { system: ins.identifier.system, value: ins.identifier.value } : undefined,
            coverage: stripRef(ins.coverage?.reference, /^Coverage\//),
            businessArrangement: ins.businessArrangement,
            preAuthRef: ins.preAuthRef,
            claimResponse: stripRef(ins.claimResponse?.reference, /^ClaimResponse\//)
        })),
        accident: claim.accident ? {
            date: claim.accident.date,
            type: mapCodeable(claim.accident.type),
            locationAddress: mapAddress(claim.accident.locationAddress),
            locationReference: stripRef(claim.accident.locationReference?.reference, /^Location\//)
        } : undefined,
        patientPaid: mapMoney(claim.patientPaid),
        item: claim.item?.map(mapItem),
        total: mapMoney(claim.total)
    };
}

function mapR4ClaimResponse(response: any): CanonicalClaimResponse {
    const mapCodeable = (source: any) => {
        if (!source) return undefined;
        const coding = source.coding?.[0];
        return {
            system: coding?.system,
            code: coding?.code,
            display: coding?.display || source.text
        };
    };

    const mapIdentifier = (source: any) => {
        if (!source) return undefined;
        return {
            system: source.system,
            value: source.value,
            type: mapCodeable(source.type)
        };
    };

    const mapPeriod = (source: any) => source ? {
        start: source.start,
        end: source.end
    } : undefined;

    const mapMoney = (source: any) => source ? {
        value: source.value,
        currency: source.currency
    } : undefined;

    const mapQuantity = (source: any) => source ? {
        value: source.value,
        unit: source.unit,
        system: source.system,
        code: source.code
    } : undefined;

    const mapAddress = (source: any) => source ? {
        line: source.line,
        city: source.city,
        state: source.state,
        postalCode: source.postalCode,
        country: source.country
    } : undefined;

    const stripRef = (value?: string, pattern?: RegExp) => {
        if (!value) return undefined;
        if (pattern) return value.replace(pattern, '');
        return value.replace(/^[A-Za-z]+\//, '');
    };

    const mapAdjudication = (entry: any) => ({
        category: mapCodeable(entry.category),
        reason: mapCodeable(entry.reason),
        amount: mapMoney(entry.amount),
        quantity: mapQuantity(entry.quantity)
    });

    const mapReviewOutcome = (entry: any) => entry ? {
        decision: mapCodeable(entry.decision),
        reason: entry.reason?.map(mapCodeable),
        preAuthRef: entry.preAuthRef,
        preAuthPeriod: mapPeriod(entry.preAuthPeriod)
    } : undefined;

    const mapItem = (item: any) => ({
        itemSequence: item.itemSequence,
        traceNumber: item.traceNumber?.map(mapIdentifier).filter(Boolean),
        noteNumber: item.noteNumber,
        reviewOutcome: mapReviewOutcome(item.reviewOutcome),
        adjudication: item.adjudication?.map(mapAdjudication),
        detail: item.detail?.map(mapDetail)
    });

    const mapDetail = (detail: any) => ({
        detailSequence: detail.detailSequence,
        traceNumber: detail.traceNumber?.map(mapIdentifier).filter(Boolean),
        noteNumber: detail.noteNumber,
        reviewOutcome: mapReviewOutcome(detail.reviewOutcome),
        adjudication: detail.adjudication?.map(mapAdjudication),
        subDetail: detail.subDetail?.map(mapSubDetail)
    });

    const mapSubDetail = (sub: any) => ({
        subDetailSequence: sub.subDetailSequence,
        traceNumber: sub.traceNumber?.map(mapIdentifier).filter(Boolean),
        noteNumber: sub.noteNumber,
        reviewOutcome: mapReviewOutcome(sub.reviewOutcome),
        adjudication: sub.adjudication?.map(mapAdjudication)
    });

    const mapAddItemDetail = (detail: any) => ({
        traceNumber: detail.traceNumber?.map(mapIdentifier).filter(Boolean),
        revenue: mapCodeable(detail.revenue),
        productOrService: mapCodeable(detail.productOrService),
        productOrServiceEnd: mapCodeable(detail.productOrServiceEnd),
        modifier: detail.modifier?.map(mapCodeable),
        quantity: mapQuantity(detail.quantity),
        unitPrice: mapMoney(detail.unitPrice),
        factor: detail.factor,
        tax: mapMoney(detail.tax),
        net: mapMoney(detail.net),
        noteNumber: detail.noteNumber,
        reviewOutcome: mapReviewOutcome(detail.reviewOutcome),
        adjudication: detail.adjudication?.map(mapAdjudication),
        subDetail: detail.subDetail?.map(mapAddItemSubDetail)
    });

    const mapAddItemSubDetail = (sub: any) => ({
        traceNumber: sub.traceNumber?.map(mapIdentifier).filter(Boolean),
        revenue: mapCodeable(sub.revenue),
        productOrService: mapCodeable(sub.productOrService),
        productOrServiceEnd: mapCodeable(sub.productOrServiceEnd),
        modifier: sub.modifier?.map(mapCodeable),
        quantity: mapQuantity(sub.quantity),
        unitPrice: mapMoney(sub.unitPrice),
        factor: sub.factor,
        tax: mapMoney(sub.tax),
        net: mapMoney(sub.net),
        noteNumber: sub.noteNumber,
        reviewOutcome: mapReviewOutcome(sub.reviewOutcome),
        adjudication: sub.adjudication?.map(mapAdjudication)
    });

    return {
        id: response.id,
        identifier: response.identifier?.map(mapIdentifier).filter(Boolean),
        traceNumber: response.traceNumber?.map(mapIdentifier).filter(Boolean),
        status: response.status,
        type: mapCodeable(response.type),
        subType: mapCodeable(response.subType),
        use: response.use,
        patient: stripRef(response.patient?.reference, /^Patient\//),
        created: response.created,
        insurer: stripRef(response.insurer?.reference, /^Organization\//),
        requestor: stripRef(response.requestor?.reference, /^(Organization|Practitioner|PractitionerRole)\//),
        request: stripRef(response.request?.reference, /^Claim\//),
        outcome: response.outcome,
        decision: mapCodeable(response.decision),
        disposition: response.disposition,
        preAuthRef: response.preAuthRef,
        preAuthPeriod: mapPeriod(response.preAuthPeriod),
        event: response.event?.map((evt: any) => ({
            type: mapCodeable(evt.type),
            whenDateTime: evt.whenDateTime,
            whenPeriod: mapPeriod(evt.whenPeriod)
        })),
        payeeType: mapCodeable(response.payeeType),
        encounter: response.encounter?.map((ref: any) => stripRef(ref.reference, /^Encounter\//)).filter(Boolean),
        diagnosisRelatedGroup: mapCodeable(response.diagnosisRelatedGroup),
        item: response.item?.map(mapItem),
        addItem: response.addItem?.map((item: any) => ({
            itemSequence: item.itemSequence,
            detailSequence: item.detailSequence,
            subdetailSequence: item.subdetailSequence,
            traceNumber: item.traceNumber?.map(mapIdentifier).filter(Boolean),
            provider: item.provider?.map((ref: any) => stripRef(ref.reference, /^(Organization|Practitioner|PractitionerRole)\//)).filter(Boolean),
            revenue: mapCodeable(item.revenue),
            productOrService: mapCodeable(item.productOrService),
            productOrServiceEnd: mapCodeable(item.productOrServiceEnd),
            request: item.request?.map((ref: any) => stripRef(ref.reference)).filter(Boolean),
            modifier: item.modifier?.map(mapCodeable),
            programCode: item.programCode?.map(mapCodeable),
            servicedDate: item.servicedDate,
            servicedPeriod: mapPeriod(item.servicedPeriod),
            locationCodeableConcept: mapCodeable(item.locationCodeableConcept),
            locationAddress: mapAddress(item.locationAddress),
            locationReference: item.locationReference?.reference?.replace(/^Location\//, ''),
            quantity: mapQuantity(item.quantity),
            unitPrice: mapMoney(item.unitPrice),
            factor: item.factor,
            tax: mapMoney(item.tax),
            net: mapMoney(item.net),
            bodySite: item.bodySite?.map((site: any) => ({
                site: site.site?.map((entry: any) => mapCodeable(entry.concept)),
                subSite: site.subSite?.map(mapCodeable)
            })),
            noteNumber: item.noteNumber,
            reviewOutcome: mapReviewOutcome(item.reviewOutcome),
            adjudication: item.adjudication?.map(mapAdjudication),
            detail: item.detail?.map(mapAddItemDetail)
        })),
        adjudication: response.adjudication?.map(mapAdjudication),
        total: response.total?.map((total: any) => ({
            category: mapCodeable(total.category),
            amount: mapMoney(total.amount)
        })),
        payment: response.payment ? {
            type: mapCodeable(response.payment.type),
            adjustment: mapMoney(response.payment.adjustment),
            adjustmentReason: mapCodeable(response.payment.adjustmentReason),
            date: response.payment.date,
            amount: mapMoney(response.payment.amount),
            identifier: response.payment.identifier ? { system: response.payment.identifier.system, value: response.payment.identifier.value } : undefined
        } : undefined,
        fundsReserve: mapCodeable(response.fundsReserve),
        formCode: mapCodeable(response.formCode),
        form: response.form ? {
            contentType: response.form.contentType,
            url: response.form.url,
            title: response.form.title,
            data: response.form.data
        } : undefined,
        processNote: response.processNote?.map((note: any) => ({
            number: note.number,
            type: mapCodeable(note.type),
            text: note.text,
            language: mapCodeable(note.language)
        })),
        communicationRequest: response.communicationRequest?.map((ref: any) => stripRef(ref.reference, /^CommunicationRequest\//)).filter(Boolean),
        insurance: response.insurance?.map((ins: any) => ({
            sequence: ins.sequence,
            focal: ins.focal,
            coverage: stripRef(ins.coverage?.reference, /^Coverage\//),
            businessArrangement: ins.businessArrangement,
            claimResponse: stripRef(ins.claimResponse?.reference, /^ClaimResponse\//)
        })),
        error: response.error?.map((err: any) => ({
            itemSequence: err.itemSequence,
            detailSequence: err.detailSequence,
            subDetailSequence: err.subDetailSequence,
            code: mapCodeable(err.code),
            expression: err.expression
        }))
    };
}

function mapR4ExplanationOfBenefit(eob: any): CanonicalExplanationOfBenefit {
    const mapCodeable = (source: any) => {
        if (!source) return undefined;
        const coding = source.coding?.[0];
        return {
            system: coding?.system,
            code: coding?.code,
            display: coding?.display || source.text
        };
    };

    const mapIdentifier = (source: any) => {
        if (!source) return undefined;
        return {
            system: source.system,
            value: source.value,
            type: mapCodeable(source.type)
        };
    };

    const mapPeriod = (source: any) => source ? {
        start: source.start,
        end: source.end
    } : undefined;

    const mapMoney = (source: any) => source ? {
        value: source.value,
        currency: source.currency
    } : undefined;

    const mapQuantity = (source: any) => source ? {
        value: source.value,
        unit: source.unit,
        system: source.system,
        code: source.code
    } : undefined;

    const mapAddress = (source: any) => source ? {
        line: source.line,
        city: source.city,
        state: source.state,
        postalCode: source.postalCode,
        country: source.country
    } : undefined;

    const stripRef = (value?: string, pattern?: RegExp) => {
        if (!value) return undefined;
        if (pattern) return value.replace(pattern, '');
        return value.replace(/^[A-Za-z]+\//, '');
    };

    const mapAdjudication = (entry: any) => ({
        category: mapCodeable(entry.category),
        reason: mapCodeable(entry.reason),
        amount: mapMoney(entry.amount),
        quantity: mapQuantity(entry.quantity)
    });

    const mapReviewOutcome = (entry: any) => entry ? {
        decision: mapCodeable(entry.decision),
        reason: entry.reason?.map(mapCodeable),
        preAuthRef: entry.preAuthRef,
        preAuthPeriod: mapPeriod(entry.preAuthPeriod)
    } : undefined;

    const mapItemDetail = (detail: any) => ({
        sequence: detail.sequence,
        traceNumber: detail.traceNumber?.map(mapIdentifier).filter(Boolean),
        revenue: mapCodeable(detail.revenue),
        category: mapCodeable(detail.category),
        productOrService: mapCodeable(detail.productOrService),
        productOrServiceEnd: mapCodeable(detail.productOrServiceEnd),
        modifier: detail.modifier?.map(mapCodeable),
        programCode: detail.programCode?.map(mapCodeable),
        patientPaid: mapMoney(detail.patientPaid),
        quantity: mapQuantity(detail.quantity),
        unitPrice: mapMoney(detail.unitPrice),
        factor: detail.factor,
        tax: mapMoney(detail.tax),
        net: mapMoney(detail.net),
        udi: detail.udi?.map((ref: any) => stripRef(ref.reference, /^Device\//)).filter(Boolean),
        noteNumber: detail.noteNumber,
        reviewOutcome: mapReviewOutcome(detail.reviewOutcome),
        adjudication: detail.adjudication?.map(mapAdjudication),
        subDetail: detail.subDetail?.map(mapItemSubDetail)
    });

    const mapItemSubDetail = (sub: any) => ({
        sequence: sub.sequence,
        traceNumber: sub.traceNumber?.map(mapIdentifier).filter(Boolean),
        revenue: mapCodeable(sub.revenue),
        category: mapCodeable(sub.category),
        productOrService: mapCodeable(sub.productOrService),
        productOrServiceEnd: mapCodeable(sub.productOrServiceEnd),
        modifier: sub.modifier?.map(mapCodeable),
        programCode: sub.programCode?.map(mapCodeable),
        patientPaid: mapMoney(sub.patientPaid),
        quantity: mapQuantity(sub.quantity),
        unitPrice: mapMoney(sub.unitPrice),
        factor: sub.factor,
        tax: mapMoney(sub.tax),
        net: mapMoney(sub.net),
        udi: sub.udi?.map((ref: any) => stripRef(ref.reference, /^Device\//)).filter(Boolean),
        noteNumber: sub.noteNumber,
        reviewOutcome: mapReviewOutcome(sub.reviewOutcome),
        adjudication: sub.adjudication?.map(mapAdjudication)
    });

    const mapItem = (item: any) => ({
        sequence: item.sequence,
        careTeamSequence: item.careTeamSequence,
        diagnosisSequence: item.diagnosisSequence,
        procedureSequence: item.procedureSequence,
        informationSequence: item.informationSequence,
        traceNumber: item.traceNumber?.map(mapIdentifier).filter(Boolean),
        revenue: mapCodeable(item.revenue),
        category: mapCodeable(item.category),
        productOrService: mapCodeable(item.productOrService),
        productOrServiceEnd: mapCodeable(item.productOrServiceEnd),
        request: item.request?.map((ref: any) => stripRef(ref.reference)).filter(Boolean),
        modifier: item.modifier?.map(mapCodeable),
        programCode: item.programCode?.map(mapCodeable),
        servicedDate: item.servicedDate,
        servicedPeriod: mapPeriod(item.servicedPeriod),
        locationCodeableConcept: mapCodeable(item.locationCodeableConcept),
        locationAddress: mapAddress(item.locationAddress),
        locationReference: stripRef(item.locationReference?.reference, /^Location\//),
        patientPaid: mapMoney(item.patientPaid),
        quantity: mapQuantity(item.quantity),
        unitPrice: mapMoney(item.unitPrice),
        factor: item.factor,
        tax: mapMoney(item.tax),
        net: mapMoney(item.net),
        udi: item.udi?.map((ref: any) => stripRef(ref.reference, /^Device\//)).filter(Boolean),
        bodySite: item.bodySite?.map((site: any) => ({
            site: site.site?.map((entry: any) => mapCodeable(entry.concept)),
            subSite: site.subSite?.map(mapCodeable)
        })),
        encounter: item.encounter?.map((ref: any) => stripRef(ref.reference, /^Encounter\//)).filter(Boolean),
        noteNumber: item.noteNumber,
        reviewOutcome: mapReviewOutcome(item.reviewOutcome),
        adjudication: item.adjudication?.map(mapAdjudication),
        detail: item.detail?.map(mapItemDetail)
    });

    const mapAddItemDetail = (detail: any) => ({
        traceNumber: detail.traceNumber?.map(mapIdentifier).filter(Boolean),
        revenue: mapCodeable(detail.revenue),
        productOrService: mapCodeable(detail.productOrService),
        productOrServiceEnd: mapCodeable(detail.productOrServiceEnd),
        modifier: detail.modifier?.map(mapCodeable),
        patientPaid: mapMoney(detail.patientPaid),
        quantity: mapQuantity(detail.quantity),
        unitPrice: mapMoney(detail.unitPrice),
        factor: detail.factor,
        tax: mapMoney(detail.tax),
        net: mapMoney(detail.net),
        noteNumber: detail.noteNumber,
        reviewOutcome: mapReviewOutcome(detail.reviewOutcome),
        adjudication: detail.adjudication?.map(mapAdjudication),
        subDetail: detail.subDetail?.map(mapAddItemSubDetail)
    });

    const mapAddItemSubDetail = (sub: any) => ({
        traceNumber: sub.traceNumber?.map(mapIdentifier).filter(Boolean),
        revenue: mapCodeable(sub.revenue),
        productOrService: mapCodeable(sub.productOrService),
        productOrServiceEnd: mapCodeable(sub.productOrServiceEnd),
        modifier: sub.modifier?.map(mapCodeable),
        patientPaid: mapMoney(sub.patientPaid),
        quantity: mapQuantity(sub.quantity),
        unitPrice: mapMoney(sub.unitPrice),
        factor: sub.factor,
        tax: mapMoney(sub.tax),
        net: mapMoney(sub.net),
        noteNumber: sub.noteNumber,
        reviewOutcome: mapReviewOutcome(sub.reviewOutcome),
        adjudication: sub.adjudication?.map(mapAdjudication)
    });

    const mapAddItem = (item: any) => ({
        itemSequence: item.itemSequence,
        detailSequence: item.detailSequence,
        subdetailSequence: item.subdetailSequence,
        traceNumber: item.traceNumber?.map(mapIdentifier).filter(Boolean),
        provider: item.provider?.map((ref: any) => stripRef(ref.reference)).filter(Boolean),
        revenue: mapCodeable(item.revenue),
        productOrService: mapCodeable(item.productOrService),
        productOrServiceEnd: mapCodeable(item.productOrServiceEnd),
        request: item.request?.map((ref: any) => stripRef(ref.reference)).filter(Boolean),
        modifier: item.modifier?.map(mapCodeable),
        programCode: item.programCode?.map(mapCodeable),
        servicedDate: item.servicedDate,
        servicedPeriod: mapPeriod(item.servicedPeriod),
        locationCodeableConcept: mapCodeable(item.locationCodeableConcept),
        locationAddress: mapAddress(item.locationAddress),
        locationReference: stripRef(item.locationReference?.reference, /^Location\//),
        patientPaid: mapMoney(item.patientPaid),
        quantity: mapQuantity(item.quantity),
        unitPrice: mapMoney(item.unitPrice),
        factor: item.factor,
        tax: mapMoney(item.tax),
        net: mapMoney(item.net),
        bodySite: item.bodySite?.map((site: any) => ({
            site: site.site?.map((entry: any) => mapCodeable(entry.concept)),
            subSite: site.subSite?.map(mapCodeable)
        })),
        noteNumber: item.noteNumber,
        reviewOutcome: mapReviewOutcome(item.reviewOutcome),
        adjudication: item.adjudication?.map(mapAdjudication),
        detail: item.detail?.map(mapAddItemDetail)
    });

    return {
        id: eob.id,
        identifier: eob.identifier?.map(mapIdentifier).filter(Boolean),
        traceNumber: eob.traceNumber?.map(mapIdentifier).filter(Boolean),
        status: eob.status,
        type: mapCodeable(eob.type),
        subType: mapCodeable(eob.subType),
        use: eob.use,
        patient: stripRef(eob.patient?.reference, /^Patient\//),
        billablePeriod: mapPeriod(eob.billablePeriod),
        created: eob.created,
        enterer: stripRef(eob.enterer?.reference, /^(Patient|Practitioner|PractitionerRole|RelatedPerson)\//),
        insurer: stripRef(eob.insurer?.reference, /^Organization\//),
        provider: stripRef(eob.provider?.reference, /^(Organization|Practitioner|PractitionerRole)\//),
        priority: mapCodeable(eob.priority),
        fundsReserveRequested: mapCodeable(eob.fundsReserveRequested),
        fundsReserve: mapCodeable(eob.fundsReserve),
        related: eob.related?.map((rel: any) => ({
            claim: stripRef(rel.claim?.reference, /^Claim\//),
            relationship: mapCodeable(rel.relationship),
            reference: rel.reference ? { system: rel.reference.system, value: rel.reference.value } : undefined
        })),
        prescription: stripRef(eob.prescription?.reference, /^(MedicationRequest|VisionPrescription)\//),
        originalPrescription: stripRef(eob.originalPrescription?.reference, /^MedicationRequest\//),
        event: eob.event?.map((evt: any) => ({
            type: mapCodeable(evt.type),
            whenDateTime: evt.whenDateTime,
            whenPeriod: mapPeriod(evt.whenPeriod)
        })),
        payee: eob.payee ? {
            type: mapCodeable(eob.payee.type),
            party: stripRef(eob.payee.party?.reference, /^(Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//)
        } : undefined,
        referral: stripRef(eob.referral?.reference, /^ServiceRequest\//),
        encounter: eob.encounter?.map((ref: any) => stripRef(ref.reference, /^Encounter\//)).filter(Boolean),
        facility: stripRef(eob.facility?.reference, /^(Location|Organization)\//),
        claim: stripRef(eob.claim?.reference, /^Claim\//),
        claimResponse: stripRef(eob.claimResponse?.reference, /^ClaimResponse\//),
        outcome: eob.outcome,
        decision: mapCodeable(eob.decision),
        disposition: eob.disposition,
        preAuthRef: eob.preAuthRef,
        preAuthRefPeriod: eob.preAuthRefPeriod?.map(mapPeriod),
        diagnosisRelatedGroup: mapCodeable(eob.diagnosisRelatedGroup),
        careTeam: eob.careTeam?.map((team: any) => ({
            sequence: team.sequence,
            provider: stripRef(team.provider?.reference, /^(Organization|Practitioner|PractitionerRole)\//),
            responsible: team.responsible,
            role: mapCodeable(team.role),
            specialty: mapCodeable(team.specialty)
        })),
        supportingInfo: eob.supportingInfo?.map((info: any) => ({
            sequence: info.sequence,
            category: mapCodeable(info.category),
            code: mapCodeable(info.code),
            timingDate: info.timingDate,
            timingPeriod: mapPeriod(info.timingPeriod),
            valueBoolean: info.valueBoolean,
            valueString: info.valueString,
            valueQuantity: mapQuantity(info.valueQuantity),
            valueAttachment: info.valueAttachment ? {
                contentType: info.valueAttachment.contentType,
                url: info.valueAttachment.url,
                title: info.valueAttachment.title,
                data: info.valueAttachment.data
            } : undefined,
            valueReference: stripRef(info.valueReference?.reference),
            valueIdentifier: info.valueIdentifier ? { system: info.valueIdentifier.system, value: info.valueIdentifier.value } : undefined,
            reason: mapCodeable(info.reason)
        })),
        diagnosis: eob.diagnosis?.map((diag: any) => ({
            sequence: diag.sequence,
            diagnosisCodeableConcept: mapCodeable(diag.diagnosisCodeableConcept),
            diagnosisReference: stripRef(diag.diagnosisReference?.reference, /^Condition\//),
            type: diag.type?.map(mapCodeable),
            onAdmission: mapCodeable(diag.onAdmission)
        })),
        procedure: eob.procedure?.map((proc: any) => ({
            sequence: proc.sequence,
            type: proc.type?.map(mapCodeable),
            date: proc.date,
            procedureCodeableConcept: mapCodeable(proc.procedureCodeableConcept),
            procedureReference: stripRef(proc.procedureReference?.reference, /^Procedure\//),
            udi: proc.udi?.map((ref: any) => stripRef(ref.reference, /^Device\//)).filter(Boolean)
        })),
        precedence: eob.precedence,
        insurance: eob.insurance?.map((ins: any) => ({
            focal: ins.focal,
            coverage: stripRef(ins.coverage?.reference, /^Coverage\//),
            preAuthRef: ins.preAuthRef
        })),
        accident: eob.accident ? {
            date: eob.accident.date,
            type: mapCodeable(eob.accident.type),
            locationAddress: mapAddress(eob.accident.locationAddress),
            locationReference: stripRef(eob.accident.locationReference?.reference, /^Location\//)
        } : undefined,
        patientPaid: mapMoney(eob.patientPaid),
        item: eob.item?.map(mapItem),
        addItem: eob.addItem?.map(mapAddItem),
        adjudication: eob.adjudication?.map(mapAdjudication),
        total: eob.total?.map((total: any) => ({
            category: mapCodeable(total.category),
            amount: mapMoney(total.amount)
        })),
        payment: eob.payment ? {
            type: mapCodeable(eob.payment.type),
            adjustment: mapMoney(eob.payment.adjustment),
            adjustmentReason: mapCodeable(eob.payment.adjustmentReason),
            date: eob.payment.date,
            amount: mapMoney(eob.payment.amount),
            identifier: eob.payment.identifier ? { system: eob.payment.identifier.system, value: eob.payment.identifier.value } : undefined
        } : undefined,
        formCode: mapCodeable(eob.formCode),
        form: eob.form ? {
            contentType: eob.form.contentType,
            url: eob.form.url,
            title: eob.form.title,
            data: eob.form.data
        } : undefined,
        processNote: eob.processNote?.map((note: any) => ({
            number: note.number,
            type: mapCodeable(note.type),
            text: note.text,
            language: mapCodeable(note.language)
        })),
        benefitPeriod: mapPeriod(eob.benefitPeriod),
        benefitBalance: eob.benefitBalance?.map((balance: any) => ({
            category: mapCodeable(balance.category),
            excluded: balance.excluded,
            name: balance.name,
            description: balance.description,
            network: mapCodeable(balance.network),
            unit: mapCodeable(balance.unit),
            term: mapCodeable(balance.term),
            financial: balance.financial?.map((fin: any) => ({
                type: mapCodeable(fin.type),
                allowedUnsignedInt: fin.allowedUnsignedInt,
                allowedString: fin.allowedString,
                allowedMoney: mapMoney(fin.allowedMoney),
                usedUnsignedInt: fin.usedUnsignedInt,
                usedMoney: mapMoney(fin.usedMoney)
            }))
        }))
    };
}

function mapR4Composition(composition: any): CanonicalComposition {
    const mapCodeable = (source: any) => {
        if (!source) return undefined;
        const coding = source.coding?.[0];
        return {
            system: coding?.system,
            code: coding?.code,
            display: coding?.display || source.text
        };
    };

    const mapIdentifier = (source: any) => {
        if (!source) return undefined;
        return {
            system: source.system,
            value: source.value,
            type: mapCodeable(source.type)
        };
    };

    const mapPeriod = (source: any) => source ? {
        start: source.start,
        end: source.end
    } : undefined;

    const stripRef = (value?: string) => value ? value.replace(/^[A-Za-z]+\//, '') : undefined;

    const mapSection = (section: any) => ({
        title: section.title,
        code: mapCodeable(section.code),
        author: section.author?.map((ref: any) => stripRef(ref.reference)).filter(Boolean),
        focus: stripRef(section.focus?.reference),
        text: section.text?.div,
        orderedBy: mapCodeable(section.orderedBy),
        entry: section.entry?.map((ref: any) => stripRef(ref.reference)).filter(Boolean),
        emptyReason: mapCodeable(section.emptyReason),
        section: section.section?.map(mapSection)
    });

    return {
        id: composition.id,
        identifier: composition.identifier?.map(mapIdentifier).filter(Boolean),
        url: composition.url,
        version: composition.version,
        status: composition.status,
        type: mapCodeable(composition.type),
        category: composition.category?.map(mapCodeable),
        subject: composition.subject?.map((ref: any) => stripRef(ref.reference)).filter(Boolean),
        encounter: stripRef(composition.encounter?.reference),
        date: composition.date,
        useContext: composition.useContext?.map((ctx: any) => ({
            code: mapCodeable(ctx.code),
            valueCodeableConcept: mapCodeable(ctx.valueCodeableConcept),
            valueReference: stripRef(ctx.valueReference?.reference)
        })),
        author: composition.author?.map((ref: any) => stripRef(ref.reference)).filter(Boolean),
        name: composition.name,
        title: composition.title,
        note: composition.note?.map((note: any) => ({
            text: note.text,
            author: note.authorString,
            time: note.time
        })),
        attester: composition.attester?.map((att: any) => ({
            mode: mapCodeable(att.mode),
            time: att.time,
            party: stripRef(att.party?.reference)
        })),
        custodian: stripRef(composition.custodian?.reference),
        relatesTo: composition.relatesTo?.map((rel: any) => ({
            type: rel.type,
            resource: stripRef(rel.resourceReference?.reference),
            identifier: rel.resourceIdentifier
                ? { system: rel.resourceIdentifier.system, value: rel.resourceIdentifier.value }
                : undefined
        })),
        event: composition.event?.map((evt: any) => ({
            period: mapPeriod(evt.period),
            detail: evt.detail?.map((ref: any) => stripRef(ref.reference)).filter(Boolean)
        })),
        section: composition.section?.map(mapSection)
    };
}

function mapR4Coverage(coverage: any): CanonicalCoverage {
    const mapCodeable = (source: any) => {
        if (!source) return undefined;
        const coding = source.coding?.[0];
        return {
            system: coding?.system,
            code: coding?.code,
            display: coding?.display || source.text
        };
    };

    const mapIdentifier = (source: any) => {
        if (!source) return undefined;
        return {
            system: source.system,
            value: source.value,
            type: mapCodeable(source.type)
        };
    };

    const mapPeriod = (source: any) => source ? {
        start: source.start,
        end: source.end
    } : undefined;

    const mapMoney = (source: any) => source ? {
        value: source.value,
        currency: source.currency
    } : undefined;

    const mapQuantity = (source: any) => source ? {
        value: source.value,
        unit: source.unit,
        system: source.system,
        code: source.code
    } : undefined;

    const stripRef = (value?: string, pattern?: RegExp) => {
        if (!value) return undefined;
        if (pattern) return value.replace(pattern, '');
        return value.replace(/^[A-Za-z]+\//, '');
    };

    return {
        id: coverage.id,
        identifier: coverage.identifier?.map(mapIdentifier).filter(Boolean),
        status: coverage.status,
        kind: coverage.kind,
        paymentBy: coverage.paymentBy?.map((pay: any) => ({
            party: stripRef(pay.party?.reference, /^(Organization|Patient|RelatedPerson)\//),
            responsibility: pay.responsibility
        })),
        type: mapCodeable(coverage.type),
        policyHolder: stripRef(coverage.policyHolder?.reference, /^(Organization|Patient|RelatedPerson)\//),
        subscriber: stripRef(coverage.subscriber?.reference, /^(Patient|RelatedPerson)\//),
        subscriberId: coverage.subscriberId?.map(mapIdentifier).filter(Boolean),
        beneficiary: stripRef(coverage.beneficiary?.reference, /^Patient\//),
        dependent: coverage.dependent,
        relationship: mapCodeable(coverage.relationship),
        period: mapPeriod(coverage.period),
        insurer: stripRef(coverage.insurer?.reference, /^Organization\//),
        class: coverage.class?.map((entry: any) => ({
            type: mapCodeable(entry.type),
            value: entry.value ? { system: entry.value.system, value: entry.value.value } : undefined,
            name: entry.name
        })),
        order: coverage.order,
        network: coverage.network,
        costToBeneficiary: coverage.costToBeneficiary?.map((cost: any) => ({
            type: mapCodeable(cost.type),
            category: mapCodeable(cost.category),
            network: mapCodeable(cost.network),
            unit: mapCodeable(cost.unit),
            term: mapCodeable(cost.term),
            valueQuantity: mapQuantity(cost.valueQuantity),
            valueMoney: mapMoney(cost.valueMoney),
            exception: cost.exception?.map((ex: any) => ({
                type: mapCodeable(ex.type),
                period: mapPeriod(ex.period)
            }))
        })),
        subrogation: coverage.subrogation,
        contract: coverage.contract?.map((ref: any) => stripRef(ref.reference, /^Contract\//)).filter(Boolean),
        insurancePlan: stripRef(coverage.insurancePlan?.reference, /^InsurancePlan\//)
    };
}

function mapR4Account(account: any): CanonicalAccount {
    const mapCodeable = (source: any) => {
        if (!source) return undefined;
        const coding = source.coding?.[0];
        return {
            system: coding?.system,
            code: coding?.code,
            display: coding?.display || source.text
        };
    };

    const mapIdentifier = (source: any) => {
        if (!source) return undefined;
        return {
            system: source.system,
            value: source.value,
            type: mapCodeable(source.type)
        };
    };

    const mapPeriod = (source: any) => source ? {
        start: source.start,
        end: source.end
    } : undefined;

    const mapMoney = (source: any) => source ? {
        value: source.value,
        currency: source.currency
    } : undefined;

    const stripRef = (value?: string, pattern?: RegExp) => {
        if (!value) return undefined;
        if (pattern) return value.replace(pattern, '');
        return value.replace(/^[A-Za-z]+\//, '');
    };

    const mapCodeableReference = (source: any, resourceType: string) => {
        if (!source) return undefined;
        const reference = source.reference ? stripRef(source.reference, new RegExp(`^${resourceType}\\/`)) : undefined;
        const concept = mapCodeable(source.concept);
        if (!reference && !concept) return undefined;
        return {
            reference,
            code: concept
        };
    };

    return {
        id: account.id,
        identifier: account.identifier?.map(mapIdentifier).filter(Boolean),
        status: account.status,
        billingStatus: mapCodeable(account.billingStatus),
        type: mapCodeable(account.type),
        name: account.name,
        subject: account.subject?.map((ref: any) => stripRef(ref.reference)).filter(Boolean),
        servicePeriod: mapPeriod(account.servicePeriod),
        coverage: account.coverage?.map((entry: any) => ({
            coverage: stripRef(entry.coverage?.reference, /^Coverage\//),
            priority: entry.priority
        })),
        owner: stripRef(account.owner?.reference, /^Organization\//),
        description: account.description,
        guarantor: account.guarantor?.map((entry: any) => ({
            party: stripRef(entry.party?.reference),
            onHold: entry.onHold,
            period: mapPeriod(entry.period)
        })),
        diagnosis: account.diagnosis?.map((entry: any) => ({
            sequence: entry.sequence,
            condition: mapCodeableReference(entry.condition, 'Condition'),
            dateOfDiagnosis: entry.dateOfDiagnosis,
            type: entry.type?.map(mapCodeable),
            onAdmission: entry.onAdmission,
            packageCode: entry.packageCode?.map(mapCodeable)
        })),
        procedure: account.procedure?.map((entry: any) => ({
            sequence: entry.sequence,
            code: mapCodeableReference(entry.code, 'Procedure'),
            dateOfService: entry.dateOfService,
            type: entry.type?.map(mapCodeable),
            packageCode: entry.packageCode?.map(mapCodeable),
            device: entry.device?.map((ref: any) => stripRef(ref.reference, /^Device\//)).filter(Boolean)
        })),
        relatedAccount: account.relatedAccount?.map((entry: any) => ({
            relationship: mapCodeable(entry.relationship),
            account: stripRef(entry.account?.reference, /^Account\//)
        })),
        currency: mapCodeable(account.currency),
        balance: account.balance?.map((entry: any) => ({
            aggregate: mapCodeable(entry.aggregate),
            term: mapCodeable(entry.term),
            estimate: entry.estimate,
            amount: mapMoney(entry.amount)
        })),
        calculatedAt: account.calculatedAt
    };
}

function mapR4CarePlan(plan: any): CanonicalCarePlan {
  return {
    id: plan.id,
    identifier: plan.identifier?.[0]?.value,
    instantiatesCanonical: plan.instantiatesCanonical,
    instantiatesUri: plan.instantiatesUri,
    basedOn: plan.basedOn?.map((ref: any) => ref.reference?.replace(/^CarePlan\//, '')).filter(Boolean),
    replaces: plan.replaces?.map((ref: any) => ref.reference?.replace(/^CarePlan\//, '')).filter(Boolean),
    partOf: plan.partOf?.map((ref: any) => ref.reference?.replace(/^CarePlan\//, '')).filter(Boolean),
    status: plan.status,
    intent: plan.intent,
    category: plan.category?.map((cat: any) => ({
      system: cat.coding?.[0]?.system,
      code: cat.coding?.[0]?.code,
      display: cat.coding?.[0]?.display || cat.text
    })),
    title: plan.title,
    description: plan.description,
    subject: plan.subject?.reference?.replace(/^(Patient|Group)\//, ''),
    encounter: plan.encounter?.reference?.replace(/^Encounter\//, ''),
    period: plan.period ? { start: plan.period.start, end: plan.period.end } : undefined,
    created: plan.created,
    custodian: plan.custodian?.reference?.replace(/^(CareTeam|Device|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
    contributor: plan.contributor?.map((ref: any) => ref.reference?.replace(/^(CareTeam|Device|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, '')).filter(Boolean),
    careTeam: plan.careTeam?.map((ref: any) => ref.reference?.replace(/^CareTeam\//, '')).filter(Boolean),
    addresses: plan.addresses?.map((addr: any) => ({
      reference: addr.reference?.replace(/^Condition\//, ''),
      code: addr.concept?.coding?.[0]
        ? {
          system: addr.concept.coding[0].system,
          code: addr.concept.coding[0].code,
          display: addr.concept.coding[0].display
        }
        : undefined
    })),
    supportingInfo: plan.supportingInfo?.map((ref: any) => ref.reference).filter(Boolean),
    goal: plan.goal?.map((ref: any) => ref.reference?.replace(/^Goal\//, '')).filter(Boolean),
    activity: plan.activity?.map((activity: any) => ({
      performedActivity: activity.performedActivity?.map((performed: any) => ({
        reference: performed.reference,
        code: performed.concept?.coding?.[0]
          ? {
            system: performed.concept.coding[0].system,
            code: performed.concept.coding[0].code,
            display: performed.concept.coding[0].display
          }
          : undefined
      })),
      progress: activity.progress?.map((note: any) => note.text).filter(Boolean),
      plannedActivityReference: activity.plannedActivityReference?.reference
    }))
  };
}

function mapR4CareTeam(team: any): CanonicalCareTeam {
  return {
    id: team.id,
    identifier: team.identifier?.[0]?.value,
    status: team.status,
    category: team.category?.map((cat: any) => ({
      system: cat.coding?.[0]?.system,
      code: cat.coding?.[0]?.code,
      display: cat.coding?.[0]?.display || cat.text
    })),
    name: team.name,
    subject: team.subject?.reference?.replace(/^(Patient|Group)\//, ''),
    period: team.period ? { start: team.period.start, end: team.period.end } : undefined,
    participant: team.participant?.map((participant: any) => ({
      role: participant.role?.coding?.[0]
        ? {
          system: participant.role.coding[0].system,
          code: participant.role.coding[0].code,
          display: participant.role.coding[0].display
        }
        : undefined,
      member: participant.member?.reference?.replace(/^(CareTeam|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
      onBehalfOf: participant.onBehalfOf?.reference?.replace(/^Organization\//, ''),
      coveragePeriod: participant.coveragePeriod
        ? { start: participant.coveragePeriod.start, end: participant.coveragePeriod.end }
        : undefined
    })),
    reason: team.reason?.map((reason: any) => ({
      reference: reason.reference?.replace(/^Condition\//, ''),
      code: reason.concept?.coding?.[0]
        ? {
          system: reason.concept.coding[0].system,
          code: reason.concept.coding[0].code,
          display: reason.concept.coding[0].display
        }
        : undefined
    })),
    managingOrganization: team.managingOrganization?.map((ref: any) => ref.reference?.replace(/^Organization\//, '')).filter(Boolean),
    telecom: team.telecom?.map((contact: any) => ({
      system: contact.system,
      value: contact.value,
      use: contact.use
    })),
    note: team.note?.map((note: any) => note.text).filter(Boolean)
  };
}

function mapR4Goal(goal: any): CanonicalGoal {
  return {
    id: goal.id,
    identifier: goal.identifier?.[0]?.value,
    lifecycleStatus: goal.lifecycleStatus,
    achievementStatus: goal.achievementStatus?.coding?.[0]
      ? {
        system: goal.achievementStatus.coding[0].system,
        code: goal.achievementStatus.coding[0].code,
        display: goal.achievementStatus.coding[0].display
      }
      : undefined,
    category: goal.category?.map((cat: any) => ({
      system: cat.coding?.[0]?.system,
      code: cat.coding?.[0]?.code,
      display: cat.coding?.[0]?.display || cat.text
    })),
    continuous: goal.continuous,
    priority: goal.priority?.coding?.[0]
      ? {
        system: goal.priority.coding[0].system,
        code: goal.priority.coding[0].code,
        display: goal.priority.coding[0].display
      }
      : undefined,
    description: goal.description?.coding?.[0] || goal.description?.text
      ? {
        system: goal.description?.coding?.[0]?.system,
        code: goal.description?.coding?.[0]?.code,
        display: goal.description?.coding?.[0]?.display,
        text: goal.description?.text
      }
      : undefined,
    subject: goal.subject?.reference?.replace(/^(Patient|Group|Organization)\//, ''),
    startDate: goal.startDate,
    startCodeableConcept: goal.startCodeableConcept?.coding?.[0]
      ? {
        system: goal.startCodeableConcept.coding[0].system,
        code: goal.startCodeableConcept.coding[0].code,
        display: goal.startCodeableConcept.coding[0].display
      }
      : undefined,
    target: goal.target?.map((target: any) => ({
      measure: target.measure?.coding?.[0]
        ? {
          system: target.measure.coding[0].system,
          code: target.measure.coding[0].code,
          display: target.measure.coding[0].display
        }
        : undefined,
      detailString: target.detailString,
      detailBoolean: target.detailBoolean,
      detailInteger: target.detailInteger,
      dueDate: target.dueDate
    })),
    statusDate: goal.statusDate,
    statusReason: goal.statusReason,
    source: goal.source?.reference?.replace(/^(CareTeam|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
    addresses: goal.addresses?.map((ref: any) => ref.reference).filter(Boolean),
    note: goal.note?.map((note: any) => note.text).filter(Boolean),
    outcome: goal.outcome?.map((ref: any) => ref.reference).filter(Boolean)
  };
}

function mapR4RiskAssessment(assessment: any): CanonicalRiskAssessment {
  const mapCodeable = (source: any) => {
    const coding = source?.coding?.[0];
    if (!coding && !source?.text) return undefined;
    return {
      system: coding?.system,
      code: coding?.code,
      display: coding?.display || source?.text
    };
  };

  const mapQuantity = (source: any) => {
    if (!source) return undefined;
    return {
      value: source.value,
      unit: source.unit,
      system: source.system,
      code: source.code
    };
  };

  const mapRange = (range: any) => {
    if (!range) return undefined;
    const low = mapQuantity(range.low);
    const high = mapQuantity(range.high);
    if (!low && !high) return undefined;
    return { low, high };
  };

  return {
    id: assessment.id,
    identifier: assessment.identifier?.map((id: any) => ({
      system: id.system,
      value: id.value,
      type: mapCodeable(id.type)
    })),
    basedOn: assessment.basedOn?.reference?.split('/').pop(),
    parent: assessment.parent?.reference?.split('/').pop(),
    status: assessment.status,
    method: mapCodeable(assessment.method),
    code: mapCodeable(assessment.code),
    subject: assessment.subject?.reference?.replace(/^(Patient|Group)\//, ''),
    encounter: assessment.encounter?.reference?.replace(/^Encounter\//, ''),
    occurrenceDateTime: assessment.occurrenceDateTime,
    occurrencePeriod: assessment.occurrencePeriod ? {
      start: assessment.occurrencePeriod.start,
      end: assessment.occurrencePeriod.end
    } : undefined,
    condition: assessment.condition?.reference?.replace(/^Condition\//, ''),
    performer: assessment.performer?.reference?.replace(/^(Device|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
    reason: assessment.reason?.map((reason: any) => reason.reference?.split('/').pop()).filter(Boolean),
    basis: assessment.basis?.map((ref: any) => ref.reference?.split('/').pop()).filter(Boolean),
    prediction: assessment.prediction?.map((prediction: any) => ({
      outcome: mapCodeable(prediction.outcome),
      probabilityDecimal: prediction.probabilityDecimal,
      probabilityRange: mapRange(prediction.probabilityRange),
      qualitativeRisk: mapCodeable(prediction.qualitativeRisk),
      relativeRisk: prediction.relativeRisk,
      whenPeriod: prediction.whenPeriod ? {
        start: prediction.whenPeriod.start,
        end: prediction.whenPeriod.end
      } : undefined,
      whenRange: mapRange(prediction.whenRange),
      rationale: prediction.rationale
    })),
    mitigation: assessment.mitigation,
    note: assessment.note?.map((note: any) => note.text).filter(Boolean)
  };
}

function mapR4ServiceRequest(request: any): CanonicalServiceRequest {
  const reasons = [
    ...(request.reason || []).map((reason: any) => reason.reference || reason.concept?.text).filter(Boolean),
    ...(request.reasonReference || []).map((ref: any) => ref.reference).filter(Boolean),
    ...(request.reasonCode || []).map((code: any) => code.text).filter(Boolean)
  ];

  return {
    id: request.id,
    identifier: request.identifier?.[0]?.value,
    instantiatesCanonical: request.instantiatesCanonical,
    instantiatesUri: request.instantiatesUri,
    basedOn: request.basedOn?.map((ref: any) => ref.reference?.replace(/^(CarePlan|MedicationRequest|ServiceRequest)\//, '')).filter(Boolean),
    replaces: request.replaces?.map((ref: any) => ref.reference?.replace(/^ServiceRequest\//, '')).filter(Boolean),
    requisition: request.requisition?.value,
    status: request.status,
    intent: request.intent,
    category: request.category?.map((cat: any) => ({
      system: cat.coding?.[0]?.system,
      code: cat.coding?.[0]?.code,
      display: cat.coding?.[0]?.display || cat.text
    })),
    priority: request.priority,
    doNotPerform: request.doNotPerform,
    code: request.code?.coding?.[0] || request.code?.text
      ? {
        system: request.code?.coding?.[0]?.system,
        code: request.code?.coding?.[0]?.code,
        display: request.code?.coding?.[0]?.display || request.code?.text
      }
      : undefined,
    subject: request.subject?.reference?.replace(/^(Patient|Group|Location|Device)\//, ''),
    encounter: request.encounter?.reference?.replace(/^Encounter\//, ''),
    occurrenceDateTime: request.occurrenceDateTime,
    occurrencePeriod: request.occurrencePeriod ? { start: request.occurrencePeriod.start, end: request.occurrencePeriod.end } : undefined,
    asNeededBoolean: request.asNeededBoolean,
    authoredOn: request.authoredOn,
    requester: request.requester?.reference?.replace(/^(Device|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
    performerType: request.performerType?.coding?.[0]
      ? {
        system: request.performerType.coding[0].system,
        code: request.performerType.coding[0].code,
        display: request.performerType.coding[0].display
      }
      : undefined,
    performer: request.performer?.map((ref: any) => ref.reference?.replace(/^(CareTeam|Device|HealthcareService|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, '')).filter(Boolean),
    location: request.location?.map((loc: any) => loc.reference?.replace(/^Location\//, '')).filter(Boolean),
    reason: reasons.length ? reasons : undefined,
    supportingInfo: request.supportingInfo?.map((info: any) => info.reference || info.concept?.text).filter(Boolean),
    specimen: request.specimen?.map((ref: any) => ref.reference?.replace(/^Specimen\//, '')).filter(Boolean),
    bodySite: request.bodySite?.map((site: any) => ({
      system: site.coding?.[0]?.system,
      code: site.coding?.[0]?.code,
      display: site.coding?.[0]?.display || site.text
    })),
    note: request.note?.map((note: any) => note.text).filter(Boolean),
    patientInstruction: request.patientInstruction?.map((instruction: any) => instruction.instructionMarkdown).filter(Boolean)
  };
}

function mapR4Task(task: any): CanonicalTask {
  const reasons = [
    ...(task.reason || []).map((reason: any) => reason.reference || reason.concept?.text).filter(Boolean),
    ...(task.reasonReference || []).map((ref: any) => ref.reference).filter(Boolean),
    ...(task.reasonCode || []).map((code: any) => code.text || code.coding?.[0]?.display).filter(Boolean)
  ];

  return {
    id: task.id,
    identifier: task.identifier?.[0]?.value,
    instantiatesCanonical: task.instantiatesCanonical,
    instantiatesUri: task.instantiatesUri,
    basedOn: task.basedOn?.map((ref: any) => ref.reference?.replace(/^(CarePlan|ServiceRequest|Task|Procedure|Observation|MedicationRequest|Appointment|Encounter)\//, '')).filter(Boolean),
    groupIdentifier: task.groupIdentifier?.value,
    partOf: task.partOf?.map((ref: any) => ref.reference?.replace(/^Task\//, '')).filter(Boolean),
    status: task.status,
    statusReason: task.statusReason?.concept?.text || task.statusReason?.concept?.coding?.[0]?.display || task.statusReason?.concept?.coding?.[0]?.code,
    businessStatus: task.businessStatus?.text || task.businessStatus?.coding?.[0]?.display || task.businessStatus?.coding?.[0]?.code,
    intent: task.intent,
    priority: task.priority,
    doNotPerform: task.doNotPerform,
    code: task.code?.coding?.[0] || task.code?.text
      ? {
        system: task.code?.coding?.[0]?.system,
        code: task.code?.coding?.[0]?.code,
        display: task.code?.coding?.[0]?.display || task.code?.text
      }
      : undefined,
    description: task.description,
    focus: task.focus?.reference,
    for: task.for?.reference,
    encounter: task.encounter?.reference?.replace(/^Encounter\//, ''),
    requestedPeriod: task.requestedPeriod ? { start: task.requestedPeriod.start, end: task.requestedPeriod.end } : undefined,
    executionPeriod: task.executionPeriod ? { start: task.executionPeriod.start, end: task.executionPeriod.end } : undefined,
    authoredOn: task.authoredOn,
    lastModified: task.lastModified,
    requester: task.requester?.reference?.replace(/^(Device|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
    requestedPerformer: task.requestedPerformer?.map((ref: any) => ref.reference?.replace(/^(CareTeam|Device|HealthcareService|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, '')).filter(Boolean),
    owner: task.owner?.reference?.replace(/^(CareTeam|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
    performer: task.performer?.map((performer: any) => ({
      actor: performer.actor?.reference?.replace(/^(CareTeam|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
      function: performer.function?.coding?.[0]
        ? {
          system: performer.function.coding[0].system,
          code: performer.function.coding[0].code,
          display: performer.function.coding[0].display
        }
        : undefined
    })),
    location: task.location?.reference?.replace(/^Location\//, ''),
    reason: reasons.length ? reasons : undefined,
    insurance: task.insurance?.map((ref: any) => ref.reference?.replace(/^(Coverage|ClaimResponse)\//, '')).filter(Boolean),
    note: task.note?.map((note: any) => note.text).filter(Boolean),
    relevantHistory: task.relevantHistory?.map((ref: any) => ref.reference?.replace(/^Provenance\//, '')).filter(Boolean)
  };
}

function mapR4Communication(comm: any): CanonicalCommunication {
  const reasons = [
    ...(comm.reason || []).map((reason: any) => reason.reference || reason.concept?.text).filter(Boolean),
    ...(comm.reasonReference || []).map((ref: any) => ref.reference).filter(Boolean),
    ...(comm.reasonCode || []).map((code: any) => code.text || code.coding?.[0]?.display).filter(Boolean)
  ];

  const payloads = (comm.payload || []).map((payload: any) => (
    payload.contentString ||
    payload.contentCodeableConcept?.text ||
    payload.contentCodeableConcept?.coding?.[0]?.display ||
    payload.contentReference?.reference
  )).filter(Boolean);

  return {
    id: comm.id,
    identifier: comm.identifier?.[0]?.value,
    instantiatesCanonical: comm.instantiatesCanonical,
    instantiatesUri: comm.instantiatesUri,
    basedOn: comm.basedOn?.map((ref: any) => ref.reference).filter(Boolean),
    partOf: comm.partOf?.map((ref: any) => ref.reference).filter(Boolean),
    inResponseTo: comm.inResponseTo?.map((ref: any) => ref.reference?.replace(/^Communication\//, '')).filter(Boolean),
    status: comm.status,
    statusReason: comm.statusReason?.coding?.[0]
      ? {
        system: comm.statusReason.coding[0].system,
        code: comm.statusReason.coding[0].code,
        display: comm.statusReason.coding[0].display
      }
      : undefined,
    category: comm.category?.map((cat: any) => ({
      system: cat.coding?.[0]?.system,
      code: cat.coding?.[0]?.code,
      display: cat.coding?.[0]?.display || cat.text
    })),
    priority: comm.priority,
    medium: comm.medium?.map((med: any) => ({
      system: med.coding?.[0]?.system,
      code: med.coding?.[0]?.code,
      display: med.coding?.[0]?.display || med.text
    })),
    subject: comm.subject?.reference?.replace(/^(Patient|Group)\//, ''),
    topic: comm.topic?.coding?.[0] || comm.topic?.text
      ? {
        system: comm.topic?.coding?.[0]?.system,
        code: comm.topic?.coding?.[0]?.code,
        display: comm.topic?.coding?.[0]?.display || comm.topic?.text
      }
      : undefined,
    about: comm.about?.map((ref: any) => ref.reference).filter(Boolean),
    encounter: comm.encounter?.reference?.replace(/^Encounter\//, ''),
    sent: comm.sent,
    received: comm.received,
    recipient: comm.recipient?.map((ref: any) => ref.reference?.replace(/^(CareTeam|Device|Endpoint|Group|HealthcareService|Location|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, '')).filter(Boolean),
    sender: comm.sender?.reference?.replace(/^(CareTeam|Device|Endpoint|HealthcareService|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
    reason: reasons.length ? reasons : undefined,
    payload: payloads.length ? payloads : undefined,
    note: comm.note?.map((note: any) => note.text).filter(Boolean)
  };
}

function mapR4CommunicationRequest(request: any): CanonicalCommunicationRequest {
  const reasons = [
    ...(request.reason || []).map((reason: any) => reason.reference || reason.concept?.text).filter(Boolean),
    ...(request.reasonReference || []).map((ref: any) => ref.reference).filter(Boolean),
    ...(request.reasonCode || []).map((code: any) => code.text || code.coding?.[0]?.display).filter(Boolean)
  ];

  const payloads = (request.payload || []).map((payload: any) => (
    payload.contentString ||
    payload.contentCodeableConcept?.text ||
    payload.contentCodeableConcept?.coding?.[0]?.display ||
    payload.contentReference?.reference
  )).filter(Boolean);

  return {
    id: request.id,
    identifier: request.identifier?.[0]?.value,
    basedOn: request.basedOn?.map((ref: any) => ref.reference).filter(Boolean),
    replaces: request.replaces?.map((ref: any) => ref.reference?.replace(/^CommunicationRequest\//, '')).filter(Boolean),
    groupIdentifier: request.groupIdentifier?.value,
    status: request.status,
    statusReason: request.statusReason?.coding?.[0]
      ? {
        system: request.statusReason.coding[0].system,
        code: request.statusReason.coding[0].code,
        display: request.statusReason.coding[0].display
      }
      : undefined,
    intent: request.intent,
    category: request.category?.map((cat: any) => ({
      system: cat.coding?.[0]?.system,
      code: cat.coding?.[0]?.code,
      display: cat.coding?.[0]?.display || cat.text
    })),
    priority: request.priority,
    doNotPerform: request.doNotPerform,
    medium: request.medium?.map((med: any) => ({
      system: med.coding?.[0]?.system,
      code: med.coding?.[0]?.code,
      display: med.coding?.[0]?.display || med.text
    })),
    subject: request.subject?.reference?.replace(/^(Patient|Group)\//, ''),
    about: request.about?.map((ref: any) => ref.reference).filter(Boolean),
    encounter: request.encounter?.reference?.replace(/^Encounter\//, ''),
    payload: payloads.length ? payloads : undefined,
    occurrenceDateTime: request.occurrenceDateTime,
    occurrencePeriod: request.occurrencePeriod ? { start: request.occurrencePeriod.start, end: request.occurrencePeriod.end } : undefined,
    authoredOn: request.authoredOn,
    requester: request.requester?.reference?.replace(/^(Device|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, ''),
    recipient: request.recipient?.map((ref: any) => ref.reference?.replace(/^(CareTeam|Device|Endpoint|Group|HealthcareService|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, '')).filter(Boolean),
    informationProvider: request.informationProvider?.map((ref: any) => ref.reference?.replace(/^(Device|Endpoint|HealthcareService|Organization|Patient|Practitioner|PractitionerRole|RelatedPerson)\//, '')).filter(Boolean),
    reason: reasons.length ? reasons : undefined,
    note: request.note?.map((note: any) => note.text).filter(Boolean)
  };
}

function mapR4Questionnaire(qnr: any): CanonicalQuestionnaire {
  return {
    id: qnr.id,
    url: qnr.url,
    identifier: qnr.identifier?.[0]?.value,
    version: qnr.version,
    name: qnr.name,
    title: qnr.title,
    status: qnr.status,
    date: qnr.date,
    publisher: qnr.publisher,
    description: qnr.description,
    subjectType: qnr.subjectType,
    item: qnr.item?.map((item: any) => ({
      linkId: item.linkId,
      text: item.text,
      type: item.type
    }))
  };
}

function mapR4QuestionnaireResponse(resp: any): CanonicalQuestionnaireResponse {
  const items = (resp.item || []).map((item: any) => ({
    linkId: item.linkId,
    text: item.text,
    answer: (item.answer || []).map((ans: any) => (
      ans.valueString ?? ans.valueBoolean ?? ans.valueInteger ?? ans.valueDecimal ?? ans.valueDate ?? ans.valueDateTime ?? ans.valueTime
    )).filter((value: any) => value !== undefined).map((value: any) => String(value))
  }));

  return {
    id: resp.id,
    identifier: resp.identifier?.[0]?.value,
    basedOn: resp.basedOn?.map((ref: any) => ref.reference?.replace(/^(CarePlan|ServiceRequest)\//, '')).filter(Boolean),
    partOf: resp.partOf?.map((ref: any) => ref.reference?.replace(/^(Observation|Procedure)\//, '')).filter(Boolean),
    questionnaire: resp.questionnaire,
    status: resp.status,
    subject: resp.subject?.reference,
    encounter: resp.encounter?.reference?.replace(/^Encounter\//, ''),
    authored: resp.authored,
    author: resp.author?.reference,
    source: resp.source?.reference,
    item: items.length ? items : undefined
  };
}

function mapR4CodeSystem(resource: any): CanonicalCodeSystem {
  if (!resource || resource.resourceType !== 'CodeSystem') return null as any;
  const concepts = Array.isArray(resource.concept) ? resource.concept : [];
  return {
    id: resource.id,
    url: resource.url,
    identifier: resource.identifier?.[0]?.value,
    version: resource.version,
    name: resource.name,
    title: resource.title,
    status: resource.status,
    date: resource.date,
    publisher: resource.publisher,
    description: resource.description,
    content: resource.content,
    caseSensitive: resource.caseSensitive,
    concept: concepts.map((concept: any) => ({
      code: concept.code,
      display: concept.display,
      definition: concept.definition
    }))
  };
}

function mapR4ValueSet(resource: any): CanonicalValueSet {
  if (!resource || resource.resourceType !== 'ValueSet') return null as any;
  const includes = Array.isArray(resource.compose?.include) ? resource.compose.include : [];
  const contains = Array.isArray(resource.expansion?.contains) ? resource.expansion.contains : [];

  return {
    id: resource.id,
    url: resource.url,
    identifier: resource.identifier?.[0]?.value,
    version: resource.version,
    name: resource.name,
    title: resource.title,
    status: resource.status,
    date: resource.date,
    publisher: resource.publisher,
    description: resource.description,
    compose: includes.length ? {
      include: includes.map((include: any) => ({
        system: include.system,
        concept: Array.isArray(include.concept)
          ? include.concept.map((concept: any) => ({
            code: concept.code,
            display: concept.display
          }))
          : undefined
      }))
    } : undefined,
    expansion: contains.length ? {
      contains: contains.map((item: any) => ({
        system: item.system,
        code: item.code,
        display: item.display
      }))
    } : undefined
  };
}

function mapR4ConceptMap(resource: any): CanonicalConceptMap {
  if (!resource || resource.resourceType !== 'ConceptMap') return null as any;
  const groups = Array.isArray(resource.group) ? resource.group : [];

  return {
    id: resource.id,
    url: resource.url,
    identifier: resource.identifier?.[0]?.value,
    version: resource.version,
    name: resource.name,
    title: resource.title,
    status: resource.status,
    date: resource.date,
    publisher: resource.publisher,
    description: resource.description,
    sourceScope: resource.sourceScopeUri || resource.sourceScopeCanonical || resource.sourceUri || resource.sourceCanonical,
    targetScope: resource.targetScopeUri || resource.targetScopeCanonical || resource.targetUri || resource.targetCanonical,
    group: groups.map((group: any) => ({
      source: group.source,
      target: group.target,
      element: Array.isArray(group.element) ? group.element.map((element: any) => ({
        code: element.code,
        display: element.display,
        target: Array.isArray(element.target) ? element.target.map((target: any) => ({
          code: target.code,
          display: target.display,
          relationship: target.relationship
        })) : undefined
      })) : undefined
    }))
  };
}

function mapR4NamingSystem(resource: any): CanonicalNamingSystem {
  if (!resource || resource.resourceType !== 'NamingSystem') return null as any;
  const uniqueIds = Array.isArray(resource.uniqueId) ? resource.uniqueId : [];

  return {
    id: resource.id,
    url: resource.url,
    identifier: resource.identifier?.[0]?.value,
    version: resource.version,
    name: resource.name,
    title: resource.title,
    status: resource.status,
    kind: resource.kind,
    date: resource.date,
    publisher: resource.publisher,
    responsible: resource.responsible,
    description: resource.description,
    usage: resource.usage,
    uniqueId: uniqueIds.map((uniqueId: any) => ({
      type: uniqueId.type,
      value: uniqueId.value,
      preferred: uniqueId.preferred
    }))
  };
}

function mapR4TerminologyCapabilities(resource: any): CanonicalTerminologyCapabilities {
  if (!resource || resource.resourceType !== 'TerminologyCapabilities') return null as any;
  return {
    id: resource.id,
    url: resource.url,
    identifier: resource.identifier?.[0]?.value,
    version: resource.version,
    name: resource.name,
    title: resource.title,
    status: resource.status,
    date: resource.date,
    publisher: resource.publisher,
    description: resource.description,
    kind: resource.kind,
    codeSearch: resource.codeSearch
  };
}

function mapR4Provenance(resource: any): CanonicalProvenance {
  if (!resource || resource.resourceType !== 'Provenance') return null as any;
  const agents = Array.isArray(resource.agent) ? resource.agent : [];
  return {
    id: resource.id,
    target: resource.target?.map((target: any) => target.reference).filter(Boolean),
    recorded: resource.recorded,
    activity: resource.activity?.text,
    agent: agents.map((agent: any) => ({
      who: agent.who?.reference,
      role: agent.role?.[0]?.text
    }))
  };
}

function mapR4AuditEvent(resource: any): CanonicalAuditEvent {
  if (!resource || resource.resourceType !== 'AuditEvent') return null as any;
  const agents = Array.isArray(resource.agent) ? resource.agent : [];
  return {
    id: resource.id,
    category: resource.category?.[0]?.text,
    code: resource.code?.text,
    action: resource.action,
    severity: resource.severity,
    recorded: resource.recorded,
    agent: agents.map((agent: any) => ({
      who: agent.who?.reference,
      role: agent.role?.[0]?.text,
      requestor: agent.requestor
    }))
  };
}

function mapR4Consent(resource: any): CanonicalConsent {
  if (!resource || resource.resourceType !== 'Consent') return null as any;
  return {
    id: resource.id,
    status: resource.status,
    category: resource.category?.[0]?.text,
    subject: resource.subject?.reference,
    date: resource.date,
    decision: resource.decision,
    grantor: resource.grantor?.map((ref: any) => ref.reference).filter(Boolean),
    grantee: resource.grantee?.map((ref: any) => ref.reference).filter(Boolean)
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

function mapR4Binary(binary: any): CanonicalBinary {
    return {
        id: binary.id,
        contentType: binary.contentType,
        securityContext: binary.securityContext?.reference?.replace(/^[A-Za-z]+\//, ''),
        data: binary.data
    };
}
