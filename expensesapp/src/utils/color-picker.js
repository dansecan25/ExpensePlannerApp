import { storage } from "./store";

const COLORS = {
  light: {
    background: '#80a9fcff',
    tile_background:"#4261a0ff",

    textprimary:"#ffffff",
    
  },

  dark: {
    background: '#212a3cff',
    tile_background:"#45577cff",


    textprimary:"#000000ff"
  },
};

export const getColors = (type) => {
  const isDark = storage.themeStore.systemIsDark;
  const theme = isDark ? COLORS.dark : COLORS.light;
  return theme[type] ?? "#FF00FF";
};

export default getColors;
