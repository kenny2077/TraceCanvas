import { NextRequest, NextResponse } from "next/server";
import {
  DeployError,
  isDeployProviderId,
  readDeployConfig,
  type DeployProviderId,
} from "@/lib/deploy/config";
import { deployToVercel } from "@/lib/deploy/vercel";
import { validateJsonRequest, badRequest, DeployRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = {
  taskId: string;
  provider: DeployProviderId;
  html: string;
};

/**
 * Wrap a fragment in a minimal HTML5 envelope if the agent emitted bare
 * markup (no `<!DOCTYPE>` / `<html>`). Without this the deployed page
 * loads in browser quirks mode and renders very differently.
 */
function ensureFullHtmlDocument(html: string): string {
  if (!html.trim()) return html;
  if (/<!doctype\s+html/i.test(html) || /<html[\s>]/i.test(html)) return html;
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "<title>HTML Anything</title>",
    "</head>",
    "<body>",
    html,
    "</body>",
    "</html>",
  ].join("\n");
}

function deployErrorResponse(err: unknown): NextResponse {
  if (err instanceof DeployError) {
    return NextResponse.json(
      { error: err.message, code: err.code, details: err.details },
      { status: err.status },
    );
  }
  const msg = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: msg }, { status: 500 });
}

export async function POST(req: NextRequest) {
  const parsed = await validateJsonRequest<Body>(req, DeployRequestSchema);
  if (!parsed.ok) return badRequest(parsed.errors);
  const { taskId, provider, html } = parsed.value;

  if (provider !== "vercel") {
    // CF Pages support is planned for the next iteration. Surface a clear
    // 501 rather than crashing on an unimplemented branch.
    return NextResponse.json(
      {
        error:
          "Cloudflare Pages deploy is not implemented yet. Vercel is currently the only supported provider.",
      },
      { status: 501 },
    );
  }

  try {
    const config = await readDeployConfig(provider);
    if (!config.token) {
      throw new DeployError(
        "Vercel token is not configured. Open Settings → Deploy to add one.",
        400,
        undefined,
        "missing_token",
      );
    }
    const fullHtml = ensureFullHtmlDocument(html);
    const result = await deployToVercel({
      config,
      taskId,
      files: [
        { file: "index.html", data: fullHtml, contentType: "text/html" },
      ],
    });
    return NextResponse.json(result);
  } catch (err) {
    return deployErrorResponse(err);
  }
}
