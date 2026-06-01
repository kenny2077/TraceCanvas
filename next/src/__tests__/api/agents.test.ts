import { describe, expect, it } from "vitest";
import { GET } from "../../app/api/agents/route";

/**
 * GET /api/agents — returns detected agent CLIs.
 *
 * Contract:
 *   - Status 200
 *   - Body: { agents: AgentInfo[], installedCount: number, platform: string }
 *   - Each agent has: id, label, vendor, available, protocol, models
 */
describe("GET /api/agents", () => {
  it("returns 200 with valid shape", async () => {
    const resp = await GET();
    expect(resp.status).toBe(200);

    const body = await resp.json();
    expect(body).toHaveProperty("agents");
    expect(body).toHaveProperty("installedCount");
    expect(body).toHaveProperty("platform");
    expect(Array.isArray(body.agents)).toBe(true);
    expect(typeof body.installedCount).toBe("number");
    expect(typeof body.platform).toBe("string");
  });

  it("every agent has required fields", async () => {
    const resp = await GET();
    const body = await resp.json();

    for (const agent of body.agents) {
      expect(agent).toHaveProperty("id");
      expect(agent).toHaveProperty("label");
      expect(agent).toHaveProperty("vendor");
      expect(agent).toHaveProperty("available");
      expect(agent).toHaveProperty("protocol");
      expect(agent).toHaveProperty("models");
      expect(typeof agent.id).toBe("string");
      expect(typeof agent.label).toBe("string");
      expect(typeof agent.available).toBe("boolean");
      expect(Array.isArray(agent.models)).toBe(true);
    }
  });

  it("installedCount matches available agents", async () => {
    const resp = await GET();
    const body = await resp.json();

    const availableCount = body.agents.filter(
      (a: { available: boolean }) => a.available,
    ).length;
    expect(body.installedCount).toBe(availableCount);
  });

  it("has at least one known agent defined", async () => {
    const resp = await GET();
    const body = await resp.json();

    // Claude Code is always defined in AGENTS array
    const claude = body.agents.find(
      (a: { id: string }) => a.id === "claude",
    );
    expect(claude).toBeDefined();
    expect(claude.label).toBe("Claude Code");
    expect(claude.vendor).toBe("Anthropic");
  });

  it("ACP agents are marked unsupported", async () => {
    const resp = await GET();
    const body = await resp.json();

    const acpAgents = body.agents.filter(
      (a: { protocol: string }) => a.protocol === "acp" || a.protocol === "pi-rpc",
    );
    for (const agent of acpAgents) {
      expect(agent.unsupported).toBe(true);
    }
  });
});
