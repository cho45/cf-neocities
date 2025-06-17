import {
	env,
	listDurableObjectIds,
	runInDurableObject,
	SELF,
} from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { BBS, BBSPost } from "./BBS";


describe("BBS", () => {
  let bbs: BBS;
  beforeEach(() => {
    bbs = env.BBS.get(env.BBS.idFromName("global"));
  });

  it("should add and retrieve a post", async () => {
    const { id, post } = await bbs.post({ name: "foo", body: "bar" });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const posts = await bbs.getRange(0, 10);
    expect(posts.length).toBe(1);
    expect(posts[0].name).toBe("foo");
    expect(posts[0].body).toBe("bar");
  });

  it("should add multiple posts and get them in new order", async () => {
    await bbs.post({ name: "a", body: "1" });
    await bbs.post({ name: "b", body: "2" });
    await bbs.post({ name: "c", body: "3" });
    const posts = await bbs.getRange(0, 2);
    expect(posts.length).toBe(2);
    expect(posts[0].name).toBe("c");
    expect(posts[1].name).toBe("b");
  });

  it("should delete a post", async () => {
    const { id } = await bbs.post({ name: "foo", body: "bar", deleteKey: "key" });
    const deleted = await bbs.deletePost(id, "key");
    expect(deleted).toBe(true);
    const posts = await bbs.getRange(0, 10);
    expect(posts.length).toBe(0);
  });

  it("should not delete with wrong key", async () => {
    const { id } = await bbs.post({ name: "foo", body: "bar", deleteKey: "key" });
    const deleted = await bbs.deletePost(id, "wrong");
    expect(deleted).toBe(false);
    const posts = await bbs.getRange(0, 10);
    expect(posts.length).toBe(1);
  });

  it("should page correctly for > PAGE_SIZE posts", async () => {
    const PAGE_SIZE = 100;
    for (let i = 0; i < PAGE_SIZE + 5; i++) {
      await bbs.post({ name: `n${i}`, body: `${i}` });
    }
    const posts = await bbs.getRange(0, 10);
    expect(posts.length).toBe(10);
    expect(posts[0].body).toBe("104");
    expect(posts[9].body).toBe("95");
    const all = await bbs.getRange(0, PAGE_SIZE + 5);
    expect(all.length).toBe(PAGE_SIZE + 5);
    expect(all[0].body).toBe("104");
    expect(all[all.length - 1].body).toBe("0");
  });

  it("should get correct posts with offset", async () => {
    await bbs.post({ name: "a", body: "1" }); // newest: c, b, a
    await bbs.post({ name: "b", body: "2" });
    await bbs.post({ name: "c", body: "3" });
    const posts = await bbs.getRange(1, 2); // offset=1, limit=2
    expect(posts.length).toBe(2);
    expect(posts[0].name).toBe("b");
    expect(posts[1].name).toBe("a");
  });

  it("should skip deleted posts in getRange", async () => {
    const a = await bbs.post({ name: "a", body: "1", deleteKey: "k1" });
    const b = await bbs.post({ name: "b", body: "2", deleteKey: "k2" });
    const c = await bbs.post({ name: "c", body: "3", deleteKey: "k3" });
    await bbs.deletePost(b.id, "k2");
    const posts = await bbs.getRange(0, 10);
    expect(posts.length).toBe(2);
    expect(posts[0].name).toBe("c");
    expect(posts[1].name).toBe("a");
    // bが消えていること
    expect(posts.find(p => p.name === "b")).toBeUndefined();
  });

  it("should skip deleted posts in getRange", async () => {
	const fixture = [];
	for (let i = 0; i < 10; i++) {
	  fixture.push(await bbs.post({ name: `user${i}`, body: `post${i}`, deleteKey: `test` }));
	}
    await bbs.deletePost(fixture[1].id, "test");
    await bbs.deletePost(fixture[2].id, "test");
    const posts = await bbs.getRange(0, 3);
	expect(posts.length).toBe(3);
	expect(posts[0].name).toBe("user9");
	expect(posts[1].name).toBe("user8");
	expect(posts[2].name).toBe("user7");
  });
});
