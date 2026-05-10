"use client";

import { usePathname } from "next/navigation";

export function SiteSearchNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  if (pathname === "/") return <div className="ml-auto" />;
  return <div className="ml-auto max-w-md flex-1">{children}</div>;
}
