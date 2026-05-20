import { describe, expect, it } from "vitest";
import { LruCache } from "../cache";

describe("LruCache", () => {
  it("stores and retrieves entries", () => {
    const c = new LruCache<string>(10);
    c.set("a", "alpha");
    expect(c.get("a")).toBe("alpha");
  });

  it("evicts least-recently-used when over capacity", () => {
    const c = new LruCache<number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a"); // bump a → most recent
    c.set("c", 3); // should evict b
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    expect(c.get("c")).toBe(3);
  });

  it("expires entries after ttl", async () => {
    const c = new LruCache<string>(10, 30);
    c.set("a", "alpha");
    await new Promise((r) => setTimeout(r, 50));
    expect(c.get("a")).toBeUndefined();
  });

  it("clear() empties the cache", () => {
    const c = new LruCache<number>(10);
    c.set("a", 1);
    c.set("b", 2);
    c.clear();
    expect(c.size()).toBe(0);
  });
});
