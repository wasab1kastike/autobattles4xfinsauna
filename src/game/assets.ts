import farm from '../../assets/sprites/farm.svg';
import barracks from '../../assets/sprites/barracks.svg';
import city from '../../assets/sprites/city.svg';
import mine from '../../assets/sprites/mine.svg';
import saunojaVanguard from '../../assets/units/saunoja-01.png';
import saunojaGuardian from '../../assets/units/saunoja-02.png';
import saunojaSeer from '../../assets/units/saunoja-03.png';
import enemyOrcVanguard from '../../assets/units/enemy-orc-1.png';
import enemyOrcWarlock from '../../assets/units/enemy-orc-2.png';
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

const saunojaSprites = {
  'unit-saunoja': saunojaVanguard,
  'unit-saunoja-guardian': saunojaGuardian,
  'unit-saunoja-seer': saunojaSeer
} as const;

const enemyOrcSprites = {
  'unit-enemy-orc-1': enemyOrcVanguard,
  'unit-enemy-orc-2': enemyOrcWarlock
} as const;

const unitSprites = {
  'unit-soldier': saunojaGuardian,
  'unit-archer': saunojaSeer,
  'unit-avanto-marauder': enemyOrcVanguard,
  'unit-marauder': enemyOrcVanguard,
  'unit-raider': enemyOrcVanguard,
  'unit-raider-captain': enemyOrcWarlock,
  'unit-raider-shaman': enemyOrcWarlock,
  ...saunojaSprites,
  ...enemyOrcSprites
} as const;

export const assetPaths: AssetPaths = {
  images: {
    placeholder:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
    'building-farm': farm,
    'building-barracks': barracks,
    'building-city': city,
    'building-mine': mine,
    ...unitSprites,
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
