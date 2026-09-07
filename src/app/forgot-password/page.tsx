import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Icon } from "@/components/icons";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

/**
 * بازیابی رمز عبور — کد تأیید به شمارهٔ موبایل ثبت‌شده پیامک می‌شود.
 */
export default function ForgotPasswordPage(): JSX.Element {
  return (
    <main
      dir="rtl"
      lang="fa"
      className="relative flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-gray-950"
    >
      <div className="absolute top-5 left-5">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Identity */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm">
            <Icon.Mosque className="h-6 w-6" />
          </div>
          <div className="text-right">
            <div className="text-base font-bold text-gray-900 dark:text-gray-100">
              رویش
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              سامانه فرهنگی، تربیتی حوزه و خانواده
            </div>
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
          بازیابی رمز عبور
        </h1>
        <p className="mt-2 text-center text-sm leading-6 text-gray-500 dark:text-gray-400">
          با وارد کردن شناسهٔ مرکز، کد ملی و شمارهٔ موبایل، کد تأیید برای شما
          پیامک می‌شود.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <ForgotPasswordForm />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <Link
            href="/login"
            className="font-medium text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            بازگشت به صفحهٔ ورود
          </Link>
        </p>
      </div>
    </main>
  );
}
