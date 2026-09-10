import { create } from "zustand";

export type Lang = "en" | "am";

type LanguageState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  hydrate: () => void;
};

const STORAGE_KEY = "ethiointel-lang";

export const useLanguage = create<LanguageState>((set) => ({
  lang: "en",
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore quota / private mode */
    }
    set({ lang });
  },
  hydrate: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "am" || stored === "en") set({ lang: stored });
    } catch {
      /* ignore */
    }
  },
}));
