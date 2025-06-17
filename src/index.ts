import { Hono } from "hono";
import { Counter } from "./Counter";
import { BBS } from "./BBS";
import { Diary } from "./Diary";
import type { MiddlewareHandler } from "hono";
import { getConnInfo } from "hono/cloudflare-workers";
import { basicAuth } from "hono/basic-auth";
import { extended as template } from "./templates.js";
import { digits as digitsSVGs } from "./digits.js";
import { isValidDate, getTodayDate, formatDateForDisplay, formatDateOnly, nl2br } from "./dateUtils";

// ===== Types & Interfaces =====
export interface CloudflareBindings {
  COUNTER: DurableObjectNamespace<Counter>;
  BBS: DurableObjectNamespace<BBS>;
  DIARY: DurableObjectNamespace<Diary>;
  DIARY_AUTH_USERNAME?: string;
  DIARY_AUTH_PASSWORD?: string;
}

type Env = CloudflareBindings;

// ===== Utility Functions =====
function isKiriban(count: number): boolean {
  const countStr = String(count);
  const allSame = /^([0-9])\1+$/.test(countStr);
  const milestone = /^([1-9])[0-9]*0{1,}$/.test(countStr);
  return allSame || milestone;
}

async function generateCounterSVG(count: number): Promise<string> {
  const digitWidth = 40;
  const digitHeight = 60;
  // @ts-ignore
  const digits = String(count).split("").map((d) => digitsSVGs[d] || "");
  const digitBodies = digits.map((svg) =>
    svg
      .replace(/^[\s\S]*?<svg[\s\S]*?>/i, "")
      .replace(/<\/svg>[\s\S]*$/i, "")
  );
  return `
    <svg xmlns='http://www.w3.org/2000/svg' width='${digitWidth * digits.length}' height='${digitHeight}'>
      ${digitBodies
        .map((body, i) => `<g transform='translate(${i * digitWidth},0)'>${body}</g>`)
        .join("")}
    </svg>
  `.replace(/\s+/g, ' ').trim();
}

async function ipHash(ip: string): Promise<string> {
  if (!ip) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode("bbs-ip-salt:" + ip);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return btoa(String.fromCharCode(...hash)).replace(/=+$/, "");
}

async function transformBBSPost(post: any) {
  return {
    id: post.id,
    name: post.name,
    body: post.body,
    date: post.date,
    deleteKey: !!post.deleteKey,
    ipHash: await ipHash(post.ip || "")
  };
}

// ===== Middleware =====
const requireXRequestedWith: MiddlewareHandler = async (c, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) return await next();
  if (c.req.header("x-requested-with") !== "XMLHttpRequest") {
    return c.text("Forbidden (CSRF)", 403);
  }
  return await next();
};

const diaryBasicAuth: MiddlewareHandler = async (c, next) => {
  const auth = basicAuth({
    username: c.env.DIARY_AUTH_USERNAME || 'admin',
    password: c.env.DIARY_AUTH_PASSWORD || 'password'
  });
  return auth(c, next);
};

// ===== Durable Object Helpers =====
function getCounterStub(env: CloudflareBindings) {
  return env.COUNTER.get(env.COUNTER.idFromName("global"));
}

function getBBSStub(env: CloudflareBindings) {
  return env.BBS.get(env.BBS.idFromName("global"));
}

function getDiaryStub(env: CloudflareBindings) {
  return env.DIARY.get(env.DIARY.idFromName("global"));
}

// ===== App Setup =====
const app = new Hono<{ Bindings: CloudflareBindings }>();
app.use("/*", requireXRequestedWith);

// ===== Counter Routes =====
app.get("/counter", async (c) => {
  const count = await getCounterStub(c.env).getCounterValue();
  return c.json({ count, kiriban: isKiriban(count) });
});

app.post("/counter", async (c) => {
  const count = await getCounterStub(c.env).increment();
  const kiriban = isKiriban(count);
  const svg = await generateCounterSVG(count);
  return c.json({ count, kiriban, svg });
});

// ===== BBS Routes =====
app.get("/bbs", async (c) => {
  const offset = Math.max(0, Number(c.req.query("offset")) || 0);
  const limit = 4;

  const bbs = getBBSStub(c.env);
  const postsRaw = await bbs.getRange(offset, limit);
  const posts = await Promise.all(postsRaw.map(transformBBSPost));
  const total = await bbs.getCount();
  
  return c.html(template('bbs', { 
    posts, 
    pager: { offset, limit, total }
  }));
});

app.get("/bbs/list", async (c) => {
  const offset = Math.max(0, Number(c.req.query("offset")) || 0);
  const limit = 4;
  
  const bbs = getBBSStub(c.env);
  const postsRaw = await bbs.getRange(offset, limit);
  const posts = await Promise.all(postsRaw.map(transformBBSPost));
  const total = await bbs.getCount();
  
  return c.json({ posts, total, limit, offset });
});

app.post("/bbs/post", async (c) => {
  const { name, body, deleteKey } = await c.req.json();
  
  if (!name || !body || name.length > 32 || body.length > 1000) {
    return c.text("Invalid input", 400);
  }
  
  const conn = getConnInfo(c);
  const ip = conn.remote.address || "";
  const result = await getBBSStub(c.env).post({ name, body, deleteKey }, ip);
  
  return c.json(result);
});

app.post("/bbs/delete", async (c) => {
  const { id, deleteKey } = await c.req.json();
  
  if (!id || !deleteKey) {
    return c.text("Invalid input", 400);
  }
  
  const deleted = await getBBSStub(c.env).deletePost(id, deleteKey);
  if (!deleted) {
    return c.text("Delete failed", 400);
  }
  
  return c.json({ deleted });
});

// ===== Diary Routes =====
app.get("/diary", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);
  const diary = getDiaryStub(c.env);
  
  const entries = await diary.getRecent(limit);
  const years = await diary.getYearsWithEntries();
  
  return c.html(template('diary/list', { 
    entries, 
    years,
    formatDateForDisplay,
    formatDateOnly,
    nl2br
  }));
});

// 年別アーカイブ
app.get("/diary/year/:year", async (c) => {
  const year = parseInt(c.req.param("year"));
  
  if (isNaN(year) || year < 1900 || year > 2100) {
    return c.text("Invalid year", 400);
  }
  
  const diary = getDiaryStub(c.env);
  const months = await diary.getMonthsWithEntries(year);
  const allYears = await diary.getYearsWithEntries();
  
  return c.html(template('diary/archive-year', { 
    year, 
    months, 
    allYears 
  }));
});

// 月別アーカイブ
app.get("/diary/year/:year/month/:month", async (c) => {
  const year = parseInt(c.req.param("year"));
  const month = parseInt(c.req.param("month"));
  
  if (isNaN(year) || year < 1900 || year > 2100 || 
      isNaN(month) || month < 1 || month > 12) {
    return c.text("Invalid year or month", 400);
  }
  
  const diary = getDiaryStub(c.env);
  const entries = await diary.getByMonth(year, month);
  
  return c.html(template('diary/archive-month', { 
    year, 
    month, 
    entries,
    formatDateForDisplay,
    formatDateOnly,
    nl2br
  }));
});

// 新規投稿フォーム（要認証）
app.get("/diary/new", diaryBasicAuth, async (c) => {
  return c.html(template('diary/form', { 
    isEdit: false,
    date: getTodayDate(),
    body: ""
  }));
});

// 編集フォーム（要認証）
app.get("/diary/:date/edit", diaryBasicAuth, async (c) => {
  const date = c.req.param("date");
  
  if (!isValidDate(date)) {
    return c.text("Invalid date format", 400);
  }
  
  const diary = getDiaryStub(c.env);
  const entry = await diary.get(date);
  
  return c.html(template('diary/form', { 
    isEdit: true,
    entry,
    date: entry ? entry.id : date,
    body: entry ? entry.body : ""
  }));
});

// 日記詳細
app.get("/diary/:date", async (c) => {
  const date = c.req.param("date");
  
  if (!isValidDate(date)) {
    return c.text("Invalid date format", 400);
  }
  
  const diary = getDiaryStub(c.env);
  const entry = await diary.get(date);
  
  if (!entry) {
    return c.text("Diary entry not found", 404);
  }
  
  return c.html(template('diary/detail', { 
    entry,
    formatDateForDisplay,
    formatDateOnly,
    nl2br
  }));
});

// 新規投稿処理（要認証）
app.post("/diary", diaryBasicAuth, async (c) => {
  const formData = await c.req.formData();
  const date = formData.get("date") as string;
  const body = formData.get("body") as string;
  
  // バリデーション
  if (!date || !body) {
    return c.html(template('diary/form', { 
      isEdit: false,
      date: date || getTodayDate(),
      body: body || "",
      error: "日付と本文は必須です"
    }), 400);
  }
  
  if (!isValidDate(date)) {
    return c.html(template('diary/form', { 
      isEdit: false,
      date,
      body,
      error: "有効な日付を入力してください"
    }), 400);
  }
  
  const diary = getDiaryStub(c.env);
  
  // 同じ日付のエントリが既に存在するかチェック
  const existing = await diary.get(date);
  if (existing) {
    return c.html(template('diary/form', { 
      isEdit: false,
      date,
      body,
      error: "この日付の日記は既に存在します。編集してください。"
    }), 400);
  }
  
  await diary.save({ id: date, body });
  
  // 成功時は詳細ページにリダイレクト
  return c.redirect(`/diary/${date}`, 302);
});

// 編集処理（要認証）
app.post("/diary/:date/edit", diaryBasicAuth, async (c) => {
  const originalDate = c.req.param("date");
  const formData = await c.req.formData();
  const date = formData.get("date") as string;
  const body = formData.get("body") as string;
  
  // バリデーション
  if (!date || !body) {
    return c.html(template('diary/form', { 
      isEdit: true,
      entry: { id: originalDate, body: body || "" },
      date: date || originalDate,
      body: body || "",
      error: "日付と本文は必須です"
    }), 400);
  }
  
  if (!isValidDate(date)) {
    return c.html(template('diary/form', { 
      isEdit: true,
      entry: { id: originalDate, body },
      date,
      body,
      error: "有効な日付を入力してください"
    }), 400);
  }
  
  const diary = getDiaryStub(c.env);
  
  // 日付が変更された場合の処理
  if (date !== originalDate) {
    // 新しい日付のエントリが既に存在するかチェック
    const existing = await diary.get(date);
    if (existing) {
      return c.html(template('diary/form', { 
        isEdit: true,
        entry: { id: originalDate, body },
        date,
        body,
        error: "この日付の日記は既に存在します"
      }), 400);
    }
    
    // 古いエントリを削除して新しいエントリを作成
    await diary.delete(originalDate);
    await diary.save({ id: date, body });
  } else {
    // 同じ日付なら更新
    await diary.save({ id: date, body });
  }
  
  // 成功時は詳細ページにリダイレクト
  return c.redirect(`/diary/${date}`, 302);
});

// 削除処理（要認証）
app.post("/diary/:date/delete", diaryBasicAuth, async (c) => {
  const date = c.req.param("date");
  
  if (!isValidDate(date)) {
    return c.text("Invalid date format", 400);
  }
  
  const diary = getDiaryStub(c.env);
  const deleted = await diary.delete(date);
  
  if (!deleted) {
    return c.text("Diary entry not found", 404);
  }
  
  // 成功時は日記一覧にリダイレクト
  return c.redirect("/diary", 302);
});

export default app;
export { Counter, BBS, Diary };
