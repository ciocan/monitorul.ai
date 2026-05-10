import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-paper-96">
      <div className="mx-auto grid w-full max-w-(--breakpoint-2xl) gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <p className="label-mono text-ink-30">Monitorul.ai</p>
          <p className="text-sm leading-relaxed text-ink-30">
            Arhivă publică a Monitorului Oficial al României, Partea a II-a — stenogramele
            lucrărilor Parlamentului. Citabilă, durabilă, verificabilă.
          </p>
        </div>
        <div className="space-y-3">
          <p className="label-mono text-ink-30">Sursa</p>
          <ul className="space-y-1 text-sm text-ink-30">
            <li>
              <a
                href="https://monitoruloficial.ro"
                className="underline underline-offset-4 hover:text-ink-16"
                rel="noreferrer"
                target="_blank"
              >
                monitoruloficial.ro
              </a>
            </li>
            <li>
              <a
                href="https://www.cdep.ro"
                className="underline underline-offset-4 hover:text-ink-16"
                rel="noreferrer"
                target="_blank"
              >
                Camera Deputaților
              </a>
            </li>
            <li>
              <a
                href="https://www.senat.ro"
                className="underline underline-offset-4 hover:text-ink-16"
                rel="noreferrer"
                target="_blank"
              >
                Senatul României
              </a>
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <p className="label-mono text-ink-30">Metodologie</p>
          <ul className="space-y-1 text-sm text-ink-30">
            <li>
              <Link href="/despre" className="underline underline-offset-4 hover:text-ink-16">
                Cum extragem datele
              </Link>
            </li>
            <li>
              <Link
                href="/despre/discurs"
                className="underline underline-offset-4 hover:text-ink-16"
              >
                Analiza discursului
              </Link>
            </li>
            <li>
              <Link
                href="/despre#identitate"
                className="underline underline-offset-4 hover:text-ink-16"
              >
                Identitatea înregistrărilor
              </Link>
            </li>
            <li>
              <Link
                href="/despre#corectii"
                className="underline underline-offset-4 hover:text-ink-16"
              >
                Corecții și sesizări
              </Link>
            </li>
            <li>
              <Link href="/sustine" className="underline underline-offset-4 hover:text-ink-16">
                Sprijin operațional
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <p className="label-mono text-ink-30">Conținut public</p>
          <p className="text-sm text-ink-30">
            Stenogramele Monitorului Oficial sunt documente publice, reproduse aici verbatim.
            Permalink-urile rămân stabile între reindexări.
          </p>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="label-mono text-ink-45">
            Monitorul.ai · Arhivă publică · Conținut neoficial
          </p>
          <nav
            aria-label="Pagini legale și surse"
            className="label-mono flex flex-wrap gap-x-5 gap-y-2 text-ink-45"
          >
            <Link
              href="/confidentialitate"
              className="underline underline-offset-4 hover:text-ink-30"
            >
              Confidențialitate
            </Link>
            <Link href="/termeni" className="underline underline-offset-4 hover:text-ink-30">
              Termeni
            </Link>
            <a
              href="https://github.com/ciocan/monitorul-ii"
              className="underline underline-offset-4 hover:text-ink-30"
              rel="noreferrer"
              target="_blank"
            >
              Pipeline (AGPL-3.0)
            </a>
            <a
              href="https://github.com/ciocan/monitorul.ai"
              className="underline underline-offset-4 hover:text-ink-30"
              rel="noreferrer"
              target="_blank"
            >
              Site (AGPL-3.0)
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
