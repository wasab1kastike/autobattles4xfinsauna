import { ReactNode } from 'react';
import HudPortal from './HudPortal';
import './responsive-sheet.css';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
  width?: number | string;
};

export default function ResponsiveSheet({
  open,
  onClose,
  title,
  footer,
  children,
  width = '38rem',
}: Props) {
  if (!open) return null;
  const sheetWidth = typeof width === 'number' ? `${width}px` : width;
  return (
    <HudPortal>
      <div className="hud-overlay" onClick={onClose} />
      <section className="hud-sheet" style={{ ['--sheet-w' as string]: sheetWidth }}>
        <header className="hud-sheet__header">
          <h2 className="hud-sheet__title">{title}</h2>
          <button className="hud-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="hud-sheet__body">
          <div className="hud-scroll">{children}</div>
        </div>
        {footer ? <footer className="hud-sheet__footer">{footer}</footer> : null}
      </section>
    </HudPortal>
  );
}
