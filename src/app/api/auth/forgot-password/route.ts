import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { identity } from "@learning-platform/core/api";
import { normalizePhone, hashResetToken } from "@learning-platform/core/auth";
import { sendPasswordResetSms } from "@/lib/sms";
import { rateLimit, ipKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ForgotPasswordSchema = z
  .object({
    tenantSlug: z.string().regex(/^\d{1,12}$/),
    nationalId: z.string().regex(/^\d{10}$/),
    phone: z.string().min(7).max(20),
  })
  .strict();

/**
 * POST /api/auth/forgot-password
 *
 * Body: { tenantSlug, nationalId, phone } → sends a 6-digit reset code by SMS.
 *
 * The response is deliberately generic: `{ ok: true }` whether or not the
 * account exists, so the endpoint cannot be used to enumerate valid
 * national-ID/phone pairs (the SMS cost also sits behind a tight IP rate
 * limit). In non-production builds, `devCode` echoes the code when a real
 * account was found so the flow is testable without an SMS gateway.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const limiter = rateLimit({
    key: `forgot:${ipKey(request)}`,
    capacity: 5,
    refillPerSec: 1 / 60, // 1 request per minute sustained after the burst
  });
  if (!limiter.ok) return limiter.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const parsed = ForgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!/^09\d{9}$/.test(phone)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Per-phone anti-SMS-bombing guard (3 per 10 minutes), on top of the IP
  // limiter — an attacker with many IPs must not be able to flood one phone.
  const phoneLimiter = rateLimit({
    key: `forgotp:${hashResetToken(phone)}`,
    capacity: 3,
    refillPerSec: 1 / 600,
  });
  if (!phoneLimiter.ok) return phoneLimiter.response;

  const account = await identity.requestPasswordReset({
    tenantSlug: parsed.data.tenantSlug,
    nationalId: parsed.data.nationalId,
    phone,
  });

  if (!account) {
    // Generic success — no enumeration signal.
    return NextResponse.json({ ok: true });
  }

  const sms = await sendPasswordResetSms(phone, account.code);
  if (!sms.ok) {
    // Log the failure but still answer generically — a 502 here would leak
    // whether an account exists (the request only reaches the gateway for
    // real accounts). The code stays valid for 10 minutes; the user can
    // retry, or an operator can inspect the logs.
    // eslint-disable-next-line no-console
    console.error(`[sms] delivery failed for reset code of user ${account.userId}`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, devCode: sms.devCode });
}
