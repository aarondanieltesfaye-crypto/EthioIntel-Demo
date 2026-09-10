import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language-store";

export function LiveClock() {
  const lang = useLanguage((s) => s.lang);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const formatted = new Intl.DateTimeFormat(lang === "am" ? "am-ET" : "en-GB", {
    timeZone: "Africa/Addis_Ababa",
    calendar: "gregory",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  return (
    <time
      suppressHydrationWarning
      dateTime={now.toISOString()}
      className="font-mono text-2xs tabular-nums tracking-wide text-muted"
    >
      {formatted} EAT
    </time>
  );
}
