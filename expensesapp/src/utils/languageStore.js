import { types } from "mobx-state-tree";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  setCurrentLanguage,
} from "../i18n/i18n";

const LanguageStore = types
  .model({
    language: types.optional(types.string, DEFAULT_LANGUAGE),
  })
  .actions(self => ({
    setLanguage(language) {
      const next = isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE;
      setCurrentLanguage(next);
      self.language = next;
    },
  }));

export default LanguageStore;
