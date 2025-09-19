interface FloaterOptions {
  text: string;
  x: number;
  y: number;
  color?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  durationMs?: number;
  fontSize?: number;
}

interface FloaterLayer {
  spawn(options: FloaterOptions): void;
  destroy(): void;
}

const reduceMotionQuery = typeof matchMedia === 'function'
  ? matchMedia('(prefers-reduced-motion: reduce)')
  : null;

const coarsePointerQuery = typeof matchMedia === 'function'
  ? matchMedia('(pointer: coarse)')
  : null;

const BASE_DURATION = 900;
const MOBILE_DURATION = 650;

function resolveVector(direction: FloaterOptions['direction']): { x: number; y: number } {
  switch (direction) {
    case 'down':
      return { x: 0, y: 36 };
    case 'left':
      return { x: -26, y: -18 };
    case 'right':
      return { x: 26, y: -18 };
    case 'up':
    default:
      return { x: 0, y: -40 };
  }
}

export function createFloaterLayer(root: HTMLElement): FloaterLayer {
  const layer = document.createElement('div');
  layer.className = 'ui-floater-layer';
  root.appendChild(layer);

  const prefersReducedMotion = Boolean(reduceMotionQuery?.matches);
  const coarsePointer = Boolean(coarsePointerQuery?.matches);

  const spawn = ({
    text,
    x,
    y,
    color,
    direction = 'up',
    durationMs,
    fontSize
  }: FloaterOptions): void => {
    const floater = document.createElement('span');
    floater.className = 'ui-floater';
    floater.textContent = text;
    floater.style.left = `${Math.round(x)}px`;
    floater.style.top = `${Math.round(y)}px`;
    if (color) {
      floater.style.color = color;
    }
    if (fontSize) {
      floater.style.fontSize = `${fontSize}px`;
    }

    const limit = coarsePointer ? 12 : 24;
    while (layer.childElementCount >= limit) {
      layer.firstElementChild?.remove();
    }

    layer.appendChild(floater);

    const duration = durationMs ?? (coarsePointer ? MOBILE_DURATION : BASE_DURATION);

    if (prefersReducedMotion || !floater.animate) {
      floater.style.opacity = '0';
      floater.style.transition = `opacity ${Math.round(duration * 0.8)}ms ease-out`;
      requestAnimationFrame(() => {
        floater.style.opacity = '1';
        requestAnimationFrame(() => {
          floater.style.opacity = '0';
        });
      });
      window.setTimeout(() => {
        floater.remove();
      }, duration);
      return;
    }

    const vector = resolveVector(direction);
    const keyframes: Keyframe[] = [
      {
        transform: 'translate3d(-50%, -50%, 0) translate3d(0, 0, 0)',
        opacity: 0
      },
      {
        transform: 'translate3d(-50%, -50%, 0) translate3d(0, 0, 0)',
        opacity: 1,
        offset: 0.18
      },
      {
        transform: `translate3d(-50%, -50%, 0) translate3d(${vector.x}px, ${vector.y}px, 0)`,
        opacity: 0
      }
    ];

    const animation = floater.animate(keyframes, {
      duration,
      easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
      fill: 'forwards'
    });
    animation.onfinish = () => {
      floater.remove();
    };
  };

  const destroy = () => {
    layer.remove();
  };

  return { spawn, destroy };
}

export type { FloaterLayer, FloaterOptions };
