"use client";

import { useMemo, useState } from "react";

type Project = {
  title: string;
  description: string;
  category: string;
  tags: string[];
  status: string;
};

const projects: Project[] = [
  {
    title: "Atlas Commerce",
    description: "یک تجربهٔ commerce سریع و دقیق برای تبدیل ایدهٔ محصول به مسیر خریدی قابل اعتماد.",
    category: "محصول",
    tags: ["Next.js", "TypeScript", "Performance"],
    status: "نمونهٔ منتخب",
  },
  {
    title: "Operations Dashboard",
    description: "داشبورد مدیریتی برای تبدیل داده‌های پراکنده به تصمیم‌های قابل پیگیری.",
    category: "داشبورد",
    tags: ["React", "API", "Accessibility"],
    status: "Case study بعدی",
  },
  {
    title: "SaaS Starter System",
    description: "ساختار اولیهٔ یک محصول SaaS؛ از مدل داده و نقش‌ها تا مسیرهای اصلی کاربر.",
    category: "SaaS",
    tags: ["Next.js", "Auth", "REST API"],
    status: "قابل توسعه",
  },
];

const filters = ["همه", "محصول", "داشبورد", "SaaS"];

export default function PortfolioInteractive({ showProjects = false }: { showProjects?: boolean }): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("همه");
  const visibleProjects = useMemo(
    () => (filter === "همه" ? projects : projects.filter((project) => project.category === filter)),
    [filter],
  );

  return (
    <>
      <button
        type="button"
        aria-expanded={menuOpen}
        aria-controls="mobile-nav"
        className="menu-toggle"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? "بستن" : "منو"}
      </button>

      <div id="mobile-nav" className={`mobile-nav ${menuOpen ? "is-open" : ""}`}>
        <a href="#work" onClick={() => setMenuOpen(false)}>پروژه‌ها</a>
        <a href="#services" onClick={() => setMenuOpen(false)}>خدمات</a>
        <a href="#process" onClick={() => setMenuOpen(false)}>فرآیند</a>
        <a href="#contact" onClick={() => setMenuOpen(false)}>تماس</a>
      </div>

      {showProjects && <div className="filter-row" role="tablist" aria-label="فیلتر پروژه‌ها">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={filter === item}
            className={filter === item ? "filter-chip is-active" : "filter-chip"}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>}

      {showProjects && <div className="projects-grid">
        {visibleProjects.map((project, index) => (
          <article className={`project-card project-card-${index + 1}`} key={project.title}>
            <div className="project-card-top">
              <span className="eyebrow">{project.status}</span>
              <span className="project-number">0{index + 1}</span>
            </div>
            <h3>{project.title}</h3>
            <p>{project.description}</p>
            <div className="tag-list">
              {project.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <span className="project-link">جزئیات پروژه <span aria-hidden="true">↗</span></span>
          </article>
        ))}
      </div>}
    </>
  );
}
