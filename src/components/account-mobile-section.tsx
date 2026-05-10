import Link from "next/link";
import { headers } from "next/headers";

import { signOutAction } from "@/app/cont/actions";
import { auth } from "@/lib/auth";

// Mobile-only counterpart to `AccountChip`. The desktop chip lives in the
// masthead (hidden on small screens); the mobile equivalent lives at the
// bottom of `SiteNavMobile`'s full-screen panel, so the account surface
// stays reachable from every viewport without crowding the cramped phone
// masthead. Renders nothing on the desktop tree — the parent applies its
// own visibility, this component just supplies the markup.
//
// Server component because session lookup happens through `auth.api.*` with
// request headers; the surrounding `SiteNavMobile` is `'use client'` (it
// owns the open/close state) but server children compose into client
// components fine.
export async function AccountMobileSection() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return (
      <div className="border-t border-border px-6 py-6">
        <p className="label-mono text-ink-45">Cont</p>
        <Link
          href="/cont/intra"
          className="label-mono mt-3 inline-flex text-[1.125rem] text-ink-16 transition-colors hover:text-ink-30"
        >
          Intră
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-border px-6 py-6">
      <p className="label-mono text-ink-45">Cont</p>
      <p className="mt-2 truncate font-mono text-sm text-ink-30">{session.user.email}</p>
      <div className="mt-4 flex flex-col gap-4">
        <Link
          href="/cont"
          className="label-mono inline-flex text-[1.125rem] text-ink-16 transition-colors hover:text-ink-30"
        >
          Asistenți conectați
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="label-mono inline-flex text-[1.125rem] text-ink-30 transition-colors hover:text-ink-16"
          >
            Deconectează-te
          </button>
        </form>
      </div>
    </div>
  );
}
