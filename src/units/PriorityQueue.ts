export interface PriorityQueueEntry<T> {
  value: T;
  priority: number;
}

export class PriorityQueue<T> {
  private heap: PriorityQueueEntry<T>[] = [];

  push(value: T, priority: number): void {
    const entry: PriorityQueueEntry<T> = { value, priority };
    this.heap.push(entry);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): PriorityQueueEntry<T> | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }

    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].priority <= this.heap[index].priority) {
        break;
      }
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = index * 2 + 2;
      let smallest = index;

      if (
        leftIndex < length &&
        this.heap[leftIndex].priority < this.heap[smallest].priority
      ) {
        smallest = leftIndex;
      }
      if (
        rightIndex < length &&
        this.heap[rightIndex].priority < this.heap[smallest].priority
      ) {
        smallest = rightIndex;
      }
      if (smallest === index) {
        break;
      }
      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }
}
