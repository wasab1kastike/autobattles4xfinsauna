export interface PointerPanHandlers {
  onPan: (dx: number, dy: number, event: PointerEvent) => void;
  onPanStart?: (event: PointerEvent) => void;
  onPanEnd?: (event: PointerEvent) => void;
}

export interface PointerPanOptions extends PointerPanHandlers {
  dragCursor?: string;
}

const DEFAULT_CURSOR = 'grabbing';

type PointerEventHandler = (event: PointerEvent) => void;

export function attachPointerPan(
  canvas: HTMLElement,
  handlers: PointerPanOptions
): () => void {
  const dragCursor = handlers.dragCursor ?? DEFAULT_CURSOR;
  let active = false;
  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let previousCursor: string | null = null;

  const handlePointerDown: PointerEventHandler = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) {
      return;
    }

    active = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    previousCursor = canvas.style.cursor ?? '';

    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = dragCursor;

    handlers.onPanStart?.(event);
  };

  const handlePointerMove: PointerEventHandler = (event) => {
    if (!active || pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    handlers.onPan(dx, dy, event);
  };

  const endPan = (event: PointerEvent) => {
    if (!active || pointerId !== event.pointerId) {
      return;
    }

    active = false;
    pointerId = null;

    canvas.releasePointerCapture?.(event.pointerId);
    canvas.style.cursor = previousCursor ?? '';

    handlers.onPanEnd?.(event);
  };

  const handlePointerUp: PointerEventHandler = (event) => {
    endPan(event);
  };

  const handlePointerCancel: PointerEventHandler = (event) => {
    endPan(event);
  };

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerCancel);
  canvas.addEventListener('pointerleave', handlePointerCancel);

  return () => {
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    canvas.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('pointercancel', handlePointerCancel);
    canvas.removeEventListener('pointerleave', handlePointerCancel);
    if (active && pointerId !== null) {
      canvas.releasePointerCapture?.(pointerId);
    }
    canvas.style.cursor = previousCursor ?? '';
  };
}
