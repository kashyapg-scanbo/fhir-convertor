import crypto from 'crypto';
import operationOutcomeTemplate from '../../shared/templates/operationOutcome.json' with { type: 'json' };
import type { CanonicalOperationOutcome, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface OperationOutcomeMapperArgs {
  operationOutcomes?: CanonicalOperationOutcome[];
  operation?: OperationType;
  registry: FullUrlRegistry;
}

export function mapOperationOutcomes({
  operationOutcomes,
  operation,
  registry
}: OperationOutcomeMapperArgs) {
  if (!operationOutcomes || operationOutcomes.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < operationOutcomes.length; index++) {
    const source = operationOutcomes[index];
    const operationOutcome = structuredClone(operationOutcomeTemplate) as any;

    operationOutcome.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${operationOutcome.id}`;

    registry.register(
      'OperationOutcome',
      {
        identifier: operationOutcome.id,
        id: operationOutcome.id
      },
      fullUrl
    );

    operationOutcome.issue = source.issue?.length
      ? source.issue.map(issue => ({
        severity: issue.severity,
        code: issue.code,
        details: issue.details ? mapCodeableConcept(issue.details) : undefined,
        diagnostics: issue.diagnostics,
        location: issue.location?.length ? issue.location : undefined,
        expression: issue.expression?.length ? issue.expression : undefined
      }))
      : [];

    const summary = operationOutcome.issue?.[0]?.diagnostics || operationOutcome.issue?.[0]?.code;
    if (summary) operationOutcome.text = makeNarrative('OperationOutcome', summary);

    if (operation === 'delete') {
      operationOutcome.issue = [{
        severity: 'information',
        code: 'informational',
        diagnostics: 'Marked for deletion'
      }];
    }

    const entry: any = {
      resource: operationOutcome,
      fullUrl
    };

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
