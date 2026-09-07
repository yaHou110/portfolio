import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { identity } from "@learning-platform/core/api";
import { rateLimit, ipKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ResetPasswordSchema = z
  .object({
    tenantSlug: z.string().regex(/^\d{1,12}$/),
    nationalId: z.string().regex(/^\d{10}$/),
    code: z.string().regex(/^\d{6}$/),
    newPassword: z.string().min(8).max(200),
  })
  .strict();

/**
 * POST /api/auth/reset-password
 *
 * Body: { tenantSlug, nationalId, code, newPassword } → verifies the
 * one-time SMS code, then sets the new password hash. The code is consumed
 * (single-use) regardless of whether the password update succeeds.
 *
 * Errors are generic ("کد نامعتبر یا منقضی شده است") so this endpoint never
 * confirms which national IDs exist.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const limiter = rateLimit({
    key: `reset:${ipKey(request)}`,
    capacity: 10,
    refillPerSec: 0.2, // 1 attempt per 5s sustained after the burst
  });
  if (!limiter.ok) return limiter.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const ok = await identity.completePasswordReset({
    tenantSlug: parsed.data.tenantSlug,
    nationalId: parsed.data.nationalId,
    code: parsed.data.code,
    newPassword: parsed.data.newPassword,
  });

  if (!ok) {
    return NextResponse.json(
      { error: "کد نامعتبر یا منقضی شده است" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
