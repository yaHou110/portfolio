import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Format a date in the Jalali (Persian) calendar. Node ships full ICU,
 * so the native formatter is exact — no hand-rolled conversion to drift. */
function formatJalali(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** The four pillars of family participation. */
const ACTIVITIES = [
  {
    title: "پویش‌ها",
    desc: "همراهی با پویش‌های فرهنگی و تربیتی",
    meta: "۳ پویش فعال",
    icon: <Icon.Target className="h-6 w-6" />,
    accent: "from-emerald-500 to-emerald-700",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  {
    title: "مسابقات",
    desc: "مسابقات کتاب‌خوانی، حفظ و هنری",
    meta: "۲ مسابقه در جریان",
    icon: <Icon.Trophy className="h-6 w-6" />,
    accent: "from-amber-500 to-amber-600",
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  {
    title: "برنامه‌ها",
    desc: "برنامه‌های آموزشی و تربیتی خانواده",
    meta: "۵ برنامهٔ این ماه",
    icon: <Icon.Calendar className="h-6 w-6" />,
    accent: "from-sky-500 to-sky-700",
    chip: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
  {
    title: "اردوها",
    desc: "اردوهای زیارتی، تفریحی و فرهنگی",
    meta: "۱ اردوی پیش رو",
    icon: <Icon.Bus className="h-6 w-6" />,
    accent: "from-violet-500 to-violet-700",
    chip: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
];

/** Suggested programs — the community's current highlights. */
const SUGGESTED = [
  {
    title: "جشنواره فرهنگی خانواده",
    desc: "گردهمایی فرهنگی ویژهٔ خانواده‌های حوزوی با بخش کودک و نوجوان",
    icon: <Icon.Swatch className="h-5 w-5" />,
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  },
  {
    title: "مسابقه کتاب‌خوانی",
    desc: "مطالعهٔ کتاب‌های منتخب تربیتی و معرفتی ویژهٔ همهٔ اعضای خانواده",
    icon: <Icon.BookOpen className="h-5 w-5" />,
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  {
    title: "اردوی زیارتی ـ تفریحی",
    desc: "اردوی یک‌روزه با برنامه‌های خانوادگی، بازی و زیارت",
    icon: <Icon.MapPin className="h-5 w-5" />,
    chip: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
];

/** Latest announcements. */
const ANNOUNCEMENTS = [
  {
    title: "ثبت‌نام «پویش نذر کتاب» ویژهٔ کودکان و نوجوانان آغاز شد",
    fresh: true,
  },
  {
    title: "مسابقهٔ حفظ و مفاهیم سورهٔ مبارکهٔ یس — ویژهٔ نوجوانان",
    fresh: true,
  },
  {
    title: "اردوی زیارتی ـ تفریحی خانواده‌ها — ظرفیت محدود",
    fresh: false,
  },
  {
    title: "جشنوارهٔ فرهنگی خانوادهٔ حوزوی — برنامه‌های پیش رو",
    fresh: false,
  },
];

/** Secondary categories — quick orientation to the full identity. */
const CATEGORIES = [
  { label: "رویدادها", icon: <Icon.Clock className="h-4 w-4" /> },
  { label: "فعالیت‌های خانوادگی", icon: <Icon.Squares2X2 className="h-4 w-4" /> },
  { label: "افتخارات و دستاوردها", icon: <Icon.Star className="h-4 w-4" /> },
  { label: "خدمات و طرح‌ها", icon: <Icon.Gift className="h-4 w-4" /> },
  { label: "اعضای خانواده", icon: <Icon.Users className="h-4 w-4" /> },
  { label: "مشارکت‌ها", icon: <Icon.CheckCircle className="h-4 w-4" /> },
];

export default async function DashboardPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { name, role } = session.user;

  return (
    <AppShell user={{ name: name ?? "", role }}>
      {/* ── Greeting ────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-sm font-medium text-emerald-700">{formatJalali(new Date())}</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
          سلام، {name} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          امروز چه کاری را تجربه می‌کنی؟
        </p>
      </div>

      {/* ── Activity pillars ────────────────────────────────────── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIVITIES.map((a) => (
          <div
            key={a.title}
            className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
          >
            <div
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${a.accent}`}
              aria-hidden="true"
            />
            <div className="flex items-start justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${a.chip}`}>
                {a.icon}
              </div>
              <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                {a.meta}
              </span>
            </div>
            <div className="mt-4 text-base font-bold text-gray-900 dark:text-gray-100">
              {a.title}
            </div>
            <div className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
              {a.desc}
            </div>
          </div>
        ))}
      </div>

      {/* ── Suggested programs ──────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
          <Icon.Sparkles className="h-5 w-5 text-emerald-700" />
          برنامه‌های پیشنهادی
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {SUGGESTED.map((p) => (
            <div
              key={p.title}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-emerald-700"
            >
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${p.chip}`}>
                {p.icon}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-emerald-800">
                {p.title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* ── Announcements ──────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
            <Icon.Bell className="h-5 w-5 text-emerald-700" />
            اطلاعیه‌های جدید
          </h2>
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            {ANNOUNCEMENTS.map((n) => (
              <div key={n.title} className="flex items-start gap-3 p-4">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    n.fresh ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <p className="text-sm leading-6 text-gray-800 dark:text-gray-200">{n.title}</p>
                  {n.fresh ? (
                    <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      جدید
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Category map ───────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
            <Icon.Users className="h-5 w-5 text-emerald-700" />
            دنیای خانواده‌های حوزوی
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CATEGORIES.map((c) => (
              <div
                key={c.label}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-emerald-700"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:group-hover:bg-emerald-900/50">
                  {c.icon}
                </span>
                <span className="text-[11px] font-medium leading-4 text-gray-600 dark:text-gray-300">
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
