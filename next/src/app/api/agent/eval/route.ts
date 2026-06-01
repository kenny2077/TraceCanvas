import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/agents/adapters";
import { evaluateRun } from "@/lib/agents/evaluator";
import { buildSourceKeyPrompt } from "@/lib/agents/prompt";
import {
  SURVEY_JSON,
  SURVEY_SOURCE_KEYS,
  SURVEY_FIDELITY_SAMPLES,
} from "@/__tests__/fixtures/surveyFixture";
import { validateJsonRequest, badRequest, EvalRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EvalRequestBody = {
  adapter: string;
  prompt?: string;
};

/**
 * POST /api/agent/eval
 *
 * Runs a full evaluation: prompt → adapter.generate() → extract → postprocess → verify.
 * Returns the complete EvalResult. The Prompt Lab calls this from the browser
 * (which can't call DeepSeek/Kimi APIs directly due to CORS).
 *
 * Only the mock adapter works without environment variables. DeepSeek and Kimi
 * adapters read API keys from process.env on the server side — keys are never
 * sent to the client.
 */
export async function POST(req: NextRequest) {
  const parsed = await validateJsonRequest<EvalRequestBody>(req, EvalRequestSchema);
  if (!parsed.ok) return badRequest(parsed.errors);
  const { adapter: adapterId, prompt: promptOverride } = parsed.value;

  const adapter = getAdapter(adapterId);
  if (!adapter) {
    return NextResponse.json(
      { error: `Unknown adapter: ${adapterId}. Valid: mock, deepseek, kimi` },
      { status: 400 },
    );
  }

  // Use the survey fixture as the default source data.
  const sourceData = SURVEY_JSON;
  const allowedKeys = [...SURVEY_SOURCE_KEYS];
  const fidelitySamples = [...SURVEY_FIDELITY_SAMPLES];

  const prompt =
    promptOverride ??
    buildSourceKeyPrompt({
      sourceData,
      allowedKeys,
      title: "Employee Engagement Survey — Q1 2025",
    });

  try {
    const result = await evaluateRun({
      adapter,
      prompt,
      sourceData,
      allowedKeys,
      fidelitySamples,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
