const joinClasses = (...classNames) => classNames.filter(Boolean).join(" ");

export default function AnimatedBorderCard({
  children,
  className = "",
  contentClassName = "",
  variant = "default",
}) {
  return (
    <div className={joinClasses("animated-border-card", `animated-border-card--${variant}`, className)}>
      <div className={joinClasses("animated-border-card__inner", contentClassName)}>{children}</div>
    </div>
  );
}
