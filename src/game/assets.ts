import saunaBeerIcon from '../../assets/ui/sauna-beer.svg';
import saunaRosterIcon from '../../assets/ui/saunoja-roster.svg';
import resourceIcon from '../../assets/ui/resource.svg';
import soundIcon from '../../assets/ui/sound.svg';
import { ARTOCOIN_CREST_PNG_DATA_URL } from '../media/artocoinCrest.ts';
import type { AssetPaths, LoadedAssets } from '../loader.ts';

export const uiIcons = {
  saunaBeer: saunaBeerIcon,
  saunojaRoster: saunaRosterIcon,
  resource: resourceIcon,
  sisu: resourceIcon,
  sound: soundIcon,
  artocoin: ARTOCOIN_CREST_PNG_DATA_URL
} as const;

export const assetPaths: AssetPaths = {
  images: {
    placeholder:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
    'building-farm': '/assets/sprites/farm.svg',
    'building-barracks': '/assets/sprites/barracks.svg',
    'building-city': '/assets/sprites/city.svg',
    'building-mine': '/assets/sprites/mine.svg',
    'unit-soldier': '/assets/units/saunoja-02.png',
    'unit-archer': '/assets/units/saunoja-03.png',
    'unit-avanto-marauder': '/assets/units/enemy-orc-1.png',
    'unit-marauder': '/assets/units/enemy-orc-1.png',
    'unit-raider': '/assets/units/enemy-orc-1.png',
    'unit-raider-captain': '/assets/units/enemy-orc-2.png',
    'unit-raider-shaman': '/assets/units/enemy-orc-2.png',
    'unit-enemy-orc-1': '/assets/units/enemy-orc-1.png',
    'unit-enemy-orc-2': '/assets/units/enemy-orc-2.png',
    'unit-saunoja': '/assets/units/saunoja-01.png',
    'unit-saunoja-guardian': '/assets/units/saunoja-02.png',
    'unit-saunoja-seer': '/assets/units/saunoja-03.png',
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
