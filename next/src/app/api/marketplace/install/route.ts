import { NextResponse } from "next/server";
import { installFromGitHub, InstallError } from "@/lib/skills/install";
import { invalidateSkillsCache } from "@/lib/templates/loader";
import { hostRejectedResponse, isHostAllowed } from "../_lib/host-guard";
import { validateJsonRequest, badRequest, MarketplaceInstallSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isHostAllowed(req)) return hostRejectedResponse();
  const parsed = await validateJsonRequest<{ source: string }>(
    req as unknown as import("next/server").NextRequest,
    MarketplaceInstallSchema,
  );
  if (!parsed.ok) return badRequest(parsed.errors);
  const spec = parsed.value.source;
  try {
    const result = await installFromGitHub(spec);
    invalidateSkillsCache();
    return NextResponse.json({ package: result.package });
  } catch (err) {
    if (err instanceof InstallError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "install_failed", message }, { status: 500 });
  }
}
