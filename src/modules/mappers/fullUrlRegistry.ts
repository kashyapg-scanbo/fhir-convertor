export interface FullUrlRegistration {
  identifier?: string;
  id?: string;
  additionalKeys?: (string | undefined)[];
}

export class FullUrlRegistry {
  private readonly map = new Map<string, string>();

  register(resourceType: string, registration: FullUrlRegistration, fullUrl: string) {
    const registerKey = (key: string | undefined, prefix: string) => {
      if (key) this.map.set(`${prefix}:${key}`, fullUrl);
    };

    registerKey(registration.identifier, resourceType);
    registerKey(registration.id, `${resourceType}.id`);

    if (registration.additionalKeys) {
      for (const key of registration.additionalKeys) {
        registerKey(key, resourceType);
      }
    }
  }

  resolve(resourceType: string, idOrIdentifier?: string) {
    if (!idOrIdentifier) return undefined;
    return (
      this.map.get(`${resourceType}:${idOrIdentifier}`) ||
      this.map.get(`${resourceType}.id:${idOrIdentifier}`)
    );
  }
}
