import { describe, expect, it } from "vitest";
import { GET } from "../../app/api/templates/route";

/**
 * GET /api/templates — returns template registry.
 *
 * Contract:
 *   - Status 200
 *   - Body: { templates: SkillMeta[] }
 *   - Each template: id, zhName, enName, emoji, description, category, scenario, tags
 *   - Cache-Control header set for 5s browser cache
 */
describe("GET /api/templates", () => {
  it("returns 200 with valid shape", async () => {
    const resp = await GET();
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body).toHaveProperty("templates");
    expect(Array.isArray(body.templates)).toBe(true);
  });

  it("returns non-empty template array", async () => {
    const resp = await GET();
    const body = await resp.json();

    // The skills directory ships with 80+ templates.
    expect(body.templates.length).toBeGreaterThan(0);
  });

  it("every template has required fields", async () => {
    const resp = await GET();
    const body = await resp.json();

    for (const tpl of body.templates) {
      expect(tpl).toHaveProperty("id");
      expect(tpl).toHaveProperty("zhName");
      expect(tpl).toHaveProperty("enName");
      expect(tpl).toHaveProperty("emoji");
      expect(tpl).toHaveProperty("description");
      expect(tpl).toHaveProperty("category");
      expect(tpl).toHaveProperty("scenario");
      expect(tpl).toHaveProperty("tags");
      expect(typeof tpl.id).toBe("string");
      expect(typeof tpl.zhName).toBe("string");
      expect(Array.isArray(tpl.tags)).toBe(true);
    }
  });

  it("has cache-control header for browser caching", async () => {
    const resp = await GET();
    const cacheControl = resp.headers.get("Cache-Control");
    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain("max-age");
  });

  it("known templates are present", async () => {
    const resp = await GET();
    const body = await resp.json();

    const ids = body.templates.map((t: { id: string }) => t.id);

    // A few well-known templates that ship with the project
    expect(ids).toContain("article-magazine");
    expect(ids).toContain("deck-simple");
  });

  it("featured templates have featured field", async () => {
    const resp = await GET();
    const body = await resp.json();

    const featured = body.templates.filter(
      (t: { featured?: number }) => typeof t.featured === "number",
    );
    // At least one template should be featured
    expect(featured.length).toBeGreaterThan(0);
  });
});
