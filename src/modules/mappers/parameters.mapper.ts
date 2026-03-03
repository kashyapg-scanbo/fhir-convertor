import crypto from 'crypto';
import parametersTemplate from '../../shared/templates/parameters.json' with { type: 'json' };
import type { CanonicalParameters, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';

interface ParametersMapperArgs {
  parameters?: CanonicalParameters[];
  operation?: OperationType;
  registry: FullUrlRegistry;
}

export function mapParameters({
  parameters,
  operation,
  registry
}: ParametersMapperArgs) {
  if (!parameters || parameters.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < parameters.length; index++) {
    const source = parameters[index];
    const params = structuredClone(parametersTemplate) as any;

    params.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${params.id}`;

    registry.register(
      'Parameters',
      {
        identifier: params.id,
        id: params.id
      },
      fullUrl
    );

    params.parameter = source.parameter?.map(param => {
      const entry: any = { name: param.name };
      if (param.valueString !== undefined) entry.valueString = param.valueString;
      else if (param.valueCode !== undefined) entry.valueCode = param.valueCode;
      else if (param.valueBoolean !== undefined) entry.valueBoolean = param.valueBoolean;
      else if (param.valueDateTime !== undefined) entry.valueDateTime = param.valueDateTime;
      else if (param.valueDate !== undefined) entry.valueDate = param.valueDate;
      else if (param.valueInteger !== undefined) entry.valueInteger = param.valueInteger;
      else if (param.valueDecimal !== undefined) entry.valueDecimal = param.valueDecimal;
      else if (param.valueUri !== undefined) entry.valueUri = param.valueUri;
      else if (param.valueReference !== undefined) entry.valueReference = { reference: param.valueReference };
      return entry;
    }) || [];

    if (operation === 'delete') {
      params.parameter = [{
        name: 'delete',
        valueString: 'Marked for deletion'
      }];
    }

    entries.push({
      resource: params,
      fullUrl
    });
  }

  return entries;
}
