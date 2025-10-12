export type ResourceLoaderResult<T> = {
  value: T;
  warnings?: string[];
  errors?: string[];
};

export type ResourceLoaderDescriptor<T> = {
  label?: string;
  load: () => Promise<ResourceLoaderResult<T>>;
};

type LoaderValue<T> = T extends ResourceLoaderDescriptor<infer Value> ? Value : never;

type LoaderMap = Record<string, ResourceLoaderDescriptor<unknown>>;

export type LoadResourcesResult<TLoaders extends LoaderMap> = {
  resources: Partial<{ [K in keyof TLoaders]: LoaderValue<TLoaders[K]> }>;
  warnings: string[];
  errors: string[];
};

export async function loadResources<TLoaders extends LoaderMap>(
  loaders: TLoaders
): Promise<LoadResourcesResult<TLoaders>> {
  const entries = Object.entries(loaders) as Array<[
    keyof TLoaders,
    ResourceLoaderDescriptor<unknown>
  ]>;

  const settled = await Promise.allSettled(
    entries.map(([key, descriptor]) =>
      descriptor
        .load()
        .then((value) => ({ key, descriptor, value }))
    )
  );

  const resources: Partial<Record<keyof TLoaders, unknown>> = {};
  const warnings: string[] = [];
  const errors: string[] = [];

  settled.forEach((outcome, index) => {
    const [key, descriptor] = entries[index];
    const label = descriptor.label ?? String(key);

    if (outcome.status === 'fulfilled') {
      const { value } = outcome.value;
      resources[key] = value.value;

      if (value.warnings?.length) {
        for (const message of value.warnings) {
          warnings.push(label ? `${label}: ${message}` : message);
        }
      }

      if (value.errors?.length) {
        for (const message of value.errors) {
          errors.push(label ? `${label}: ${message}` : message);
        }
      }
      return;
    }

    const message = formatReason(outcome.reason);
    errors.push(label ? `${label}: ${message}` : message);
  });

  return {
    resources: resources as Partial<{ [K in keyof TLoaders]: LoaderValue<TLoaders[K]> }>,
    warnings,
    errors,
  };
}

function formatReason(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  if (typeof reason === 'string') {
    return reason;
  }
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}
