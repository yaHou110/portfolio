import Link from "next/link";
import PortfolioInteractive from "@/components/PortfolioInteractive";
import { ServiceCard, Step } from "@/components/PortfolioSection";

export default function HomePage(): JSX.Element {
  return (
    <main className="portfolio-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="صفحهٔ اصلی">
          <span className="brand-mark">M</span>
          <span><strong>YOUR NAME</strong><small>PRODUCT ENGINEER</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="ناوبری اصلی">
          <a href="#work">پروژه‌ها</a><a href="#services">خدمات</a><a href="#process">فرآیند</a><a href="#contact">تماس</a>
        </nav>
        <a className="header-cta" href="mailto:hello@example.com">شروع همکاری <span aria-hidden="true">↗</span></a>
        <PortfolioInteractive />
      </header>

      <section className="hero section-frame">
        <div className="hero-copy">
          <p className="eyebrow">توسعه‌دهندهٔ فول‌استک / فریلنسر</p>
          <h1>محصولات دیجیتال<br /><em>ساده، سریع، دقیق.</em></h1>
          <p className="hero-intro">من به کسب‌وکارها کمک می‌کنم ایده‌های پیچیده را به وب‌اپلیکیشن‌های قابل اعتماد و قابل استفاده تبدیل کنند.</p>
          <div className="hero-actions"><a className="button button-primary" href="#work">مشاهدهٔ پروژه‌ها <span>↗</span></a><a className="text-link" href="#contact">بیایید صحبت کنیم <span>←</span></a></div>
        </div>
        <div className="hero-aside" aria-label="معرفی کوتاه"><span className="aside-line" /><p>کدنویسی با تمرکز روی<br /><strong>حل مسئله، نه فقط اجرا.</strong></p><span className="aside-coordinate">35°41&apos;N / 51°23&apos;E</span></div>
      </section>

      <section className="stack-strip section-frame" aria-label="تکنولوژی‌ها"><span className="eyebrow">ابزارهایی که با آن‌ها می‌سازم</span><div className="stack-list"><span>Next.js</span><span>React</span><span>TypeScript</span><span>PostgreSQL</span><span>REST API</span></div></section>

      <section id="services" className="section-frame section-block"><div className="section-heading"><p className="eyebrow">خدمات / ۰۱</p><h2>از ایده تا محصول قابل استفاده.</h2><p>هر پروژه با یک مسئلهٔ واقعی شروع می‌شود. خروجی باید برای کاربر قابل فهم و برای تیم شما قابل توسعه باشد.</p></div><div className="services-grid"><ServiceCard icon="code" title="وب‌اپلیکیشن" text="رابط‌های سریع و responsive با تجربه‌ای دقیق در دسکتاپ و موبایل." /><ServiceCard icon="layers" title="داشبورد و پنل" text="تبدیل داده و فرآیندهای پیچیده به ابزارهای روشن و کاربردی." /><ServiceCard icon="server" title="Backend و API" text="ساخت API، مدل داده و زیرساختی که با رشد محصول کم نمی‌آورد." /></div></section>

      <section id="work" className="section-frame section-block work-section"><div className="section-heading inline-heading"><div><p className="eyebrow">پروژه‌ها / ۰۲</p><h2>چیزهایی که ساخته‌ام<br /><em>یا در حال ساختنشان هستم.</em></h2></div><p>نمونه‌کارها را بر اساس مسئله، تصمیم‌های فنی و نتیجهٔ قابل مشاهده معرفی می‌کنم؛ نه فقط یک اسکرین‌شات زیبا.</p></div><PortfolioInteractive showProjects /></section>

      <section id="process" className="section-frame section-block process-section"><div className="section-heading"><p className="eyebrow">فرآیند / ۰۳</p><h2>همکاری بدون ابهام.</h2></div><div className="process-list"><Step number="۰۱" title="شناخت مسئله" text="اهداف، محدودیت‌ها و کاربر اصلی را با هم روشن می‌کنیم." /><Step number="۰۲" title="طراحی مسیر" text="راه‌حل را به بخش‌های کوچک و قابل بررسی تقسیم می‌کنیم." /><Step number="۰۳" title="ساخت و تحویل" text="با بازخورد منظم می‌سازیم، تست می‌کنیم و مستند تحویل می‌دهیم." /></div></section>

      <section id="contact" className="contact-section section-frame"><div><p className="eyebrow">تماس / ۰۴</p><h2>یک ایده در ذهن دارید؟<br /><em>بیایید جدی‌اش کنیم.</em></h2></div><div className="contact-action"><p>برای پروژه‌های جدید در دسترس هستم. چند خط دربارهٔ مسئله‌تان بنویسید.</p><a className="button button-primary" href="mailto:hello@example.com">hello@example.com <span>↗</span></a></div></section>

      <footer className="site-footer section-frame"><span>© ۲۰۲۶ YOUR NAME</span><span>ساخته‌شده با Next.js و دقت زیاد</span><div><a href="#">GitHub</a><a href="#">LinkedIn</a></div></footer>
    </main>
  );
}
