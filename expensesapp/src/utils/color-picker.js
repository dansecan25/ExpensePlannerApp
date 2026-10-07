import { storage } from "./store";

export const COLORS = {
  light: {
    background: "#80a9fcff",
    tile_background: "#4261a0ff",
    textprimary: "#ffffff",
    secondaryText: "#263650",
    surface: "#ffffff",
    input: "#ffffff",
    border: "#c7d0df",
    placeholder: "#68758a",
    accent: "#4261a0",
    selected: "#e7efff",
  },
  dark: {
    background: "#212a3cff",
    tile_background: "#45577cff",
    textprimary: "#ffffff",
    secondaryText: "#c2ccdc",
    surface: "#303c52",
    input: "#263247",
    border: "#58677f",
    placeholder: "#aab6c8",
    accent: "#8bb0ff",
    selected: "#405575",
  },
};

export const getColors = type => {
  const { mode, systemIsDark } = storage.themeStore;
  const isDark = mode === "system" ? systemIsDark : mode === "dark";
  const theme = isDark ? COLORS.dark : COLORS.light;
  return theme[type] ?? theme.textprimary;
};

export default getColors;
