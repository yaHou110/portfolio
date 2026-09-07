type IconName = "code" | "layers" | "server" | "arrow";

function Icon({ name }: { name: IconName }): JSX.Element {
  if (name === "arrow") return <span aria-hidden="true">↗</span>;
  if (name === "code") return <span className="service-icon" aria-hidden="true">&lt;/&gt;</span>;
  if (name === "layers") return <span className="service-icon" aria-hidden="true">[]</span>;
  return <span className="service-icon" aria-hidden="true">_›</span>;
}

export function ServiceCard({ icon, title, text }: { icon: IconName; title: string; text: string }): JSX.Element {
  return (
    <article className="service-card">
      <Icon name={icon} />
      <h3>{title}</h3>
      <p>{text}</p>
      <span className="service-arrow"><Icon name="arrow" /></span>
    </article>
  );
}

export function Step({ number, title, text }: { number: string; title: string; text: string }): JSX.Element {
  return (
    <div className="process-step">
      <span className="step-number">{number}</span>
      <div><h3>{title}</h3><p>{text}</p></div>
    </div>
  );
}
