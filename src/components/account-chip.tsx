import Link from "next/link";
import { headers } from "next/headers";

import { signOutAction } from "@/app/cont/actions";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

// Server-component chip for the masthead. Reads the session via Better
// Auth's `auth.api.getSession` (which is the canonical pattern in App
// Router server contexts; see `better-auth/docs/faq` — it MUST go through
// `auth.api.*` rather than `authClient.*` because cookies live in the
// request headers, not on `document.cookie`).
//
// Two states:
//   - Anonymous → uppercase mono "Intră" link to /cont/intra. Doubles as
//     the entry-point a curious visitor sees when they read about the MCP.
//   - Signed in → uppercase mono "Cont" trigger that opens a dropdown
//     with the user's email + a sign-out form-button. Hits `/cont` for the
//     full account page.
export async function AccountChip({ className }: { className?: string }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return (
      <Link
        href="/cont/intra"
        className={cn("label-mono text-ink-30 transition-colors hover:text-ink-16", className)}
      >
        Intră
      </Link>
    );
  }

  const initial = (session.user.name?.[0] ?? session.user.email?.[0] ?? "·").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "label-mono inline-flex items-center gap-2 text-ink-30 transition-colors hover:text-ink-16",
          className,
        )}
      >
        <span className="grid h-5 w-5 place-items-center rounded-none bg-ink-16 text-[0.625rem] text-paper-99">
          {initial}
        </span>
        Cont
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-ink-45">
          <span className="block truncate font-mono text-ink-30">{session.user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/cont">Asistenți conectați</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={signOutAction} className="w-full">
            <button type="submit" className="w-full text-left">
              Deconectează-te
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
