type WorkspaceSectionNavItem = {
  href: string;
  label: string;
  meta?: string;
};

type WorkspaceSectionNavProps = {
  items: WorkspaceSectionNavItem[];
  label?: string;
  className?: string;
};

export function WorkspaceSectionNav({
  items,
  label = "Navegação rápida",
  className,
}: WorkspaceSectionNavProps) {
  if (!items.length) {
    return null;
  }

  return (
    <nav
      className={["workspace-section-nav", className].filter(Boolean).join(" ")}
      aria-label={label}
    >
      <span className="workspace-section-nav__label">{label}</span>
      <div className="workspace-section-nav__links">
        {items.map((item) => (
          <a key={`${item.href}-${item.label}`} href={item.href} className="workspace-section-nav__link">
            <strong>{item.label}</strong>
            {item.meta ? <span>{item.meta}</span> : null}
          </a>
        ))}
      </div>
    </nav>
  );
}
