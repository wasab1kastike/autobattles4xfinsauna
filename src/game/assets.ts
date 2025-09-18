import farm from '../../assets/sprites/farm.svg';
import barracks from '../../assets/sprites/barracks.svg';
import city from '../../assets/sprites/city.svg';
import mine from '../../assets/sprites/mine.svg';
import soldier from '../../assets/sprites/soldier.svg';
import archer from '../../assets/sprites/archer.svg';
import avantoMarauder from '../../assets/sprites/avanto-marauder.svg';
import type { AssetPaths, LoadedAssets } from '../loader.ts';

const PUBLIC_ASSET_BASE = import.meta.env.BASE_URL ?? '/';

export const uiIcons = {
  saunaBeer: `${PUBLIC_ASSET_BASE}assets/ui/sauna-beer.svg`,
  saunojaRoster: `${PUBLIC_ASSET_BASE}assets/ui/saunoja-roster.svg`,
  resource: `${PUBLIC_ASSET_BASE}assets/ui/resource.svg`,
  sisu: `${PUBLIC_ASSET_BASE}assets/ui/resource.svg`,
  sound: `${PUBLIC_ASSET_BASE}assets/ui/sound.svg`
} as const;

export const assetPaths: AssetPaths = {
  images: {
    placeholder:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
    'building-farm': farm,
    'building-barracks': barracks,
    'building-city': city,
    'building-mine': mine,
    'unit-soldier': soldier,
    'unit-archer': archer,
    'unit-avanto-marauder': avantoMarauder,
    'icon-sauna-beer': uiIcons.saunaBeer,
    'icon-saunoja-roster': uiIcons.saunojaRoster,
    'icon-resource': uiIcons.resource,
    'icon-sound': uiIcons.sound
  }
};

let loadedAssets: LoadedAssets | null = null;

export function setAssets(assets: LoadedAssets): void {
  loadedAssets = assets;
}

export function getAssets(): LoadedAssets | null {
  return loadedAssets;
}

export function resetAssetsForTest(): void {
  loadedAssets = null;
}
