import { describe, it, expect } from "vitest";
import { 
  isValidDate, 
  getTodayDate, 
  getDaysInMonth, 
  formatDateForDisplay, 
  formatDateOnly,
  escapeHtml,
  nl2br
} from "./dateUtils";

describe("dateUtils", () => {
  describe("isValidDate", () => {
    it("should validate correct date formats", () => {
      expect(isValidDate("2025-01-01")).toBe(true);
      expect(isValidDate("2025-12-31")).toBe(true);
      expect(isValidDate("2024-02-29")).toBe(true); // leap year
    });

    it("should reject invalid date formats", () => {
      expect(isValidDate("25-01-01")).toBe(false);    // wrong year format
      expect(isValidDate("2025-1-1")).toBe(false);    // missing zero padding
      expect(isValidDate("2025-13-01")).toBe(false);  // invalid month
      expect(isValidDate("2025-01-32")).toBe(false);  // invalid day
      expect(isValidDate("2025-02-29")).toBe(false);  // not a leap year
      expect(isValidDate("2025/01/01")).toBe(false);  // wrong separator
      expect(isValidDate("invalid")).toBe(false);     // completely invalid
      expect(isValidDate("")).toBe(false);            // empty string
    });
  });

  describe("getTodayDate", () => {
    it("should return date in YYYY-MM-DD format", () => {
      const today = getTodayDate();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(isValidDate(today)).toBe(true);
    });
  });

  describe("getDaysInMonth", () => {
    it("should return correct days for various months", () => {
      expect(getDaysInMonth(2025, 1)).toBe(31);  // January
      expect(getDaysInMonth(2025, 2)).toBe(28);  // February (non-leap)
      expect(getDaysInMonth(2024, 2)).toBe(29);  // February (leap year)
      expect(getDaysInMonth(2025, 4)).toBe(30);  // April
      expect(getDaysInMonth(2025, 12)).toBe(31); // December
    });
  });

  describe("formatDateForDisplay", () => {
    it("should format ISO string for display", () => {
      const isoString = "2025-01-01T12:00:00.000Z";
      const formatted = formatDateForDisplay(isoString);
      
      // JST（UTC+9）に変換されるので、21:00になる
      expect(formatted).toBe("2025-01-01 21:00:00 JST");
    });
  });

  describe("formatDateOnly", () => {
    it("should format date string to Japanese format", () => {
      expect(formatDateOnly("2025-01-01")).toBe("2025年1月1日");
      expect(formatDateOnly("2025-12-31")).toBe("2025年12月31日");
    });
  });

  describe("escapeHtml", () => {
    it("should escape HTML special characters", () => {
      expect(escapeHtml("<script>alert('xss')</script>"))
        .toBe("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
      expect(escapeHtml('Test "quotes" & symbols'))
        .toBe("Test &quot;quotes&quot; &amp; symbols");
    });
  });

  describe("nl2br", () => {
    it("should convert newlines to br tags and escape HTML", () => {
      expect(nl2br("Line 1\nLine 2\nLine 3"))
        .toBe("Line 1<br>Line 2<br>Line 3");
      expect(nl2br("Line with <tag>\nSecond line"))
        .toBe("Line with &lt;tag&gt;<br>Second line");
    });
  });
});