type LocaleJson = Record<string, unknown>;
type LocaleFlatMapping = Record<string, readonly string[]>;

function readPath(messages: LocaleJson, path: readonly string[], flatKey: string): string {
  let current: unknown = messages;

  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current) || !(segment in current)) {
      throw new Error(`Missing locale JSON path for ${flatKey}: ${path.join(".")}`);
    }
    current = (current as Record<string, unknown>)[segment];
  }

  if (typeof current !== "string") {
    throw new Error(`Locale JSON path for ${flatKey} must resolve to a string: ${path.join(".")}`);
  }

  return current;
}

export function flattenLocale<TMapping extends LocaleFlatMapping>(
  messages: LocaleJson,
  mapping: TMapping,
): { readonly [Key in keyof TMapping]: string } {
  const flattened = {} as { [Key in keyof TMapping]: string };

  for (const flatKey of Object.keys(mapping) as Array<keyof TMapping>) {
    flattened[flatKey] = readPath(messages, mapping[flatKey], String(flatKey));
  }

  return flattened;
}
