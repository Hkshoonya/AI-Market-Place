"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggle = () => {
      setVisible(window.scrollY > 500);
    };
    window.addEventListener("scroll", toggle, { passive: true });
    return () => window.removeEventListener("scroll", toggle);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-card/90 shadow-lg backdrop-blur-sm transition-all hover:border-neon/50 hover:text-neon"
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
