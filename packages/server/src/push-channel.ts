/**
 * Unbounded async iterable queue. Push values with `push()`, close with `close()`.
 * Consumers `for await` over the channel; they block until a value is available
 * or the channel is closed.
 */
export class PushChannel<T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private resolve: ((value: IteratorResult<T>) => void) | null = null;
  private done = false;

  push(value: T) {
    if (this.done) return;
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r({ value, done: false });
    } else {
      this.queue.push(value);
    }
  }

  close() {
    this.done = true;
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      r({ value: undefined as T, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.queue.length > 0) {
          return Promise.resolve({ value: this.queue.shift() as T, done: false });
        }
        if (this.done) {
          return Promise.resolve({ value: undefined as T, done: true });
        }
        return new Promise<IteratorResult<T>>((resolve) => {
          this.resolve = resolve;
        });
      },
    };
  }
}
