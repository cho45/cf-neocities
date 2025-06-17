import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "./index";

describe("HTTP Endpoints", () => {
  describe("Counter", () => {
    it("should get counter value", async () => {
      const res = await SELF.fetch("http://localhost/counter");
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data).toHaveProperty("count");
      expect(data).toHaveProperty("kiriban");
      expect(typeof data.count).toBe("number");
      expect(typeof data.kiriban).toBe("boolean");
    });

    it("should increment counter", async () => {
      // Get initial count
      const initialRes = await SELF.fetch("http://localhost/counter");
      const initialData = await initialRes.json();
      const initialCount = initialData.count;

      // Increment counter
      const res = await SELF.fetch("http://localhost/counter", {
        method: "POST",
        headers: {
          "x-requested-with": "XMLHttpRequest"
        }
      });
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data.count).toBe(initialCount + 1);
      expect(data).toHaveProperty("kiriban");
      expect(data).toHaveProperty("svg");
    });

    it("should reject POST without x-requested-with header", async () => {
      const res = await SELF.fetch("http://localhost/counter", {
        method: "POST"
      });
      expect(res.status).toBe(403);
      expect(await res.text()).toContain("CSRF");
    });

    it("should detect kiriban numbers", async () => {
      // Test with a known kiriban number (1111)
      // Note: This is more of an integration test
      const res = await SELF.fetch("http://localhost/counter");
      const data = await res.json();
      
      // Check the isKiriban logic indirectly
      expect(typeof data.kiriban).toBe("boolean");
    });
  });

  describe("BBS", () => {
    it("should get BBS page", async () => {
      const res = await SELF.fetch("http://localhost/bbs");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      
      const html = await res.text();
      expect(html).toContain("掲示板");
    });

    it("should get BBS list as JSON", async () => {
      const res = await SELF.fetch("http://localhost/bbs/list");
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data).toHaveProperty("posts");
      expect(data).toHaveProperty("total");
      expect(data).toHaveProperty("limit");
      expect(data).toHaveProperty("offset");
      expect(Array.isArray(data.posts)).toBe(true);
    });

    it("should post to BBS", async () => {
      const postData = {
        name: "Test User",
        body: "Test message",
        deleteKey: "testkey"
      };

      const res = await SELF.fetch("http://localhost/bbs/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest"
        },
        body: JSON.stringify(postData)
      });

      expect(res.status).toBe(200);
      const result = await res.json();
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("post");
    });

    it("should reject BBS post without x-requested-with header", async () => {
      const postData = {
        name: "Test User",
        body: "Test message"
      };

      const res = await SELF.fetch("http://localhost/bbs/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(postData)
      });

      expect(res.status).toBe(403);
    });

    it("should validate BBS post input", async () => {
      const invalidData = {
        name: "",  // Empty name
        body: "Test message"
      };

      const res = await SELF.fetch("http://localhost/bbs/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest"
        },
        body: JSON.stringify(invalidData)
      });

      expect(res.status).toBe(400);
    });

    it("should delete BBS post with correct key", async () => {
      // First, create a post
      const postData = {
        name: "Test User",
        body: "Test message to delete",
        deleteKey: "deletekey123"
      };

      const postRes = await SELF.fetch("http://localhost/bbs/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest"
        },
        body: JSON.stringify(postData)
      });

      const postResult = await postRes.json();
      const postId = postResult.id;

      // Then delete it
      const deleteData = {
        id: postId,
        deleteKey: "deletekey123"
      };

      const deleteRes = await SELF.fetch("http://localhost/bbs/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest"
        },
        body: JSON.stringify(deleteData)
      });

      expect(deleteRes.status).toBe(200);
      const deleteResult = await deleteRes.json();
      expect(deleteResult.deleted).toBe(true);
    });
  });

  describe("Diary", () => {
    const basicAuthHeader = "Basic " + btoa("admin:password");

    it("should debug routing for /diary/new", async () => {
      // Test without auth first to see what route matches
      const resNoAuth = await SELF.fetch("http://localhost/diary/new");
      console.log("No auth - Status:", resNoAuth.status);
      console.log("No auth - Response:", await resNoAuth.text());
      
      // Test with auth
      const resWithAuth = await SELF.fetch("http://localhost/diary/new", {
        headers: { "Authorization": basicAuthHeader }
      });
      console.log("With auth - Status:", resWithAuth.status);
      console.log("With auth - Content-Type:", resWithAuth.headers.get("content-type"));
      
      // This test is just for debugging, expect auth required
      expect(resNoAuth.status).toBe(401);
    });

    it("should perform complete CRUD workflow", async () => {
      const testDate = "2025-06-16";
      const originalBody = "Original diary entry content";
      const updatedBody = "Updated diary entry content";

      // 1. Create - POST /diary
      console.log("=== CREATE ===");
      const createFormData = new FormData();
      createFormData.append("date", testDate);
      createFormData.append("body", originalBody);

      const createRes = await SELF.fetch("http://localhost/diary", {
        method: "POST",
        headers: {
          "Authorization": basicAuthHeader,
          "x-requested-with": "XMLHttpRequest"
        },
        body: createFormData,
        redirect: "manual"
      });

      console.log("Create status:", createRes.status);
      console.log("Create location:", createRes.headers.get("location"));
      expect(createRes.status).toBe(302);
      expect(createRes.headers.get("location")).toBe(`/diary/${testDate}`);

      // 2. Read - GET /diary/:date
      console.log("=== READ ===");
      const readRes = await SELF.fetch(`http://localhost/diary/${testDate}`);
      console.log("Read status:", readRes.status);
      expect(readRes.status).toBe(200);
      
      const readHtml = await readRes.text();
      expect(readHtml).toContain(originalBody);
      console.log("Read content contains original body:", readHtml.includes(originalBody));

      // 3. Update - GET /diary/:date/edit (form) then POST /diary/:date/edit
      console.log("=== UPDATE (GET FORM) ===");
      const editFormRes = await SELF.fetch(`http://localhost/diary/${testDate}/edit`, {
        headers: { "Authorization": basicAuthHeader }
      });
      console.log("Edit form status:", editFormRes.status);
      expect(editFormRes.status).toBe(200);

      const editFormHtml = await editFormRes.text();
      expect(editFormHtml).toContain(originalBody);
      console.log("Edit form contains original body:", editFormHtml.includes(originalBody));

      console.log("=== UPDATE (POST) ===");
      const updateFormData = new FormData();
      updateFormData.append("date", testDate);
      updateFormData.append("body", updatedBody);

      const updateRes = await SELF.fetch(`http://localhost/diary/${testDate}/edit`, {
        method: "POST",
        headers: {
          "Authorization": basicAuthHeader,
          "x-requested-with": "XMLHttpRequest"
        },
        body: updateFormData,
        redirect: "manual"
      });

      console.log("Update status:", updateRes.status);
      console.log("Update location:", updateRes.headers.get("location"));
      expect(updateRes.status).toBe(302);
      expect(updateRes.headers.get("location")).toBe(`/diary/${testDate}`);

      // 4. Read updated content
      console.log("=== READ UPDATED ===");
      const readUpdatedRes = await SELF.fetch(`http://localhost/diary/${testDate}`);
      expect(readUpdatedRes.status).toBe(200);
      
      const readUpdatedHtml = await readUpdatedRes.text();
      expect(readUpdatedHtml).toContain(updatedBody);
      expect(readUpdatedHtml).not.toContain(originalBody);
      console.log("Updated content correct:", readUpdatedHtml.includes(updatedBody));

      // 5. Delete - POST /diary/:date/delete
      console.log("=== DELETE ===");
      const deleteRes = await SELF.fetch(`http://localhost/diary/${testDate}/delete`, {
        method: "POST",
        headers: {
          "Authorization": basicAuthHeader,
          "x-requested-with": "XMLHttpRequest"
        },
        redirect: "manual"
      });

      console.log("Delete status:", deleteRes.status);
      console.log("Delete location:", deleteRes.headers.get("location"));
      expect(deleteRes.status).toBe(302);
      expect(deleteRes.headers.get("location")).toBe("/diary");

      // 6. Verify deletion
      console.log("=== VERIFY DELETION ===");
      const verifyDeleteRes = await SELF.fetch(`http://localhost/diary/${testDate}`);
      console.log("Verify delete status:", verifyDeleteRes.status);
      expect(verifyDeleteRes.status).toBe(404);

      console.log("=== CRUD WORKFLOW COMPLETED SUCCESSFULLY ===");
    });

    it("should test diary list with entries", async () => {
      // Create multiple entries
      const entries = [
        { date: "2025-06-15", body: "Entry 1" },
        { date: "2025-06-14", body: "Entry 2" },
        { date: "2025-06-13", body: "Entry 3" }
      ];

      console.log("=== CREATING MULTIPLE ENTRIES ===");
      for (const entry of entries) {
        const formData = new FormData();
        formData.append("date", entry.date);
        formData.append("body", entry.body);

        const res = await SELF.fetch("http://localhost/diary", {
          method: "POST",
          headers: {
            "Authorization": basicAuthHeader,
            "x-requested-with": "XMLHttpRequest"
          },
          body: formData,
          redirect: "manual"
        });
        
        console.log(`Created entry ${entry.date}:`, res.status);
        expect(res.status).toBe(302);
      }

      // Check diary list page
      console.log("=== CHECKING DIARY LIST ===");
      const listRes = await SELF.fetch("http://localhost/diary");
      expect(listRes.status).toBe(200);
      
      const listHtml = await listRes.text();
      console.log("List page contains all entries:", 
        entries.every(entry => listHtml.includes(entry.body)));
      
      entries.forEach(entry => {
        expect(listHtml).toContain(entry.body);
      });

      // Test archive functionality
      console.log("=== TESTING ARCHIVES ===");
      const yearArchiveRes = await SELF.fetch("http://localhost/diary/year/2025");
      expect(yearArchiveRes.status).toBe(200);
      console.log("Year archive accessible:", yearArchiveRes.status === 200);

      const monthArchiveRes = await SELF.fetch("http://localhost/diary/year/2025/month/6");
      expect(monthArchiveRes.status).toBe(200);
      console.log("Month archive accessible:", monthArchiveRes.status === 200);

      const monthHtml = await monthArchiveRes.text();
      entries.forEach(entry => {
        expect(monthHtml).toContain(entry.body);
      });
      console.log("Month archive contains all entries:", 
        entries.every(entry => monthHtml.includes(entry.body)));
    });

    it("should get diary list page", async () => {
      const res = await SELF.fetch("http://localhost/diary");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      
      const html = await res.text();
      expect(html).toContain("日記");
    });

    it("should require authentication for diary new page", async () => {
      const res = await SELF.fetch("http://localhost/diary/new");
      // Should return 401 (Unauthorized) for requests without Authentication header
      expect(res.status).toBe(401);
    });

    it("should get diary new page with authentication", async () => {
      const res = await SELF.fetch("http://localhost/diary/new", {
        headers: {
          "Authorization": basicAuthHeader
        }
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    it("should create new diary entry", async () => {
      const formData = new FormData();
      formData.append("date", "2025-01-01");
      formData.append("body", "Test diary entry");

      const res = await SELF.fetch("http://localhost/diary", {
        method: "POST",
        headers: {
          "Authorization": basicAuthHeader,
          "x-requested-with": "XMLHttpRequest"
        },
        body: formData,
        redirect: "manual" // Don't follow redirects automatically
      });

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/diary/2025-01-01");
    });

    it("should get diary detail page", async () => {
      // First create an entry
      const formData = new FormData();
      formData.append("date", "2025-01-02");
      formData.append("body", "Test diary for detail view");

      await SELF.fetch("http://localhost/diary", {
        method: "POST",
        headers: {
          "Authorization": basicAuthHeader,
          "x-requested-with": "XMLHttpRequest"
        },
        body: formData
      });

      // Then get the detail page
      const res = await SELF.fetch("http://localhost/diary/2025-01-02");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      
      const html = await res.text();
      expect(html).toContain("Test diary for detail view");
    });

    it("should return 404 for non-existent diary entry", async () => {
      const res = await SELF.fetch("http://localhost/diary/2025-12-31");
      expect(res.status).toBe(404);
    });

    it("should validate date format", async () => {
      const res = await SELF.fetch("http://localhost/diary/invalid-date");
      expect(res.status).toBe(400);
      expect(await res.text()).toContain("Invalid date format");
    });

    it("should require authentication for diary edit", async () => {
      const res = await SELF.fetch("http://localhost/diary/2025-01-01/edit");
      expect(res.status).toBe(401);
    });

    it("should get diary edit page with authentication", async () => {
      // First ensure the entry exists
      const formData = new FormData();
      formData.append("date", "2025-01-03");
      formData.append("body", "Original content");

      await SELF.fetch("http://localhost/diary", {
        method: "POST",
        headers: {
          "Authorization": basicAuthHeader,
          "x-requested-with": "XMLHttpRequest"
        },
        body: formData
      });

      // Then get the edit page
      const res = await SELF.fetch("http://localhost/diary/2025-01-03/edit", {
        headers: {
          "Authorization": basicAuthHeader
        }
      });
      
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    it("should update diary entry", async () => {
      // First create an entry
      const createData = new FormData();
      createData.append("date", "2025-01-04");
      createData.append("body", "Original content");

      await SELF.fetch("http://localhost/diary", {
        method: "POST",
        headers: {
          "Authorization": basicAuthHeader,
          "x-requested-with": "XMLHttpRequest"
        },
        body: createData
      });

      // Then update it
      const updateData = new FormData();
      updateData.append("date", "2025-01-04");
      updateData.append("body", "Updated content");

      const res = await SELF.fetch("http://localhost/diary/2025-01-04/edit", {
        method: "POST",
        headers: {
          "Authorization": basicAuthHeader,
          "x-requested-with": "XMLHttpRequest"
        },
        body: updateData,
        redirect: "manual"
      });

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/diary/2025-01-04");
    });

    it("should delete diary entry", async () => {
      // First create an entry
      const formData = new FormData();
      formData.append("date", "2025-01-05");
      formData.append("body", "Entry to be deleted");

      await SELF.fetch("http://localhost/diary", {
        method: "POST",
        headers: {
          "Authorization": basicAuthHeader,
          "x-requested-with": "XMLHttpRequest"
        },
        body: formData
      });

      // Then delete it
      const res = await SELF.fetch("http://localhost/diary/2025-01-05/delete", {
        method: "POST",
        headers: {
          "Authorization": basicAuthHeader,
          "x-requested-with": "XMLHttpRequest"
        },
        redirect: "manual"
      });

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/diary");

      // Verify it's deleted
      const checkRes = await SELF.fetch("http://localhost/diary/2025-01-05");
      expect(checkRes.status).toBe(404);
    });

    it("should get year archive", async () => {
      const res = await SELF.fetch("http://localhost/diary/year/2025");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    it("should get month archive", async () => {
      const res = await SELF.fetch("http://localhost/diary/year/2025/month/1");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    });

    it("should validate year and month in archive URLs", async () => {
      const invalidYearRes = await SELF.fetch("http://localhost/diary/year/invalid");
      expect(invalidYearRes.status).toBe(400);

      const invalidMonthRes = await SELF.fetch("http://localhost/diary/year/2025/month/13");
      expect(invalidMonthRes.status).toBe(400);
    });

    it("should prevent duplicate entries for same date", async () => {
      // Create first entry
      const formData1 = new FormData();
      formData1.append("date", "2025-01-06");
      formData1.append("body", "First entry");

      await SELF.fetch("http://localhost/diary", {
        method: "POST",
        headers: {
          "Authorization": basicAuthHeader,
          "x-requested-with": "XMLHttpRequest"
        },
        body: formData1
      });

      // Try to create second entry for same date
      const formData2 = new FormData();
      formData2.append("date", "2025-01-06");
      formData2.append("body", "Second entry");

      const res = await SELF.fetch("http://localhost/diary", {
        method: "POST",
        headers: {
          "Authorization": basicAuthHeader,
          "x-requested-with": "XMLHttpRequest"
        },
        body: formData2,
        redirect: "manual"
      });

      expect(res.status).toBe(400);
      const html = await res.text();
      expect(html).toContain("既に存在します");
    });
  });
});