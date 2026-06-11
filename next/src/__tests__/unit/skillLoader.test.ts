import { describe, expect, it } from "vitest";
import { loadSkill, listSkills, type SkillMeta, type LoadedSkill } from "../../lib/templates/loader";

// ─── All 5 new skills load ──────────────────────────────────────────

describe("Skill loader — new report skills", () => {
  const skillIds = [
    "data-brief",
    "survey-insight",
    "executive-summary",
    "research-note",
    "social-card",
  ];

  for (const id of skillIds) {
    it(`loads ${id}`, () => {
      const skill = loadSkill(id);
      expect(skill).not.toBeNull();
      expect(skill!.id).toBe(id);
      expect(skill!.body).toBeTruthy();
      expect(skill!.body.length).toBeGreaterThan(50);
    });
  }
});

// ─── Verify profiles ─────────────────────────────────────────────────

describe("Skill loader — verify profiles", () => {
  it("data-brief has strict profile", () => {
    const skill = loadSkill("data-brief")!;
    expect(skill.verifyProfile).toBe("strict");
    expect(skill.sourceKeyRules).toBeTruthy();
    expect(skill.sourceKeyRules).toContain("pf-src");
  });

  it("survey-insight has strict profile", () => {
    const skill = loadSkill("survey-insight")!;
    expect(skill.verifyProfile).toBe("strict");
  });

  it("executive-summary has strict-numbers profile", () => {
    const skill = loadSkill("executive-summary")!;
    expect(skill.verifyProfile).toBe("strict-numbers");
    expect(skill.sourceKeyRules).toContain("Numeric metrics");
  });

  it("research-note has medium profile", () => {
    const skill = loadSkill("research-note")!;
    expect(skill.verifyProfile).toBe("medium");
  });

  it("social-card has medium profile", () => {
    const skill = loadSkill("social-card")!;
    expect(skill.verifyProfile).toBe("medium");
  });
});

// ─── Metadata correctness ────────────────────────────────────────────

describe("Skill loader — metadata", () => {
  it("data-brief has correct metadata", () => {
    const skill = loadSkill("data-brief")!;
    expect(skill.zhName).toBe("数据简报");
    expect(skill.enName).toBe("Data Brief");
    expect(skill.emoji).toBe("📊");
    expect(skill.category).toBe("report");
    expect(skill.scenario).toBe("operations");
    expect(skill.tags).toContain("data");
    expect(skill.tags).toContain("table");
  });

  it("survey-insight has correct metadata", () => {
    const skill = loadSkill("survey-insight")!;
    expect(skill.zhName).toBe("调查洞察报告");
    expect(skill.category).toBe("report");
    expect(skill.scenario).toBe("marketing");
    expect(skill.tags).toContain("survey");
  });

  it("executive-summary is one-page focused", () => {
    const skill = loadSkill("executive-summary")!;
    expect(skill.aspectHint).toContain("one-page");
    expect(skill.body).toContain("一页");
  });

  it("social-card is recommended", () => {
    const skill = loadSkill("social-card")!;
    expect(skill.recommended).toBe(1);
  });
});

// ─── All skills appear in listing ────────────────────────────────────

describe("Skill loader — listing includes new skills", () => {
  it("listSkills includes all 5 new skills", () => {
    const all = listSkills();
    const ids = all.map((s) => s.id);

    expect(ids).toContain("data-brief");
    expect(ids).toContain("survey-insight");
    expect(ids).toContain("executive-summary");
    expect(ids).toContain("research-note");
    expect(ids).toContain("social-card");
  });

  it("new skills appear alongside existing ones", () => {
    const all = listSkills();
    // Existing skills should still be present
    const ids = all.map((s) => s.id);
    expect(ids).toContain("article-magazine");
    expect(ids).toContain("deck-simple");
  });

  it("new skills have verifyProfile in meta", () => {
    const all = listSkills();
    const dataBrief = all.find((s) => s.id === "data-brief")!;
    expect(dataBrief.verifyProfile).toBe("strict");

    const socialCard = all.find((s) => s.id === "social-card")!;
    expect(socialCard.verifyProfile).toBe("medium");
  });

  it("existing skills have undefined verifyProfile (backward compat)", () => {
    const all = listSkills();
    const articleMagazine = all.find((s) => s.id === "article-magazine")!;
    expect(articleMagazine.verifyProfile).toBeUndefined();
  });
});

// ─── Source key rules ────────────────────────────────────────────────

describe("Skill loader — source key rules", () => {
  it("all 5 new skills have sourceKeyRules", () => {
    for (const id of ["data-brief", "survey-insight", "executive-summary", "research-note", "social-card"]) {
      const skill = loadSkill(id)!;
      expect(skill.sourceKeyRules).toBeTruthy();
      expect(skill.sourceKeyRules!.length).toBeGreaterThan(20);
    }
  });


});

// ─── Example files ───────────────────────────────────────────────────

describe("Skill loader — examples", () => {
  it("data-brief has example.md", () => {
    const skill = loadSkill("data-brief")!;
    expect(skill.example).toBeDefined();
    expect(skill.example!.hasMd).toBe(true);
  });

  it("survey-insight has example.md", () => {
    const skill = loadSkill("survey-insight")!;
    expect(skill.example).toBeDefined();
  });

  it("social-card has example.md", () => {
    const skill = loadSkill("social-card")!;
    expect(skill.example).toBeDefined();
  });
});
