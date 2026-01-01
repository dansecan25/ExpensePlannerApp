import { types } from "mobx-state-tree";

const ThemeStore = types
  .model({
    mode: types.optional(types.string,"light"),
    systemIsDark: types.optional(types.boolean,false),
  })
  .actions(self => ({
    setSystemTheme(isDark) {
      self.systemIsDark = isDark;
    },
    setMode(mode) {
      self.mode = mode; // "system" | "light" | "dark"
    },
  }));

export default ThemeStore;
