import type { GameState } from '../../core/GameState.ts';
import { createPolicyPanel } from './PolicyPanel.ts';
import { getHudOverlayElement } from '../layout.ts';
import '../responsive-sheet.css';
import './policies-window.css';

export type PoliciesWindowController = {
  open(options?: { focus?: boolean }): void;
  close(options?: { restoreFocus?: boolean }): void;
  toggle(force?: boolean): void;
  isOpen(): boolean;
  setBadge(value: string | number | null): void;
  onOpenChange(listener: (open: boolean) => void): () => void;
  destroy(): void;
};

type PoliciesWindowOptions = {
  overlay?: HTMLElement | null;
  title?: string;
  eyebrow?: string;
};

const focusableSelectors = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
] as const;

function ensurePortalRoot(doc: Document): HTMLElement {
  let portalRoot = doc.getElementById('hud-root');
  if (!portalRoot) {
    portalRoot = doc.createElement('div');
    portalRoot.id = 'hud-root';
    doc.body.appendChild(portalRoot);
  }
  return portalRoot;
}

function isHTMLElement(node: Element | null | undefined): node is HTMLElement {
  return !!node && node instanceof HTMLElement;
}

function setElementInert(element: HTMLElement | null, inert: boolean): void {
  if (!element) {
    return;
  }
  if ('inert' in element) {
    element.inert = inert;
  }
  if (inert) {
    if (!element.hasAttribute('data-inert-original-aria-hidden')) {
      const existing = element.getAttribute('aria-hidden');
      if (existing !== null) {
        element.setAttribute('data-inert-original-aria-hidden', existing);
      }
    }
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('data-inert', 'true');
  } else {
    element.removeAttribute('data-inert');
    const original = element.getAttribute('data-inert-original-aria-hidden');
    if (original !== null) {
      element.setAttribute('aria-hidden', original);
      element.removeAttribute('data-inert-original-aria-hidden');
    } else {
      element.removeAttribute('aria-hidden');
    }
  }
}

export function setupPoliciesWindow(
  state: GameState,
  options: PoliciesWindowOptions = {}
): PoliciesWindowController {
  const overlay = options.overlay ?? getHudOverlayElement();
  const hudOverlay = overlay instanceof HTMLElement ? overlay : null;
  const doc = overlay?.ownerDocument ?? document;
  const portalRoot = ensurePortalRoot(doc);

  const existing = portalRoot.querySelector<HTMLElement>('[data-policies-window]');
  existing?.remove();

  const root = doc.createElement('div');
  root.dataset.policiesWindow = 'true';
  root.className = 'policies-window';
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');

  const backdrop = doc.createElement('div');
  backdrop.className = 'hud-overlay policies-window__overlay';
  backdrop.setAttribute('aria-hidden', 'true');

  const sheet = doc.createElement('section');
  sheet.className = 'hud-sheet policies-window__sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  const titleId = `policies-window-title-${Math.floor(Math.random() * 100000)}`;
  sheet.id = `${titleId}-container`;
  sheet.setAttribute('aria-labelledby', titleId);

  const header = doc.createElement('header');
  header.className = 'hud-sheet__header policies-window__header';

  const titleBlock = doc.createElement('div');
  titleBlock.className = 'policies-window__title-block';

  const eyebrow = doc.createElement('span');
  eyebrow.className = 'policies-window__eyebrow';
  eyebrow.textContent = options.eyebrow ?? 'Sauna Council';

  const title = doc.createElement('h2');
  title.id = titleId;
  title.className = 'hud-sheet__title policies-window__title';
  title.textContent = options.title ?? 'Policy Directive Console';

  titleBlock.append(eyebrow, title);

  const statusBadge = doc.createElement('span');
  statusBadge.className = 'policies-window__status';
  statusBadge.dataset.visible = 'false';
  statusBadge.setAttribute('aria-live', 'polite');

  const closeButton = doc.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'hud-close policies-window__close';
  closeButton.setAttribute('aria-label', 'Close policies console');
  closeButton.innerHTML = '<span aria-hidden="true">✕</span>';

  header.append(titleBlock, statusBadge, closeButton);

  const body = doc.createElement('div');
  body.className = 'hud-sheet__body policies-window__body';

  const scroller = doc.createElement('div');
  scroller.className = 'hud-scroll policies-window__scroll';

  const content = doc.createElement('div');
  content.className = 'policies-window__content panel-section panel-section--scroll panel-section--policies';

  scroller.appendChild(content);
  body.appendChild(scroller);
  sheet.append(header, body);

  root.append(backdrop, sheet);
  portalRoot.appendChild(root);

  const policyPanel = createPolicyPanel(content, state);

  const listeners = new Set<(open: boolean) => void>();
  let isWindowOpen = false;
  let lastFocusedElement: HTMLElement | null = null;
  let pendingRestoreFocus: HTMLElement | null = null;
  let closeAnimationTimer: number | null = null;

  const notify = (open: boolean): void => {
    for (const listener of listeners) {
      try {
        listener(open);
      } catch (error) {
        console.warn('Failed to notify policies window listener', error);
      }
    }
  };

  const getFocusableElements = (): HTMLElement[] => {
    const nodes = Array.from(sheet.querySelectorAll<HTMLElement>(focusableSelectors.join(',')));
    return nodes.filter((element) => {
      if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      if (element instanceof HTMLInputElement && element.type === 'hidden') {
        return false;
      }
      if (element.tabIndex < 0 && !element.hasAttribute('contenteditable')) {
        return false;
      }
      if (!element.offsetParent && element !== doc.activeElement) {
        const style = element.ownerDocument?.defaultView?.getComputedStyle(element);
        return !!style && style.visibility !== 'hidden' && style.display !== 'none';
      }
      return true;
    });
  };

  const finishClose = () => {
    if (isWindowOpen) {
      return;
    }
    root.classList.remove('policies-window--visible');
    root.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    root.setAttribute('aria-hidden', 'true');
    const target = pendingRestoreFocus;
    pendingRestoreFocus = null;
    if (target) {
      target.focus({ preventScroll: true });
    }
    lastFocusedElement = null;
  };

  const handleTransitionEnd = (event: TransitionEvent) => {
    if (event.target === sheet && event.propertyName === 'transform') {
      finishClose();
    } else if (event.target === root && event.propertyName === 'opacity') {
      finishClose();
    }
  };
  sheet.addEventListener('transitionend', handleTransitionEnd);
  root.addEventListener('transitionend', handleTransitionEnd);

  const handleKeydown = (event: KeyboardEvent) => {
    if (!isWindowOpen) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      controller.close();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        closeButton.focus({ preventScroll: true });
        return;
      }
      const current = isHTMLElement(doc.activeElement) ? doc.activeElement : null;
      let index = focusable.findIndex((element) => element === current);
      if (index === -1) {
        index = event.shiftKey ? focusable.length - 1 : 0;
      } else {
        index = event.shiftKey ? index - 1 : index + 1;
      }
      if (index >= focusable.length) {
        index = 0;
      }
      if (index < 0) {
        index = focusable.length - 1;
      }
      event.preventDefault();
      focusable[index]?.focus({ preventScroll: true });
    }
  };

  const bindKeydown = () => {
    doc.addEventListener('keydown', handleKeydown, true);
  };
  const unbindKeydown = () => {
    doc.removeEventListener('keydown', handleKeydown, true);
  };

  const controller: PoliciesWindowController = {
    open({ focus = true }: { focus?: boolean } = {}) {
      if (isWindowOpen) {
        return;
      }
      if (closeAnimationTimer !== null) {
        window.clearTimeout(closeAnimationTimer);
        closeAnimationTimer = null;
      }
      const active = isHTMLElement(doc.activeElement) ? doc.activeElement : null;
      lastFocusedElement = active;
      pendingRestoreFocus = null;
      isWindowOpen = true;
      root.hidden = false;
      root.classList.add('policies-window--visible');
      sheet.setAttribute('aria-hidden', 'false');
      root.setAttribute('aria-hidden', 'false');
      backdrop.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => {
        root.classList.add('policies-window--open');
      });
      setElementInert(hudOverlay, true);
      bindKeydown();
      if (focus) {
        requestAnimationFrame(() => {
          const focusTargets = getFocusableElements();
          const first = focusTargets[0] ?? closeButton;
          first.focus({ preventScroll: true });
        });
      }
      notify(true);
    },
    close({ restoreFocus = true } = {}) {
      if (!isWindowOpen && !root.classList.contains('policies-window--visible')) {
        return;
      }
      if (isWindowOpen) {
        pendingRestoreFocus = restoreFocus && lastFocusedElement?.isConnected ? lastFocusedElement : null;
      } else if (restoreFocus && !pendingRestoreFocus) {
        pendingRestoreFocus = lastFocusedElement?.isConnected ? lastFocusedElement : null;
      }
      isWindowOpen = false;
      root.classList.remove('policies-window--open');
      backdrop.setAttribute('aria-hidden', 'true');
      setElementInert(hudOverlay, false);
      unbindKeydown();
      if (closeAnimationTimer !== null) {
        window.clearTimeout(closeAnimationTimer);
      }
      closeAnimationTimer = window.setTimeout(() => {
        closeAnimationTimer = null;
        finishClose();
      }, 280);
      notify(false);
    },
    toggle(force) {
      const next = typeof force === 'boolean' ? force : !isWindowOpen;
      if (next) {
        this.open();
      } else {
        this.close();
      }
    },
    isOpen() {
      return isWindowOpen;
    },
    setBadge(value) {
      if (value === null || value === '') {
        statusBadge.dataset.visible = 'false';
        statusBadge.textContent = '';
      } else {
        statusBadge.dataset.visible = 'true';
        statusBadge.textContent = typeof value === 'number' ? `${value}` : value;
      }
    },
    onOpenChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy() {
      this.close({ restoreFocus: false });
      policyPanel.destroy();
      listeners.clear();
      backdrop.removeEventListener('click', handleBackdropClick);
      closeButton.removeEventListener('click', handleCloseClick);
      sheet.removeEventListener('transitionend', handleTransitionEnd);
      root.removeEventListener('transitionend', handleTransitionEnd);
      unbindKeydown();
      if (closeAnimationTimer !== null) {
        window.clearTimeout(closeAnimationTimer);
        closeAnimationTimer = null;
      }
      finishClose();
      if (root.parentElement) {
        root.parentElement.removeChild(root);
      }
    },
  } satisfies PoliciesWindowController;

  const handleBackdropClick = (event: MouseEvent) => {
    if (event.target === backdrop) {
      controller.close();
    }
  };

  const handleCloseClick = () => {
    controller.close();
  };

  backdrop.addEventListener('click', handleBackdropClick);
  closeButton.addEventListener('click', handleCloseClick);

  return controller;
}
