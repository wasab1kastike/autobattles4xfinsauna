import {
  getMixerState,
  onMixerChange,
  setMasterMuted,
  setMasterVolume,
  setMusicMuted,
  setMusicVolume,
  setSfxMuted,
  setSfxVolume,
  type MixerChannel,
  type MixerState
} from '../../audio/mixer.ts';
import { playSafe } from '../../audio/sfx.ts';
import {
  getState as getAmbienceState,
  onStateChange as onAmbienceStateChange,
  setEnabled as setAmbienceEnabled,
  type AmbienceState
} from '../../audio/ambience.ts';

export interface AudioSettingsOverlayOptions {
  container: HTMLElement | null;
  onClose?: () => void;
}

export interface AudioSettingsOverlayHandle {
  destroy(): void;
  focus(): void;
}

const FOCUSABLE_SELECTORS =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const CHANNEL_LABELS: Record<MixerChannel, string> = {
  master: 'Master mix',
  music: 'Ambience soundscape',
  sfx: 'Effects & interface'
};

const CHANNEL_DESCRIPTIONS: Record<MixerChannel, string> = {
  master: 'Controls the overall loudness for every channel in the frontier.',
  music: 'Shapes the ambience loops and atmospheric swells around the sauna.',
  sfx: 'Balances unit callouts, UI clicks, and battle feedback cues.'
};

const SLIDER_GRADIENT =
  'linear-gradient(90deg, rgba(59,130,246,0.85) 0%, rgba(14,165,233,0.9) VAR%, rgba(148,163,184,0.35) VAR%, rgba(71,85,105,0.2) 100%)';

interface ChannelElements {
  card: HTMLElement;
  slider: HTMLInputElement;
  value: HTMLSpanElement;
  muteButton: HTMLButtonElement;
  status: HTMLSpanElement;
  ambienceToggle?: HTMLButtonElement;
}

function applySliderVisual(slider: HTMLInputElement, percent: number): void {
  slider.style.backgroundImage = SLIDER_GRADIENT.replace(/VAR/g, `${percent}%`);
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function createFocusTrap(
  overlay: HTMLElement,
  panel: HTMLElement,
  onDismiss: () => void
): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onDismiss();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (active === first || !panel.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !panel.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };

  overlay.addEventListener('keydown', handleKeyDown);
  return () => overlay.removeEventListener('keydown', handleKeyDown);
}

function describeChannelStatus(
  channel: MixerChannel,
  mixer: MixerState,
  ambience: AmbienceState
): string {
  const channelState = mixer.channels[channel];
  const masterState = mixer.channels.master;
  if (channel === 'music' && !ambience.enabled) {
    return 'Ambience paused';
  }
  if (channelState.muted) {
    return 'Muted at mixer';
  }
  if (channel !== 'master' && masterState.muted) {
    return 'Master mute active';
  }
  const effective = Math.round(channelState.effectiveVolume * 100);
  if (effective <= 0) {
    return 'Output silent';
  }
  if (channel === 'master') {
    return `Master output ${effective}%`;
  }
  if (channel === 'music') {
    return `Soundscape live ${effective}%`;
  }
  return `Effects live ${effective}%`;
}

function createChannelCard(
  doc: Document,
  channel: MixerChannel,
  state: MixerState,
  ambience: AmbienceState,
  onMuteToggle: (channel: MixerChannel, next: boolean) => void,
  onVolumeInput: (channel: MixerChannel, value: number) => void,
  onAmbienceToggle: (() => void) | null
): ChannelElements {
  const card = doc.createElement('section');
  card.className =
    'rounded-hud-xl border border-white/12 bg-[linear-gradient(155deg,rgba(15,26,56,0.92),rgba(9,14,34,0.96))] p-5 shadow-[0_24px_45px_rgba(4,10,25,0.55)] backdrop-blur-[18px] backdrop-saturate-[140%]';

  const header = doc.createElement('header');
  header.className = 'flex flex-wrap items-start justify-between gap-3';

  const titleGroup = doc.createElement('div');
  titleGroup.className = 'space-y-1';

  const title = doc.createElement('h3');
  title.className = 'text-lg font-semibold tracking-tight text-white';
  title.textContent = CHANNEL_LABELS[channel];

  const description = doc.createElement('p');
  description.className = 'max-w-[32ch] text-sm text-slate-300/85';
  description.textContent = CHANNEL_DESCRIPTIONS[channel];

  titleGroup.append(title, description);

  const status = doc.createElement('span');
  status.className =
    'inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-800/65 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-white/70';
  status.textContent = describeChannelStatus(channel, state, ambience);

  header.append(titleGroup, status);

  const sliderRow = doc.createElement('div');
  sliderRow.className = 'mt-5 flex items-center gap-4';

  const slider = doc.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.step = '1';
  slider.className =
    'h-2 flex-1 appearance-none rounded-full bg-slate-600/30 accent-accent transition-[background-image] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
  slider.setAttribute('aria-label', `${CHANNEL_LABELS[channel]} level`);

  const value = doc.createElement('span');
  value.className = 'text-sm font-semibold text-slate-200';

  sliderRow.append(slider, value);

  const controls = doc.createElement('div');
  controls.className = 'mt-4 flex flex-wrap items-center gap-3';

  const muteButton = doc.createElement('button');
  muteButton.type = 'button';
  muteButton.className =
    'inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white/80 transition-all duration-150 ease-out hover:bg-slate-700/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
  muteButton.setAttribute('aria-label', `Toggle mute for ${CHANNEL_LABELS[channel]}`);

  muteButton.addEventListener('click', () => {
    const next = !mixerState.channels[channel].muted;
    onMuteToggle(channel, next);
  });

  controls.append(muteButton);

  if (channel === 'sfx') {
    const preview = doc.createElement('button');
    preview.type = 'button';
    preview.className =
      'inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-accent-200 transition-all duration-150 ease-out hover:bg-accent/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
    preview.textContent = 'Play sample';
    preview.addEventListener('click', () => {
      playSafe('spawn');
    });
    controls.append(preview);
  }

  let ambienceToggle: HTMLButtonElement | undefined;
  if (channel === 'music' && onAmbienceToggle) {
    ambienceToggle = doc.createElement('button');
    ambienceToggle.type = 'button';
    ambienceToggle.className =
      'inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-200 transition-all duration-150 ease-out hover:bg-emerald-400/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300';
    ambienceToggle.addEventListener('click', () => {
      onAmbienceToggle();
    });
    controls.append(ambienceToggle);
  }

  const initialPercent = Math.round(state.channels[channel].volume * 100);
  slider.value = String(initialPercent);
  applySliderVisual(slider, initialPercent);
  value.textContent = formatPercent(initialPercent);
  muteButton.setAttribute('aria-pressed', state.channels[channel].muted ? 'true' : 'false');
  muteButton.textContent = state.channels[channel].muted ? 'Muted' : 'Active';
  if (channel === 'music') {
    slider.title = ambience.enabled
      ? 'Adjust ambience loudness'
      : 'Ambience paused — set the level ahead of resuming.';
  }

  slider.addEventListener('input', () => {
    const percent = Number(slider.value);
    applySliderVisual(slider, percent);
    value.textContent = formatPercent(percent);
    onVolumeInput(channel, percent / 100);
  });

  card.append(header, sliderRow, controls);

  return { card, slider, value, muteButton, status, ambienceToggle };
}

let mixerState = getMixerState();

export function showAudioSettingsOverlay(
  options: AudioSettingsOverlayOptions
): AudioSettingsOverlayHandle {
  const { container, onClose } = options;
  if (!container) {
    return {
      destroy() {},
      focus() {}
    };
  }

  const doc = container.ownerDocument ?? document;
  const overlay = doc.createElement('div');
  overlay.className =
    'pointer-events-auto fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-[22px] backdrop-saturate-[140%]';
  overlay.setAttribute('role', 'presentation');

  const panel = doc.createElement('section');
  panel.className =
    'w-full max-w-[min(580px,92vw)] space-y-6 rounded-hud-xl border border-white/12 bg-[linear-gradient(145deg,rgba(12,22,45,0.95),rgba(7,13,29,0.97))] p-6 text-slate-100 shadow-[0_32px_60px_rgba(4,10,24,0.7)] backdrop-blur-[24px] backdrop-saturate-[150%]';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const headingId = `audio-mixer-title-${Date.now()}`;
  panel.setAttribute('aria-labelledby', headingId);
  panel.tabIndex = -1;

  const headingRow = doc.createElement('header');
  headingRow.className = 'flex items-start justify-between gap-4';

  const headingGroup = doc.createElement('div');
  headingGroup.className = 'space-y-1';

  const heading = doc.createElement('h2');
  heading.id = headingId;
  heading.className = 'text-2xl font-semibold tracking-tight text-white';
  heading.textContent = 'Audio mixer';

  const subtitle = doc.createElement('p');
  subtitle.className = 'max-w-[46ch] text-sm text-slate-300/85';
  subtitle.textContent =
    'Dial in the master bus, ambience beds, and tactical feedback without leaving the battlefield.';

  headingGroup.append(heading, subtitle);

  const closeButton = doc.createElement('button');
  closeButton.type = 'button';
  closeButton.className =
    'rounded-full border border-white/20 bg-slate-800/70 px-3 py-1 text-sm font-semibold text-white/70 transition-all duration-150 hover:bg-slate-700/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
  closeButton.textContent = 'Close';

  headingRow.append(headingGroup, closeButton);

  const contextBadge = doc.createElement('span');
  contextBadge.className =
    'inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-800/65 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-white/70';

  const cardsContainer = doc.createElement('div');
  cardsContainer.className = 'space-y-5';

  let ambienceState = getAmbienceState();

  const channelControls: Record<MixerChannel, ChannelElements> = {
    master: createChannelCard(
      doc,
      'master',
      mixerState,
      ambienceState,
      (channel, next) => {
        setMasterMuted(next);
      },
      (channel, value) => {
        setMasterVolume(value);
      },
      null
    ),
    music: createChannelCard(
      doc,
      'music',
      mixerState,
      ambienceState,
      (channel, next) => {
        setMusicMuted(next);
      },
      (channel, value) => {
        setMusicVolume(value);
      },
      () => {
        setAmbienceEnabled(!ambienceState.enabled);
      }
    ),
    sfx: createChannelCard(
      doc,
      'sfx',
      mixerState,
      ambienceState,
      (channel, next) => {
        setSfxMuted(next);
      },
      (channel, value) => {
        setSfxVolume(value);
      },
      null
    )
  };

  cardsContainer.append(
    channelControls.master.card,
    channelControls.music.card,
    channelControls.sfx.card
  );

  panel.append(headingRow, contextBadge, cardsContainer);
  overlay.append(panel);
  container.append(overlay);

  let closed = false;

  function syncAmbienceToggle(): void {
    const toggle = channelControls.music.ambienceToggle;
    if (!toggle) {
      return;
    }
    toggle.setAttribute('aria-pressed', ambienceState.enabled ? 'true' : 'false');
    toggle.textContent = ambienceState.enabled ? 'Ambience enabled' : 'Ambience paused';
    toggle.title = ambienceState.enabled
      ? 'Disable ambience loops'
      : 'Enable ambience loops';
  }

  function applyMixerState(next: MixerState): void {
    mixerState = next;
    const contextLabel =
      next.contextState === 'uninitialized'
        ? 'Context idle'
        : next.contextState === 'running'
          ? 'Context running'
          : 'Context suspended';
    contextBadge.textContent = contextLabel;
    (['master', 'music', 'sfx'] as MixerChannel[]).forEach((channel) => {
      const controls = channelControls[channel];
      const channelState = next.channels[channel];
      const percent = Math.round(channelState.volume * 100);
      controls.slider.value = String(percent);
      applySliderVisual(controls.slider, percent);
      controls.value.textContent = formatPercent(percent);
      controls.muteButton.setAttribute('aria-pressed', channelState.muted ? 'true' : 'false');
      controls.muteButton.textContent = channelState.muted ? 'Muted' : 'Active';
      controls.status.textContent = describeChannelStatus(channel, next, ambienceState);
      if (channel === 'music') {
        controls.slider.title = ambienceState.enabled
          ? 'Adjust ambience loudness'
          : 'Ambience paused — set the level ahead of resuming.';
      }
    });
    syncAmbienceToggle();
  }

  function close(): void {
    if (closed) {
      return;
    }
    closed = true;
    cleanup();
    if (overlay.parentElement) {
      overlay.remove();
    }
    onClose?.();
  }

  function cleanup(): void {
    disposers.forEach((dispose) => {
      try {
        dispose();
      } catch {
        // ignore cleanup errors
      }
    });
    disposers.length = 0;
  }

  const disposers: Array<() => void> = [];

  const handleScrimClick = (event: MouseEvent) => {
    if (event.target === overlay) {
      close();
    }
  };
  overlay.addEventListener('click', handleScrimClick);
  disposers.push(() => overlay.removeEventListener('click', handleScrimClick));

  closeButton.addEventListener('click', close);
  disposers.push(() => closeButton.removeEventListener('click', close));

  const releaseFocus = createFocusTrap(overlay, panel, close);
  disposers.push(releaseFocus);

  const removeMixerListener = onMixerChange((state) => {
    applyMixerState(state);
  });
  disposers.push(removeMixerListener);

  const removeAmbienceListener = onAmbienceStateChange((state) => {
    ambienceState = state;
    syncAmbienceToggle();
    applyMixerState(mixerState);
  });
  disposers.push(removeAmbienceListener);

  applyMixerState(mixerState);
  panel.focus();

  return {
    destroy() {
      close();
    },
    focus() {
      panel.focus();
    }
  };
}
