import farm from '../../assets/sprites/farm.svg';
import barracks from '../../assets/sprites/barracks.svg';
import city from '../../assets/sprites/city.svg';
import mine from '../../assets/sprites/mine.svg';
import saunaBeerIcon from '../../assets/ui/sauna-beer.svg';
import saunaRosterIcon from '../../assets/ui/saunoja-roster.svg';
import rosterToggleIcon from '../../assets/ui/hud-roster-toggle.svg';
import resourceIcon from '../../assets/ui/resource.svg';
import soundIcon from '../../assets/ui/sound.svg';
import { ARTOCOIN_CREST_PNG_DATA_URL } from '../media/artocoinCrest.ts';
import type { AssetPaths, LoadedAssets } from '../loader.ts';

const SAUNOJA_VANGUARD = new URL('../../assets/units/saunoja-01.png', import.meta.url).href;
const SAUNOJA_GUARDIAN = new URL('../../assets/units/saunoja-02.png', import.meta.url).href;
const SAUNOJA_SEER = new URL('../../assets/units/saunoja-03.png', import.meta.url).href;
const ENEMY_ORC_VANGUARD = new URL('../../assets/units/enemy-orc-1.png', import.meta.url).href;
const ENEMY_ORC_WARLOCK = new URL('../../assets/units/enemy-orc-2.png', import.meta.url).href;

export const uiIcons = {
  saunaBeer: saunaBeerIcon,
  saunojaRoster: saunaRosterIcon,
  rosterToggle: rosterToggleIcon,
  resource: resourceIcon,
  sisu: resourceIcon,
  sound: soundIcon,
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
    'unit-soldier': SAUNOJA_GUARDIAN,
    'unit-archer': SAUNOJA_SEER,
    'unit-avanto-marauder': ENEMY_ORC_VANGUARD,
    'unit-marauder': ENEMY_ORC_VANGUARD,
    'unit-raider': ENEMY_ORC_VANGUARD,
    'unit-raider-captain': ENEMY_ORC_WARLOCK,
    'unit-raider-shaman': ENEMY_ORC_WARLOCK,
    'unit-enemy-orc-1': ENEMY_ORC_VANGUARD,
    'unit-enemy-orc-2': ENEMY_ORC_WARLOCK,
    'unit-saunoja': SAUNOJA_VANGUARD,
    'unit-saunoja-guardian': SAUNOJA_GUARDIAN,
    'unit-saunoja-seer': SAUNOJA_SEER,
    'icon-sauna-beer': uiIcons.saunaBeer,
    'icon-saunoja-roster': uiIcons.saunojaRoster,
    'icon-roster-toggle': uiIcons.rosterToggle,
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
