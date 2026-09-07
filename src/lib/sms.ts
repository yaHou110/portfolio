/**
 * SMS gateway abstraction for the password-reset flow.
 *
 * Providers (env.SMS_PROVIDER):
 * - "mock" (default): logs the code to the server console. In non-production
 *   builds the code is also echoed back via `devCode` so the flow can be
 *   tested end-to-end without a real gateway. In production the code is only
 *   in the server log — never in the API response.
 * - "kavenegar": sends a real SMS via https://api.kavenegar.com (requires
 *   KAVENEGAR_API_KEY + KAVENEGAR_SENDER). Falls back to mock if unset.
 */
import { env } from "@/lib/env";

const isProd = process.env.NODE_ENV === "production";

export type SmsResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: "SMS_GATEWAY_ERROR" };

function resetMessage(code: string): string {
  return `رویش — کد بازیابی رمز عبور شما: ${code}\nاین کد تا ۱۰ دقیقه معتبر است.`;
}

function sendMock(phone: string, code: string): SmsResult {
  // eslint-disable-next-line no-console
  console.log(`[sms:mock] to=${phone} code=${code}`);
  return isProd ? { ok: true } : { ok: true, devCode: code };
}

async function sendKavenegar(phone: string, code: string): Promise<SmsResult> {
  const apiKey = env.KAVENEGAR_API_KEY;
  const sender = env.KAVENEGAR_SENDER;
  if (!apiKey || !sender) {
    // eslint-disable-next-line no-console
    console.warn(
      "[sms] KAVENEGAR_API_KEY / KAVENEGAR_SENDER not configured — falling back to mock"
    );
    return sendMock(phone, code);
  }
  try {
    const res = await fetch(
      `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          receptor: phone,
          sender,
          message: resetMessage(code),
        }),
      }
    );
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[sms] kavenegar http ${res.status}`);
      return { ok: false, error: "SMS_GATEWAY_ERROR" };
    }
    const data = (await res.json()) as { return?: { status?: number; message?: string } };
    if (data.return?.status !== 200) {
      // eslint-disable-next-line no-console
      console.warn(
        `[sms] kavenegar return ${data.return?.status}: ${data.return?.message}`
      );
      return { ok: false, error: "SMS_GATEWAY_ERROR" };
    }
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[sms] kavenegar request failed", err);
    return { ok: false, error: "SMS_GATEWAY_ERROR" };
  }
}

/** Send the 6-digit reset code to a phone. */
export async function sendPasswordResetSms(
  phone: string,
  code: string
): Promise<SmsResult> {
  const provider = env.SMS_PROVIDER || "mock";
  if (provider === "kavenegar") return sendKavenegar(phone, code);
  return sendMock(phone, code);
}
