import { eventScheduler, type ScheduledEventSpec } from './scheduler.ts';
import type { EventScheduler } from './scheduler.ts';

export const defaultEvents: ScheduledEventSpec[] = [
  {
    content: {
      id: 'command-briefing',
      headline: 'Command Briefing: Ember Shift',
      body:
        'Sauna Command uplinks a focused playbook for your opening salvo. Keep the roster nimble, channel the ember currents, and set the tone for this run.',
      art: '/assets/ui/saunoja-roster.svg',
      typography: 'serif',
      animation: 'aurora',
      accentColor: '#7bdff2',
      acknowledgeText: 'Deploy the roster'
    },
    trigger: { type: 'time', in: 2 }
  },
  {
    content: {
      id: 'recon-telemetry',
      headline: 'Recon Telemetry Uploaded',
      body:
        'Forward drones stitched together a glacial panorama of enemy routes. Prioritize rapid response teams while the snowpack is still undisturbed.',
      art: '/assets/ui/resource.svg',
      typography: 'sans',
      animation: 'pulse',
      accentColor: '#fbcfe8',
      acknowledgeText: 'Queue countermeasures'
    },
    trigger: { type: 'time', in: 12 }
  },
  {
    content: {
      id: 'supply-courier',
      headline: 'Sauna Courier Docked',
      body:
        'A lacquered supply skiff glides into the bay with artisan tonics and reinforced stave kits. Decide how to allocate the haul before the next assault.',
      art: '/assets/ui/sauna-beer.svg',
      typography: 'serif',
      animation: 'tilt',
      accentColor: '#fde68a',
      choices: [
        {
          id: 'frontline',
          label: 'Stage for the frontline',
          description: 'Prep the vanguard with the premium kit as morale surges.',
          accent: 'primary'
        },
        {
          id: 'reserve',
          label: 'Stock the reserves',
          description: 'Archive the crate for a later wave when pressure spikes.',
          accent: 'ghost'
        }
      ]
    },
    trigger: { type: 'time', in: 24 }
  }
];

export function seedDefaultEvents(scheduler: EventScheduler = eventScheduler): void {
  for (const spec of defaultEvents) {
    scheduler.schedule(spec);
  }
}

seedDefaultEvents();
