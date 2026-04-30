import AnimatedBorderCard from "./AnimatedBorderCard";

const joinClasses = (...classNames) => classNames.filter(Boolean).join(" ");

export default function WelcomeCard({ children, className = "", contentClassName = "" }) {
  return (
    <AnimatedBorderCard
      className={joinClasses("welcome-card-frame", className)}
      contentClassName={joinClasses("welcome-card", contentClassName)}
      variant="welcome"
    >
      {children}
    </AnimatedBorderCard>
  );
}
