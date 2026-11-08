import { createContext, useContext } from "react";
import es from "./es";

export const DEFAULT_LANGUAGE = "en";
export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

let currentLanguage = DEFAULT_LANGUAGE;

export const isSupportedLanguage = language =>
  LANGUAGES.some(option => option.value === language);

export const getCurrentLanguage = () => currentLanguage;

export const setCurrentLanguage = language => {
  currentLanguage = isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE;
};

// English text is the key, so English needs no table and a missing Spanish
// entry falls back to readable text. {name} placeholders are filled from vars.
export const t = (text, vars) => {
  const template = currentLanguage === "es" ? es[text] ?? text : text;
  return vars
    ? template.replace(/\{(\w+)\}/g, (match, name) =>
        vars[name] === undefined || vars[name] === null
          ? match
          : String(vars[name]),
      )
    : template;
};

// The default account is stored as "Main account" and found by that name, so
// only its displayed label changes.
export const accountLabel = name =>
  String(name || "").trim().toLocaleLowerCase() === "main account"
    ? t("Main account")
    : name;

export const LanguageContext = createContext({ language: DEFAULT_LANGUAGE });

// Components showing text call this so a language change re-renders them.
export const useLanguage = () => useContext(LanguageContext);
