import farm from '../../assets/sprites/farm.svg';
import barracks from '../../assets/sprites/barracks.svg';
import city from '../../assets/sprites/city.svg';
import mine from '../../assets/sprites/mine.svg';
import saunojaVanguard from '../../assets/units/saunoja-01.png';
import saunojaGuardian from '../../assets/units/saunoja-02.png';
import saunojaSeer from '../../assets/units/saunoja-03.png';
import enemyOrcVanguard from '../../assets/units/enemy-orc-1.png';
import enemyOrcWarlock from '../../assets/units/enemy-orc-2.png';
import { ARTOCOIN_CREST_PNG_DATA_URL } from '../media/artocoinCrest.ts';
import type { AssetPaths, LoadedAssets } from '../loader.ts';

const PUBLIC_ASSET_BASE = import.meta.env.BASE_URL ?? '/';

export const uiIcons = {
  saunaBeer: `${PUBLIC_ASSET_BASE}assets/ui/sauna-beer.svg`,
  saunojaRoster: `${PUBLIC_ASSET_BASE}assets/ui/saunoja-roster.svg`,
  resource: `${PUBLIC_ASSET_BASE}assets/ui/resource.svg`,
  sisu: `${PUBLIC_ASSET_BASE}assets/ui/resource.svg`,
  sound: `${PUBLIC_ASSET_BASE}assets/ui/sound.svg`,
  artocoin: ARTOCOIN_CREST_PNG_DATA_URL
} as const;

export const assetPaths: AssetPaths = {
  images: {
    placeholder:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
    'building-farm': farm,
    'building-barracks': barracks,
    'building-city': city,
    'building-mine': mine,
    'unit-soldier': saunojaGuardian,
    'unit-archer': saunojaSeer,
    'unit-avanto-marauder': enemyOrcVanguard,
    'unit-marauder': enemyOrcVanguard,
    'unit-raider': enemyOrcVanguard,
    'unit-raider-captain': enemyOrcWarlock,
    'unit-raider-shaman': enemyOrcWarlock,
    'unit-saunoja': saunojaVanguard,
    'unit-saunoja-guardian': saunojaGuardian,
    'unit-saunoja-seer': saunojaSeer,
    'icon-sauna-beer': uiIcons.saunaBeer,
    'icon-saunoja-roster': uiIcons.saunojaRoster,
    'icon-resource': uiIcons.resource,
    'icon-sound': uiIcons.sound,
    'icon-artocoin': uiIcons.artocoin
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
