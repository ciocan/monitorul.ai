"use client";

import { ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SHOW_AFTER_PX = 600;

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      aria-label="Înapoi sus"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        })
      }
      className={cn(
        "fixed right-6 bottom-6 z-40 size-11 bg-paper-99 shadow-sm transition-opacity duration-200 hover:bg-paper-96",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ChevronUp className="size-5" />
    </Button>
  );
}
