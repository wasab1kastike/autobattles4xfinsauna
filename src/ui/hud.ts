export type BannerType = 'info' | 'warning' | 'error';

export interface BannerAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface BannerOptions {
  title?: string;
  messages: string[];
  actions?: BannerAction[];
  dismissible?: boolean;
  autoCloseMs?: number;
}

export interface BannerHandle {
  element: HTMLElement;
  dismiss: () => void;
}

export interface LoadingHandle {
  update(message: string): void;
  clear(): void;
  dispose(): void;
}

export interface HudController {
  showLoader(message?: string): LoadingHandle;
  showBanner(type: BannerType, options: BannerOptions): BannerHandle | null;
  removeTransientUI(): void;
}

export function createHud(root: HTMLElement | null): HudController {
  if (!root) {
    return {
      showLoader: () => ({
        update: () => undefined,
        clear: () => undefined,
        dispose: () => undefined,
      }),
      showBanner: () => null,
      removeTransientUI: () => undefined,
    };
  }

  const ensureBannerStack = (): HTMLElement => {
    let stack = root.querySelector<HTMLElement>('.hud-banner-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'hud-banner-stack';
      root.append(stack);
    }
    return stack;
  };

  const animateRemoval = (element: HTMLElement, hiddenClass: string, onComplete: () => void) => {
    let finished = false;
    const finalize = () => {
      if (finished) {
        return;
      }
      finished = true;
      element.removeEventListener('transitionend', finalize);
      onComplete();
    };

    element.addEventListener('transitionend', finalize);
    requestAnimationFrame(() => {
      element.classList.add(hiddenClass);
    });
    window.setTimeout(finalize, 400);
  };

  const showLoader = (message = 'Heating the sauna stones…'): LoadingHandle => {
    const loader = document.createElement('div');
    loader.className = 'hud-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');

    const card = document.createElement('div');
    card.className = 'hud-loader__card';

    const spinner = document.createElement('div');
    spinner.className = 'hud-loader__spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const messageElement = document.createElement('p');
    messageElement.className = 'hud-loader__message';
    messageElement.textContent = message;

    card.append(spinner, messageElement);
    loader.append(card);
    root.append(loader);

    let dismissed = false;

    return {
      update(text: string) {
        messageElement.textContent = text;
      },
      clear() {
        if (dismissed) {
          return;
        }
        animateRemoval(loader, 'hud-loader--hidden', () => {
          dismissed = true;
          loader.remove();
        });
      },
      dispose() {
        if (dismissed) {
          return;
        }
        dismissed = true;
        loader.remove();
      },
    };
  };

  const showBanner = (type: BannerType, options: BannerOptions): BannerHandle | null => {
    const stack = ensureBannerStack();

    const banner = document.createElement('section');
    banner.className = `hud-banner hud-banner--${type}`;
    banner.setAttribute('role', type === 'error' ? 'alert' : 'status');
    banner.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const header = document.createElement('header');
    header.className = 'hud-banner__header';

    const title = document.createElement('p');
    title.className = 'hud-banner__title';
    title.textContent =
      options.title ??
      (type === 'error' ? 'Attention required' : type === 'warning' ? 'Heads up' : 'Status update');
    header.append(title);

    const list = document.createElement('ul');
    list.className = 'hud-banner__list';
    for (const message of options.messages) {
      const item = document.createElement('li');
      item.textContent = message;
      list.append(item);
    }

    banner.append(header);
    if (options.messages.length) {
      banner.append(list);
    }

    if (options.actions?.length) {
      const actions = document.createElement('div');
      actions.className = 'hud-banner__actions';
      for (const action of options.actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className =
          action.variant === 'secondary'
            ? 'hud-banner__button hud-banner__button--secondary'
            : 'hud-banner__button';
        button.textContent = action.label;
        button.addEventListener('click', () => {
          action.onClick();
        });
        actions.append(button);
      }
      banner.append(actions);
    }

    let autoDismissId: number | undefined;
    let dismissed = false;

    const dismiss = () => {
      if (dismissed) {
        return;
      }
      dismissed = true;
      if (autoDismissId) {
        window.clearTimeout(autoDismissId);
      }
      animateRemoval(banner, 'hud-banner--hide', () => {
        banner.remove();
        if (!stack.hasChildNodes()) {
          stack.remove();
        }
      });
    };

    if (options.dismissible !== false) {
      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'hud-banner__close';
      closeButton.setAttribute('aria-label', 'Dismiss notification');
      closeButton.textContent = '×';
      closeButton.addEventListener('click', () => {
        dismiss();
      });
      header.append(closeButton);
    }

    stack.append(banner);

    if (options.autoCloseMs && options.autoCloseMs > 0) {
      autoDismissId = window.setTimeout(() => dismiss(), options.autoCloseMs);
    }

    return {
      element: banner,
      dismiss,
    };
  };

  const removeTransientUI = () => {
    root.querySelectorAll('.hud-loader').forEach((element) => {
      element.remove();
    });
    root.querySelectorAll('.hud-banner-stack').forEach((element) => {
      element.remove();
    });
  };

  return {
    showLoader,
    showBanner,
    removeTransientUI,
  };
}
