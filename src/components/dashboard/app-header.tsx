import { t } from "@/lib/i18n";
import { useLanguage } from "@/lib/language-store";
import { EthioMark } from "./mark";
import { LanguageToggle } from "./language-toggle";
import { LiveClock } from "./live-clock";

export function AppHeader() {
  const lang = useLanguage((s) => s.lang);
  const c = t(lang);

  return (
    <header className="border-b border-border bg-bg/90 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-1.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="live-dot shrink-0" aria-hidden="true" />
          <p className="truncate font-mono text-micro tracking-mark text-muted uppercase">
            {c.classification}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="hidden font-mono text-micro tracking-mark text-muted uppercase sm:block">
            {c.region} · {c.capital}
          </p>
          <LiveClock />
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 lg:pr-28">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-elevated text-primary shadow-frame">
            <EthioMark className="size-7" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-micro tracking-mark-wide text-primary uppercase">{c.live}</p>
            <h1 className="text-xl font-medium leading-tight tracking-tight text-fg sm:text-2xl">
              {c.title}
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">{c.subtitle}</p>
          </div>
        </div>
        <LanguageToggle />
      </div>
    </header>
  );
}
