"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // Check initial state
    setIsLight(document.documentElement.classList.contains("light-theme"));
  }, []);

  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const x = event.clientX;
    const y = event.clientY;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const nextLight = !isLight;

    // Fallback for browsers that don't support View Transitions API
    if (!(document as any).startViewTransition) {
      document.documentElement.classList.toggle("light-theme");
      setIsLight(nextLight);
      return;
    }

    const transition = (document as any).startViewTransition(() => {
      document.documentElement.classList.toggle("light-theme");
      setIsLight(nextLight);
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`
      ];

      document.documentElement.animate(
        {
          clipPath: clipPath,
        },
        {
          duration: 600,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-6 right-6 z-[9999] p-3 rounded-full glass hover:bg-[rgb(var(--bg-overlay))] transition-colors cursor-pointer flex items-center justify-center"
      aria-label="Toggle Theme"
    >
      {isLight ? (
        <Moon size={22} className="text-[rgb(var(--text-primary))]" />
      ) : (
        <Sun size={22} className="text-[rgb(var(--text-primary))]" />
      )}
    </button>
  );
}
