

const COLORS = {
  light: {
    background: '#80a9fcff',
    surface: '#F2F2F2',
    primary: '#2563EB',
    secondary: '#64748B',
    text: '#111827',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    success: '#16A34A',
    warning: '#F59E0B',
    error: '#DC2626',
  },

  dark: {
    background: '#000000',
    surface: '#121212',
    primary: '#3B82F6',
    secondary: '#94A3B8',
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    border: '#1F2933',
    success: '#22C55E',
    warning: '#FBBF24',
    error: '#EF4444',
  },
};

export const getColors = (type, theme = 'light') => {
  const selectedTheme = COLORS[theme] || COLORS.light;
  return selectedTheme[type] || '#FF00FF'; // fallback (debug pink)
};

export default getColors;