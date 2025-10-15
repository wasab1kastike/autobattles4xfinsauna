import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = { children: ReactNode };

export default function HudPortal({ children }: Props) {
  let el = typeof document === 'undefined' ? null : document.getElementById('hud-root');
  if (!el && typeof document !== 'undefined') {
    el = document.createElement('div');
    el.id = 'hud-root';
    document.body.appendChild(el);
  }
  if (!el) {
    return null;
  }
  return createPortal(children, el);
}
