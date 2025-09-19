export type TutorialStep = {
  id: string;
  target: string;
  title: string;
  description: string;
};

export type TutorialOptions = {
  steps?: readonly TutorialStep[];
  onComplete?: () => void;
  onSkip?: () => void;
};

export type TutorialController = {
  start(): void;
  next(): void;
  previous(): void;
  skip(): void;
  finish(): void;
  destroy(): void;
};

const STEP_ANCHOR_SELECTOR = (id: string) => `[data-tutorial-target="${id}"]`;
const CARD_OFFSET = 16;
const SPOTLIGHT_PADDING = 12;
const ACTIVE_CLASS = 'is-tutorial-highlighted';

const defaultSteps: readonly TutorialStep[] = [
  {
    id: 'heat',
    target: 'heat',
    title: 'Heat the Sauna',
    description:
      'Keep the sauna fires roaring. This control shows when the next warrior emerges from the steam.'
  },
  {
    id: 'upkeep',
    target: 'upkeep',
    title: 'Mind Your Upkeep',
    description:
      'Every attendant draws upkeep. Track totals and see a featured roster member to balance your economy.'
  },
  {
    id: 'sisu',
    target: 'sisu',
    title: 'Stockpile SISU',
    description:
      'SISU fuels heroic bursts. Watch this meter to know when your grit reserves can power signature moves.'
  },
  {
    id: 'combat',
    target: 'combat',
    title: 'Command the Fight',
    description:
      'Trigger a Sisu Burst to supercharge allied attacks or rally everyone home with a Torille call.'
  },
  {
    id: 'victory',
    target: 'victory',
    title: 'Claim Victory',
    description:
      'Saunakunnia measures renown. Push it ever higher to unlock triumphs and close the campaign in glory.'
  }
];

type Position = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createTutorialController(options: TutorialOptions = {}): TutorialController {
  const steps = options.steps ?? defaultSteps;
  if (steps.length === 0) {
    throw new Error('Tutorial requires at least one step.');
  }

  let currentIndex = -1;
  let activeTarget: HTMLElement | null = null;
  let mounted = false;

  const overlay = document.createElement('div');
  overlay.className = 'tutorial-overlay';

  const spotlight = document.createElement('div');
  spotlight.className = 'tutorial-overlay__spotlight';
  spotlight.setAttribute('aria-hidden', 'true');

  const card = document.createElement('section');
  card.className = 'tutorial-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'false');
  card.tabIndex = -1;

  const header = document.createElement('header');
  header.className = 'tutorial-card__header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'tutorial-card__title';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'tutorial-card__close';
  closeBtn.setAttribute('aria-label', 'Dismiss tutorial');
  closeBtn.textContent = '×';

  header.append(titleEl, closeBtn);

  const description = document.createElement('p');
  description.className = 'tutorial-card__description';

  const progress = document.createElement('p');
  progress.className = 'tutorial-card__progress';

  const controls = document.createElement('div');
  controls.className = 'tutorial-card__controls';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'tutorial-card__button tutorial-card__button--secondary';
  backBtn.textContent = 'Back';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'tutorial-card__button';
  nextBtn.textContent = 'Next';

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'tutorial-card__skip';
  skipBtn.textContent = 'Skip tutorial';

  controls.append(backBtn, nextBtn);

  card.append(header, description, progress, controls, skipBtn);
  overlay.append(spotlight, card);

  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          if (currentIndex >= 0) {
            positionElements();
          }
        })
      : null;

  const handleScroll = () => {
    if (currentIndex >= 0) {
      positionElements();
    }
  };

  function ensureMounted(): void {
    if (mounted) {
      return;
    }
    document.body.appendChild(overlay);
    window.addEventListener('resize', positionElements);
    document.addEventListener('scroll', handleScroll, true);
    resizeObserver?.observe(card);
    mounted = true;
  }

  function teardown(): void {
    if (!mounted) {
      return;
    }
    window.removeEventListener('resize', positionElements);
    document.removeEventListener('scroll', handleScroll, true);
    resizeObserver?.disconnect();
    overlay.remove();
    mounted = false;
  }

  function highlight(target: HTMLElement | null): void {
    if (activeTarget && activeTarget !== target) {
      activeTarget.classList.remove(ACTIVE_CLASS);
      activeTarget.removeAttribute('data-tutorial-highlight');
    }
    activeTarget = target;
    if (!target) {
      spotlight.style.opacity = '0';
      return;
    }
    target.classList.add(ACTIVE_CLASS);
    target.setAttribute('data-tutorial-highlight', 'true');
    spotlight.style.opacity = '1';
  }

  function computeTargetPosition(): Position | null {
    if (!activeTarget) {
      return null;
    }
    const rect = activeTarget.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return null;
    }
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    };
  }

  function positionElements(): void {
    const targetPos = computeTargetPosition();
    if (!targetPos) {
      card.style.top = `${CARD_OFFSET}px`;
      card.style.left = `${CARD_OFFSET}px`;
      card.classList.add('tutorial-card--floating');
      spotlight.style.opacity = '0';
      return;
    }
    card.classList.remove('tutorial-card--floating');
    spotlight.style.opacity = '1';

    const highlightTop = targetPos.top - SPOTLIGHT_PADDING;
    const highlightLeft = targetPos.left - SPOTLIGHT_PADDING;
    const highlightWidth = targetPos.width + SPOTLIGHT_PADDING * 2;
    const highlightHeight = targetPos.height + SPOTLIGHT_PADDING * 2;
    spotlight.style.top = `${highlightTop}px`;
    spotlight.style.left = `${highlightLeft}px`;
    spotlight.style.width = `${highlightWidth}px`;
    spotlight.style.height = `${highlightHeight}px`;

    const cardRect = card.getBoundingClientRect();
    const prefersBelow = window.innerHeight - targetPos.top - targetPos.height >= targetPos.top;
    let top = prefersBelow
      ? targetPos.top + targetPos.height + CARD_OFFSET
      : targetPos.top - cardRect.height - CARD_OFFSET;
    if (top < CARD_OFFSET) {
      top = CARD_OFFSET;
    } else if (top + cardRect.height > window.innerHeight - CARD_OFFSET) {
      top = window.innerHeight - CARD_OFFSET - cardRect.height;
    }

    const targetCenter = targetPos.left + targetPos.width / 2;
    let left = targetCenter - cardRect.width / 2;
    left = clamp(left, CARD_OFFSET, window.innerWidth - cardRect.width - CARD_OFFSET);

    card.style.top = `${Math.round(top)}px`;
    card.style.left = `${Math.round(left)}px`;
  }

  function focusCard(): void {
    requestAnimationFrame(() => {
      card.focus({ preventScroll: true });
    });
  }

  function showStep(index: number): void {
    if (index < 0 || index >= steps.length) {
      return;
    }
    ensureMounted();
    currentIndex = index;
    const step = steps[index];
    titleEl.textContent = step.title;
    description.textContent = step.description;
    progress.textContent = `Step ${index + 1} of ${steps.length}`;
    backBtn.disabled = index === 0;
    nextBtn.textContent = index === steps.length - 1 ? 'Finish' : 'Next';

    const target = document.querySelector<HTMLElement>(STEP_ANCHOR_SELECTOR(step.target));
    highlight(target ?? null);
    positionElements();
    focusCard();
  }

  function next(): void {
    if (currentIndex === -1) {
      showStep(0);
      return;
    }
    if (currentIndex >= steps.length - 1) {
      finish();
      return;
    }
    showStep(currentIndex + 1);
  }

  function previous(): void {
    if (currentIndex <= 0) {
      return;
    }
    showStep(currentIndex - 1);
  }

  function close(): void {
    highlight(null);
    teardown();
    currentIndex = -1;
  }

  function skip(): void {
    options.onSkip?.();
    close();
  }

  function finish(): void {
    options.onComplete?.();
    close();
  }

  backBtn.addEventListener('click', () => {
    previous();
  });
  nextBtn.addEventListener('click', () => {
    next();
  });
  skipBtn.addEventListener('click', () => {
    skip();
  });
  closeBtn.addEventListener('click', () => {
    skip();
  });

  card.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      previous();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      skip();
    }
  });

  return {
    start() {
      if (currentIndex !== -1) {
        return;
      }
      showStep(0);
    },
    next,
    previous,
    skip,
    finish,
    destroy() {
      close();
    }
  } satisfies TutorialController;
}
