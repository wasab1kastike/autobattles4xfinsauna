export type Listener<T> = (payload: T) => void;

export class EventBus {
  private listeners: Map<string, Listener<any>[]> = new Map();

  on<T>(event: string, listener: Listener<T>): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
  }

  off<T>(event: string, listener: Listener<T>): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(listener as Listener<any>);
    if (idx !== -1) {
      list.splice(idx, 1);
      if (list.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, list);
      }
    }
  }

  emit<T>(event: string, payload: T): void {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const l of list) {
      l(payload);
    }
  }
}

export const eventBus = new EventBus();
