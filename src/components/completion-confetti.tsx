import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

const COLORS = ["#351cff", "#04befe", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#ffffff"];
const PARTICLES = Array.from({ length: 58 }, (_, index) => ({
  id: index,
  color: COLORS[index % COLORS.length],
  delay: `${(index % 12) * 0.045}s`,
  top: `${8 + ((index * 13) % 76)}%`,
  distance: 130 + ((index * 17) % 210),
  rotate: -220 + ((index * 31) % 440),
  size: 8 + (index % 5),
}));
const FIREWORKS = Array.from({ length: 4 }, (_, index) => ({
  id: index,
  delay: `${0.12 + index * 0.34}s`,
  top: `${18 + index * 18}%`,
  offset: `${20 + (index % 2) * 18}px`,
}));

export function CompletionConfetti({
  enabled,
  storageKey,
}: {
  enabled: boolean;
  storageKey: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const key = `startqa:completion-confetti:${storageKey}`;
    if (window.localStorage.getItem(key) === "shown") return;

    window.localStorage.setItem(key, "shown");
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, [enabled, storageKey]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 right-0 z-20 overflow-hidden">
      <ConfettiSide side="left" />
      <ConfettiSide side="right" />
    </div>
  );
}

function ConfettiSide({ side }: { side: "left" | "right" }) {
  const multiplier = side === "left" ? 1 : -1;

  return (
    <div className={`absolute inset-y-0 ${side === "left" ? "left-0" : "right-0"} w-[16vw]`}>
      {FIREWORKS.map((firework) => (
        <span
          key={`${side}-firework-${firework.id}`}
          className="absolute block h-28 w-28 animate-firework-burst rounded-full"
          style={{
            top: firework.top,
            left: side === "left" ? firework.offset : "auto",
            right: side === "right" ? firework.offset : "auto",
            animationDelay: firework.delay,
          }}
        />
      ))}
      <span
        className="absolute top-[44%] h-40 w-40 animate-confetti-flash rounded-full bg-primary/25 blur-2xl"
        style={{
          left: side === "left" ? "-40px" : "auto",
          right: side === "right" ? "-40px" : "auto",
        }}
      />
      {PARTICLES.map((particle) => (
        <span
          key={`${side}-${particle.id}`}
          className="absolute block animate-confetti-burst rounded-[2px]"
          style={
            {
              "--confetti-x": `${particle.distance * multiplier}px`,
              "--confetti-rotate": `${particle.rotate * multiplier}deg`,
              top: particle.top,
              left: side === "left" ? "18px" : "auto",
              right: side === "right" ? "18px" : "auto",
              width: `${particle.size}px`,
              height: `${particle.size * 1.7}px`,
              backgroundColor: particle.color,
              animationDelay: particle.delay,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
