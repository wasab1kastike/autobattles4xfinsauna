import saunaBeerIcon from '../../assets/ui/sauna-beer.svg';
import saunaRosterIcon from '../../assets/ui/saunoja-roster.svg';
import resourceIcon from '../../assets/ui/resource.svg';
import soundIcon from '../../assets/ui/sound.svg';
import barracksSprite from '../../assets/sprites/barracks.svg?url';
import citySprite from '../../assets/sprites/city.svg?url';
import farmSprite from '../../assets/sprites/farm.svg?url';
import mineSprite from '../../assets/sprites/mine.svg?url';
import enemyOrc1Sprite from '../../assets/units/enemy-orc-1.png?url';
import enemyOrc2Sprite from '../../assets/units/enemy-orc-2.png?url';
import saunoja01Sprite from '../../assets/units/saunoja-01.png?url';
import saunoja02Sprite from '../../assets/units/saunoja-02.png?url';
import saunoja03Sprite from '../../assets/units/saunoja-03.png?url';
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
    'building-farm': farmSprite,
    'building-barracks': barracksSprite,
    'building-city': citySprite,
    'building-mine': mineSprite,
    'unit-soldier': saunoja02Sprite,
    'unit-archer': saunoja03Sprite,
    'unit-avanto-marauder': enemyOrc1Sprite,
    'unit-marauder': enemyOrc1Sprite,
    'unit-raider': enemyOrc1Sprite,
    'unit-raider-captain': enemyOrc2Sprite,
    'unit-raider-shaman': enemyOrc2Sprite,
    'unit-enemy-orc-1': enemyOrc1Sprite,
    'unit-enemy-orc-2': enemyOrc2Sprite,
    'unit-saunoja': saunoja01Sprite,
    'unit-saunoja-guardian': saunoja02Sprite,
    'unit-saunoja-seer': saunoja03Sprite,
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
