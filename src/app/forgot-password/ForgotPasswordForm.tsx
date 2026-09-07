"use client";

import Link from "next/link";
import { useState } from "react";
import { toLatinDigits } from "@/lib/digits";

const inputCls =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100";
const labelCls =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";

export default function ForgotPasswordForm(): JSX.Element {
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [account, setAccount] = useState({ tenantSlug: "", nationalId: "" });

  async function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDevCode(null);

    const fd = new FormData(e.currentTarget);
    const tenantSlug = toLatinDigits(String(fd.get("tenantSlug") ?? "").trim());
    const nationalId = toLatinDigits(String(fd.get("nationalId") ?? "").trim());
    const phone = toLatinDigits(String(fd.get("phone") ?? "").trim());

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, nationalId, phone }),
      });
      if (!res.ok) {
        setError("درخواست ناموفق بود؛ کمی بعد دوباره تلاش کنید.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { ok?: boolean; devCode?: string };
      if (data.devCode) setDevCode(data.devCode);
      setAccount({ tenantSlug, nationalId });
      setStep(2);
    } catch {
      setError("خطای برقراری ارتباط با سرور؛ دوباره تلاش کنید.");
    }
    setLoading(false);
  }

  async function resetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const code = toLatinDigits(String(fd.get("code") ?? "").trim());
    const newPassword = String(fd.get("newPassword") ?? "");
    const confirmPassword = String(fd.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setError("تکرار رمز عبور مطابقت ندارد.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: account.tenantSlug,
          nationalId: account.nationalId,
          code,
          newPassword,
        }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(
        data?.error
          ? "کد نامعتبر یا منقضی شده است؛ دوباره درخواست دهید."
          : "خطا در بازنشانی رمز؛ دوباره تلاش کنید."
      );
    } catch {
      setError("خطای برقراری ارتباط با سرور؛ دوباره تلاش کنید.");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-7 w-7"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          رمز عبور شما بازنشانی شد
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          حالا می‌توانید با رمز جدید وارد شوید.
        </p>
        <Link
          href="/login"
          className="mt-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
        >
          ورود به سامانه
        </Link>
      </div>
    );
  }

  if (step === 1) {
    // `key` forces a full remount when returning from step 2, so the DOM
    // inputs are fresh (uncontrolled inputs otherwise keep stale values).
    return (
      <form key="request-code" onSubmit={requestCode} className="flex flex-col gap-5">
        <div>
          <label htmlFor="fp-tenant" className={labelCls}>
            شناسه مرکز
          </label>
          <input
            id="fp-tenant"
            name="tenantSlug"
            type="text"
            required
            inputMode="numeric"
            autoComplete="off"
            maxLength={12}
            pattern="[0-9۰-۹٠-٩]{1,12}"
            placeholder="مثلاً ۱۰۰۱"
            className={`${inputCls} text-left`}
            dir="ltr"
          />
        </div>
        <div>
          <label htmlFor="fp-national" className={labelCls}>
            کد ملی
          </label>
          <input
            id="fp-national"
            name="nationalId"
            type="text"
            required
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            pattern="[0-9۰-۹٠-٩]{10}"
            placeholder="مثلاً ۱۲۳۴۵۶۷۸۹۱"
            className={`${inputCls} text-left`}
            dir="ltr"
          />
        </div>
        <div>
          <label htmlFor="fp-phone" className={labelCls}>
            شماره موبایل
          </label>
          <input
            id="fp-phone"
            name="phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            maxLength={15}
            pattern="[0-9۰-۹٠-٩\s-]{10,15}"
            placeholder="مثلاً ۰۹۱۲۳۴۵۶۷۸۹"
            className={`${inputCls} text-left`}
            dir="ltr"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-800 hover:shadow-md disabled:opacity-50"
        >
          {loading ? "در حال ارسال..." : "ارسال کد تأیید"}
        </button>
      </form>
    );
  }

  return (
    <form key="reset-password" onSubmit={resetPassword} className="flex flex-col gap-5">
      {devCode && (
        <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-3 text-xs text-gray-600 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-gray-300">
          <span className="font-semibold text-emerald-800 dark:text-emerald-400">
            کد آزمایشی (حالت توسعه):
          </span>{" "}
          <code className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-200">
            {devCode}
          </code>
        </div>
      )}
      <div>
        <label htmlFor="fp-code" className={labelCls}>
          کد تأیید
        </label>
        <input
          id="fp-code"
          name="code"
          type="text"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="[0-9۰-۹٠-٩]{6}"
          placeholder="کد ۶ رقمی"
          className={`${inputCls} text-center tracking-[0.4em]`}
          dir="ltr"
        />
      </div>
      <div>
        <label htmlFor="fp-newpass" className={labelCls}>
          رمز عبور جدید
        </label>
        <input
          id="fp-newpass"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="حداقل ۸ کاراکتر"
          className={inputCls}
          dir="ltr"
        />
      </div>
      <div>
        <label htmlFor="fp-confirm" className={labelCls}>
          تکرار رمز عبور جدید
        </label>
        <input
          id="fp-confirm"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="تکرار رمز عبور"
          className={inputCls}
          dir="ltr"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-800 hover:shadow-md disabled:opacity-50"
      >
        {loading ? "در حال بازنشانی..." : "بازنشانی رمز عبور"}
      </button>

      <button
        type="button"
        onClick={() => {
          setStep(1);
          setError(null);
          setDevCode(null);
        }}
        className="text-center text-xs text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        بازگشت و تغییر اطلاعات
      </button>
    </form>
  );
}
