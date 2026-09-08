"use client";

import { useEffect, useMemo, useState } from "react";

type Project = {
  title: string;
  description: string;
  category: string;
  tags: string[];
  status: string;
};

const projects: Project[] = [
  { title: "Edge Query Engine", description: "موتور کوئری سبک برای Edge با کش هوشمند و تایپ‌سیف کلاینت. کاهش ۴۰٪ latency در p95.", category: "سیستم", tags: ["Cloudflare Workers", "TypeScript", "Rust WASM"], status: "Project A — 2024" },
  { title: "Design System CLI", description: "ابزار CLI برای تولید توکن، مستندسازی خودکار و چک بصری کامپوننت‌ها در CI.", category: "ابزار", tags: ["CLI", "AST", "Playwright"], status: "Project B — 2023" },
  { title: "Realtime Collab Canvas", description: "بوم همکاری با CRDT، حضور زنده و تاریخچهٔ قابل پخش برای تیم‌های دیزاین فنی.", category: "محصول", tags: ["Yjs", "WebGL", "WebSocket"], status: "Project C — 2024" },
];

const filters = ["همه", "سیستم", "ابزار", "محصول"];

export default function PortfolioInteractive({ showProjects = false }: { showProjects?: boolean }): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("همه");
  const [activeSection, setActiveSection] = useState("home");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loaded, setLoaded] = useState(false);
  const visibleProjects = useMemo(() => filter === "همه" ? projects : projects.filter((project) => project.category === filter), [filter]);
  const sections = [["home", "خانه"], ["work", "پروژه‌ها"], ["services", "خدمات"], ["process", "فرآیند"], ["contact", "تماس"]];

  useEffect(() => {
    const timer = window.setTimeout(() => setLoaded(true), 600);
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && setActiveSection(entry.target.id)), { rootMargin: "-25% 0px -65%" });
    ["home", "work", "services", "process", "contact"].forEach((id) => { const element = document.getElementById(id); if (element) observer.observe(element); });
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, []);

  const scrollTo = (id: string) => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };

  return (
    <>
      <div className={`site-loader ${loaded ? "is-done" : ""}`} aria-hidden="true"><div className="loader-inner"><span>YH / 2026</span><strong>LOADING SYSTEM <b>{loaded ? "100" : "084"}%</b></strong><i /></div></div>
      <header className="builder-header">
        <div className="builder-nav-shell">
          <button className="builder-logo" onClick={() => scrollTo("home")} aria-label="صفحهٔ اصلی"><span>Y</span><strong>YAHOU<small>PRODUCT / SOFTWARE</small></strong></button>
          <nav className="builder-nav" aria-label="ناوبری اصلی">{sections.map(([id, label]) => <button key={id} className={activeSection === id ? "is-active" : ""} onClick={() => scrollTo(id)}>{label}</button>)}</nav>
          <div className="header-tools"><span className="availability"><i /> برای پروژه‌های منتخب باز هستم</span><button className="contact-pill" onClick={() => scrollTo("contact")}>شروع همکاری <span>↗</span></button><button className="menu-toggle" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? "بستن" : "منو"}</button></div>
          {menuOpen && <nav className="mobile-nav" aria-label="ناوبری موبایل">{sections.map(([id, label]) => <button key={id} onClick={() => scrollTo(id)}>{label}<span>↗</span></button>)}</nav>}
        </div>
      </header>
      {showProjects && <><div className="filter-row" role="tablist" aria-label="فیلتر پروژه‌ها">{filters.map((item) => <button key={item} type="button" role="tab" aria-selected={filter === item} className={filter === item ? "filter-chip is-active" : "filter-chip"} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="projects-grid">{visibleProjects.map((project, index) => <button type="button" className={`project-card project-card-${index + 1}`} key={project.title} onClick={() => setSelectedProject(project)}><div className="project-card-top"><span className="eyebrow">{project.status}</span><span className="project-number">0{index + 1}</span></div><h3>{project.title}</h3><p>{project.description}</p><div className="tag-list">{project.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><span className="project-link">جزئیات پروژه <span aria-hidden="true">↗</span></span></button>)}</div></>}
      {selectedProject && <div className="project-modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title"><div className="modal-card"><button className="modal-close" onClick={() => setSelectedProject(null)} aria-label="بستن" type="button">×</button><div className="eyebrow">PROJECT DETAIL / {selectedProject.status}</div><h2 id="project-modal-title">{selectedProject.title}</h2><p>{selectedProject.description}</p><div className="modal-metrics"><span><b>Impact</b> قابل اندازه‌گیری</span><span><b>Stack</b> {selectedProject.tags.join(" · ")}</span></div><button className="button button-primary" onClick={() => setSelectedProject(null)}>بستن جزئیات <span>↗</span></button></div></div>}
    </>
  );
}
