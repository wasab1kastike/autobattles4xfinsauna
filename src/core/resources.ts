export enum Resource {
  SAUNA_BEER = 'sauna-beer',
  SAUNAKUNNIA = 'saunakunnia',
  SISU = 'sisu'
}

export const PASSIVE_GENERATION: Record<Resource, number> = {
  [Resource.SAUNA_BEER]: 1,
  [Resource.SAUNAKUNNIA]: 0,
  [Resource.SISU]: 0
};

export type ResourceMap<T = number> = Record<Resource, T>;
