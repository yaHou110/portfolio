"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import Link from "next/link";
import { toLatinDigits } from "@/lib/digits";
import { safeCallbackUrl } from "@/lib/redirect";

export default function LoginForm(): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    let result;
    try {
      result = await signIn("credentials", {
        tenantSlug: toLatinDigits(String(formData.get("tenantSlug") ?? "").trim()),
        nationalId: toLatinDigits(String(formData.get("nationalId") ?? "").trim()),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });
    } catch {
      // Network/server failure — never leave the button stuck loading.
      setError("خطای برقراری ارتباط با سرور؛ دوباره تلاش کنید.");
      setLoading(false);
      return;
    }

    if (result?.error) {
      setError("نام کاربری یا رمز عبور اشتباه است.");
      setLoading(false);
      return;
    }

    // Middleware preserves the originally requested path in callbackUrl.
    // Resolve it against the current origin to keep redirects same-origin.
    const rawCallbackUrl = new URLSearchParams(window.location.search).get(
      "callbackUrl",
    );
    router.push(
      rawCallbackUrl
        ? safeCallbackUrl(rawCallbackUrl, window.location.origin)
        : "/dashboard",
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {/* Tenant */}
      <div>
        <label
          htmlFor="tenantSlug"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          شناسه مرکز
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
              />
            </svg>
          </span>
          <input
            id="tenantSlug"
            name="tenantSlug"
            type="text"
            required
            aria-describedby="tenant-help"
            inputMode="numeric"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore=""
            data-form-type="other"
            maxLength={12}
            pattern="[0-9۰-۹٠-٩]{1,12}"
            title="شناسه مرکز باید عدد باشد"
            placeholder="مثلاً ۱۰۰۱"
            className="pl-4 pr-10"
            dir="ltr"
          />
        </div>
        <p id="tenant-help" className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          شناسهٔ عددی مرکز را وارد کنید.
        </p>
      </div>

      {/* National ID */}
      <div>
        <label
          htmlFor="nationalId"
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          کد ملی
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"
              />
            </svg>
          </span>
          <input
            id="nationalId"
            name="nationalId"
            type="text"
            required
            aria-describedby="national-id-help"
            inputMode="numeric"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore=""
            data-form-type="other"
            maxLength={10}
            pattern="[0-9۰-۹٠-٩]{10}"
            title="کد ملی باید ۱۰ رقم باشد"
            placeholder="مثلاً ۱۲۳۴۵۶۷۸۹۱"
            className="pl-4 pr-10"
            dir="ltr"
          />
        </div>
        <p id="national-id-help" className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          کد ملی ۱۰ رقمی، بدون خط تیره.
        </p>
      </div>

      {/* Password */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            رمز عبور
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            فراموشی رمز عبور؟
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            data-lpignore="true"
            data-1p-ignore=""
            data-form-type="other"
            placeholder="••••••••"
            className="pr-12 pl-4"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "مخفی کردن رمز" : "نمایش رمز"}
            aria-pressed={showPassword}
            aria-controls="password"
            title={showPassword ? "مخفی کردن رمز" : "نمایش رمز"}
            className="absolute inset-y-1 right-1 z-10 flex w-9 !p-0 items-center justify-center rounded-lg border border-gray-200/70 bg-gray-50/90 text-gray-500 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 dark:border-gray-600/70 dark:bg-gray-800/90 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error && (
        <p
          id="login-error"
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            className="h-4 w-4 shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        aria-describedby={error ? "login-error" : undefined}
        className="mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-800 hover:shadow-md disabled:opacity-50"
      >
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            در حال ورود...
          </>
        ) : (
          "ورود به سامانه"
        )}
      </button>
    </form>
  );
}
