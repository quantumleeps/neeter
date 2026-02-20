import { describe, expect, it } from "vitest";
import { PushChannel } from "./push-channel.js";

describe("PushChannel", () => {
  it("queues values pushed before consuming", async () => {
    const ch = new PushChannel<number>();
    ch.push(1);
    ch.push(2);
    ch.push(3);
    ch.close();

    const values: number[] = [];
    for await (const v of ch) {
      values.push(v);
    }
    expect(values).toEqual([1, 2, 3]);
  });

  it("resolves immediately when push is called while awaiting", async () => {
    const ch = new PushChannel<string>();

    const promise = (async () => {
      const iter = ch[Symbol.asyncIterator]();
      const result = await iter.next();
      return result.value;
    })();

    // Allow the iterator to set up its pending promise
    await new Promise((r) => setTimeout(r, 0));
    ch.push("hello");

    expect(await promise).toBe("hello");
    ch.close();
  });

  it("ends iteration on close", async () => {
    const ch = new PushChannel<number>();
    ch.close();

    const iter = ch[Symbol.asyncIterator]();
    const result = await iter.next();
    expect(result.done).toBe(true);
  });

  it("ignores pushes after close", async () => {
    const ch = new PushChannel<number>();
    ch.push(1);
    ch.close();
    ch.push(2);

    const values: number[] = [];
    for await (const v of ch) {
      values.push(v);
    }
    expect(values).toEqual([1]);
  });

  it("yields all queued values then ends on close", async () => {
    const ch = new PushChannel<string>();
    ch.push("a");
    ch.push("b");

    const iter = ch[Symbol.asyncIterator]();
    expect((await iter.next()).value).toBe("a");
    expect((await iter.next()).value).toBe("b");

    ch.close();
    expect((await iter.next()).done).toBe(true);
  });
});
