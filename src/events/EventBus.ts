export type Listener<T> = (payload: T) => void;

export class EventBus {
  private listeners: Map<string, Listener<any>[]> = new Map();

  on<T>(event: string, listener: Listener<T>): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
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
