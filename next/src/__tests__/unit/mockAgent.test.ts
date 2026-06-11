import { describe, expect, it } from "vitest";
import { getMockFixture, mockAgentStream } from "../../lib/agents/mock";

describe("mock agent", () => {
  it("returns a fixture for data-brief template", () => {
    const fixture = getMockFixture("data-brief");
    expect(fixture.html).toContain("<!DOCTYPE html>");
    expect(fixture.html).toContain("</html>");
    expect(fixture.html).toContain("<!-- pf-src:");
    expect(fixture.ttfb).toBeGreaterThan(0);
    expect(fixture.duration).toBeGreaterThan(0);
    expect(fixture.chunkSizes.length).toBeGreaterThan(1);
  });

  it("returns generic fixture for unknown template", () => {
    const fixture = getMockFixture("unknown-template");
    expect(fixture.html).toContain("Mock Agent Output");
  });

  it("streams start → delta → done events", async () => {
    const events: Array<{ type: string }> = [];
    for await (const ev of mockAgentStream("data-brief")) {
      events.push(ev);
    }
    expect(events[0].type).toBe("start");
    expect(events.some((e) => e.type === "delta")).toBe(true);
    expect(events[events.length - 1].type).toBe("done");
  });

  it("delta chunks concatenate to full HTML", async () => {
    let html = "";
    for await (const ev of mockAgentStream("data-brief")) {
      if (ev.type === "delta") html += ev.text;
    }
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });
});
