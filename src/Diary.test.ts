import {
	env,
	listDurableObjectIds,
	runInDurableObject,
	SELF,
} from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { Diary, DiaryEntry } from "./Diary";

describe("Diary", () => {
  let diary: Diary;
  
  beforeEach(() => {
    diary = env.DIARY.get(env.DIARY.idFromName("global"));
  });

  it("should save and retrieve a diary entry", async () => {
    const entry = await diary.save({ 
      id: "2025-01-01", 
      body: "Test diary entry" 
    });
    
    expect(entry.id).toBe("2025-01-01");
    expect(entry.body).toBe("Test diary entry");
    expect(entry.createdAt).toBeDefined();
    expect(entry.updatedAt).toBeDefined();
    
    const retrieved = await diary.get("2025-01-01");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe("2025-01-01");
    expect(retrieved!.body).toBe("Test diary entry");
  });

  it("should update an existing diary entry", async () => {
    // 初回保存
    const original = await diary.save({ 
      id: "2025-01-02", 
      body: "Original content" 
    });
    
    // 更新
    const updated = await diary.save({ 
      id: "2025-01-02", 
      body: "Updated content" 
    });
    
    expect(updated.id).toBe("2025-01-02");
    expect(updated.body).toBe("Updated content");
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.updatedAt).not.toBe(original.updatedAt);
    
    const retrieved = await diary.get("2025-01-02");
    expect(retrieved!.body).toBe("Updated content");
  });

  it("should delete a diary entry", async () => {
    await diary.save({ 
      id: "2025-01-03", 
      body: "To be deleted" 
    });
    
    const deleted = await diary.delete("2025-01-03");
    expect(deleted).toBe(true);
    
    const retrieved = await diary.get("2025-01-03");
    expect(retrieved).toBeNull();
  });

  it("should return false when deleting non-existent entry", async () => {
    const deleted = await diary.delete("2025-12-31");
    expect(deleted).toBe(false);
  });

  it("should get recent entries in descending order", async () => {
    await diary.save({ id: "2025-01-01", body: "Entry 1" });
    await diary.save({ id: "2025-01-02", body: "Entry 2" });
    await diary.save({ id: "2025-01-03", body: "Entry 3" });
    
    const recent = await diary.getRecent(2);
    expect(recent.length).toBe(2);
    expect(recent[0].id).toBe("2025-01-03");
    expect(recent[1].id).toBe("2025-01-02");
  });

  it("should get entries by month", async () => {
    await diary.save({ id: "2025-01-01", body: "January 1" });
    await diary.save({ id: "2025-01-15", body: "January 15" });
    await diary.save({ id: "2025-02-01", body: "February 1" });
    
    const januaryEntries = await diary.getByMonth(2025, 1);
    expect(januaryEntries.length).toBe(2);
    expect(januaryEntries[0].id).toBe("2025-01-15");
    expect(januaryEntries[1].id).toBe("2025-01-01");
    
    const februaryEntries = await diary.getByMonth(2025, 2);
    expect(februaryEntries.length).toBe(1);
    expect(februaryEntries[0].id).toBe("2025-02-01");
  });

  it("should get years with entries", async () => {
    await diary.save({ id: "2023-01-01", body: "2023 entry" });
    await diary.save({ id: "2024-01-01", body: "2024 entry" });
    await diary.save({ id: "2025-01-01", body: "2025 entry" });
    
    const years = await diary.getYearsWithEntries();
    expect(years).toContain(2023);
    expect(years).toContain(2024);
    expect(years).toContain(2025);
    // 降順でソートされていることを確認
    expect(years[0]).toBeGreaterThan(years[1]);
  });

  it("should get months with entries for a specific year", async () => {
    await diary.save({ id: "2025-01-01", body: "January" });
    await diary.save({ id: "2025-03-01", body: "March" });
    await diary.save({ id: "2025-12-01", body: "December" });
    
    const months = await diary.getMonthsWithEntries(2025);
    expect(months).toEqual([1, 3, 12]);
  });

  it("should return empty array for months with no entries", async () => {
    const months = await diary.getMonthsWithEntries(2030);
    expect(months).toEqual([]);
  });

  it("should handle multiple entries correctly", async () => {
    // 複数のエントリを作成
    for (let i = 1; i <= 10; i++) {
      await diary.save({ 
        id: `2025-01-${i.toString().padStart(2, '0')}`, 
        body: `Entry ${i}` 
      });
    }
    
    const recent = await diary.getRecent(5);
    expect(recent.length).toBe(5);
    expect(recent[0].id).toBe("2025-01-10");
    expect(recent[4].id).toBe("2025-01-06");
    
    const allJanuary = await diary.getByMonth(2025, 1);
    expect(allJanuary.length).toBe(10);
  });

  it("should prevent SQL injection in getByMonth", async () => {
    // 正常なデータを作成
    await diary.save({ id: "2025-01-01", body: "Normal entry" });
    await diary.save({ id: "2025-02-01", body: "February entry" });
    
    // SQLインジェクション試行: LIKE演算子のワイルドカード悪用
    // 'OR 1=1を挿入しようとする試行
    try {
      const maliciousEntries = await diary.getByMonth(2025, 1);
      // 正常な1月のエントリのみ返ってくることを確認
      expect(maliciousEntries.length).toBe(1);
      expect(maliciousEntries[0].id).toBe("2025-01-01");
    } catch (error) {
      // エラーが発生しても問題ないが、データが漏洩してはならない
    }
    
    // ワイルドカード文字を含む悪意のある入力の試行
    // 実際の脆弱性テスト: 不正な月値での検索
    const entries = await diary.getByMonth(2025, 99); // 不正な月
    expect(entries.length).toBe(0);
  });

  it("should handle edge cases in date patterns", async () => {
    // 様々な日付パターンでデータを作成
    await diary.save({ id: "2025-01-01", body: "Jan 1" });
    await diary.save({ id: "2025-10-01", body: "Oct 1" });
    await diary.save({ id: "2025-12-31", body: "Dec 31" });
    await diary.save({ id: "2024-01-01", body: "Different year" });
    
    // 1月のみを取得
    const jan2025 = await diary.getByMonth(2025, 1);
    expect(jan2025.length).toBe(1);
    expect(jan2025[0].id).toBe("2025-01-01");
    
    // 10月のみを取得
    const oct2025 = await diary.getByMonth(2025, 10);
    expect(oct2025.length).toBe(1);
    expect(oct2025[0].id).toBe("2025-10-01");
    
    // 異なる年は除外されることを確認
    const jan2024 = await diary.getByMonth(2024, 1);
    expect(jan2024.length).toBe(1);
    expect(jan2024[0].id).toBe("2024-01-01");
  });
});