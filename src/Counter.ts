import { DurableObject } from "cloudflare:workers";

export class Counter extends DurableObject {
  async getCounterValue(): Promise<number> {
    this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY, value INTEGER)");
    const result = this.ctx.storage.sql.exec("SELECT value FROM counter WHERE id = 1");
    const rows = result.toArray();
    return (rows[0]?.value || 0) as number;
  }

  async increment(amount = 1): Promise<number> {
    this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY, value INTEGER)");
    const result = this.ctx.storage.sql.exec(
      "INSERT INTO counter (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = value + ? RETURNING value",
      amount, amount
    );
    const rows = result.toArray();
    return (rows[0]?.value || amount) as number;
  }
}
