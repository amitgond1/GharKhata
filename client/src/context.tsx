import { createContext, useContext } from 'react';
import en from './locales/en.json';
import hi from './locales/hi.json';
export type TranslationKey = keyof typeof en;
export const UiContext = createContext({
  lang: 'en',
  setLang: (_lang: string) => {},
  dark: false,
  setDark: (_dark: boolean) => {},
  toast: (_message: string, _error?: boolean) => {},
});
export function useUi() {
  const ctx = useContext(UiContext);
  return { ...ctx, t: (key: TranslationKey) => (ctx.lang === 'hi' ? hi : en)[key] || en[key] };
}
