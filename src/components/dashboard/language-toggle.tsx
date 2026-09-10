import { useEffect } from "react";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/lib/language-store";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const lang = useLanguage((s) => s.lang);
  const setLang = useLanguage((s) => s.setLang);
  const c = t(lang);

  return (
    <div
      className="inline-flex h-11 items-center rounded-md bg-elevated p-1 shadow-frame"
      role="group"
      aria-label={c.language}
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={cn(
          "min-w-11 rounded-sm px-3 py-1.5 font-mono text-xs font-medium tracking-wide transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.96]",
          lang === "en" ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
        )}
      >
        {c.english}
      </button>
      <button
        type="button"
        onClick={() => setLang("am")}
        aria-pressed={lang === "am"}
        className={cn(
          "min-w-11 rounded-sm px-3 py-1.5 font-mono text-xs font-medium tracking-wide transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.96]",
          lang === "am" ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
        )}
      >
        {c.amharic}
      </button>
    </div>
  );
}

export function LanguageSync() {
  const lang = useLanguage((s) => s.lang);
  const hydrate = useLanguage((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.lang = lang === "am" ? "am" : "en";
    document.documentElement.dataset.lang = lang;
  }, [lang]);

  return null;
}
