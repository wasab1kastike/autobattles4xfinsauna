import type { SaunojaModifier } from '../../units/saunoja.ts';

export interface ModPillProps extends SaunojaModifier {}

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
});

function formatTimer(value: number | typeof Infinity): string {
  if (value === Infinity) {
    return '∞';
  }
  if (!Number.isFinite(value) || value <= 0) {
    return '0s';
  }
  return `${numberFormatter.format(Math.ceil(value))}s`;
}

function buildTooltip(props: ModPillProps): string {
  const segments: string[] = [props.name];
  if (props.description) {
    segments.push(props.description);
  }
  if (props.source) {
    segments.push(`Source: ${props.source}`);
  }
  if (props.duration !== Infinity) {
    segments.push(`Duration: ${formatTimer(props.duration)}`);
  }
  segments.push(`Remaining: ${formatTimer(props.remaining)}`);
  if (props.stacks && props.stacks > 1) {
    segments.push(`Stacks: ${props.stacks}`);
  }
  return segments.join(' — ');
}

export function renderModPill(props: ModPillProps): HTMLLIElement {
  const root = document.createElement('li');
  root.classList.add('mod-pill');
  root.dataset.modifierId = props.id;
  root.title = buildTooltip(props);
  root.setAttribute('aria-label', root.title);
  root.setAttribute('role', 'listitem');
  root.dataset.duration = props.duration === Infinity ? 'infinite' : String(props.duration);
  root.dataset.remaining = props.remaining === Infinity ? 'infinite' : String(props.remaining);
  if (props.appliedAt !== undefined) {
    root.dataset.appliedAt = String(props.appliedAt);
  }
  if (props.stacks && props.stacks > 1) {
    root.dataset.stacks = String(props.stacks);
  }

  const name = document.createElement('span');
  name.classList.add('mod-pill__name');
  name.textContent = props.name;
  name.setAttribute('aria-hidden', 'true');
  root.appendChild(name);

  if (props.stacks && props.stacks > 1) {
    const stacks = document.createElement('span');
    stacks.classList.add('mod-pill__stacks');
    stacks.textContent = `×${props.stacks}`;
    stacks.setAttribute('aria-hidden', 'true');
    root.appendChild(stacks);
  }

  const timer = document.createElement('span');
  timer.classList.add('mod-pill__timer');
  timer.textContent = formatTimer(props.remaining);
  timer.setAttribute('aria-hidden', 'true');
  root.appendChild(timer);

  if (props.remaining !== Infinity && props.remaining <= 5) {
    root.dataset.urgent = 'true';
  }

  return root;
}
