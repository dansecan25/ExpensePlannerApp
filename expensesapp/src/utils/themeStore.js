import { types } from "mobx-state-tree";

const ThemeStore = types
  .model({
    mode: types.optional(types.string, "system"),
    systemIsDark: types.optional(types.boolean,false),
  })
  .actions(self => ({
    setSystemTheme(isDark) {
      self.systemIsDark = isDark;
    },
    setMode(mode) {
      if (["system", "light", "dark"].includes(mode)) {
        self.mode = mode;
      }
    },
  }));

export default ThemeStore;
