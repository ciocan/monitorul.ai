"use client";

import { useLinkStatus } from "next/link";

import { cn } from "@/lib/utils";

// Inline pending hint placed inside the desktop / mobile nav <Link>s.
// `useLinkStatus` flips `pending` to true when navigation has been initiated
// but the destination route's RSC payload hasn't arrived yet — exactly the
// gap that loading.tsx covers on the destination side. The dot stays
// invisible until that pending state, then fades in 100ms later (so fast,
// prefetched navigations skip the hint entirely). Styles + keyframes live
// on `.nav-status-dot` in globals.css.
//
// MUST be a descendant of <Link>; useLinkStatus throws elsewhere.

export function NavStatusDot() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={cn("nav-status-dot", pending && "is-pending")} />;
}
