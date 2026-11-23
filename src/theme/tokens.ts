export const themeTokens = {
  colors: {
    appBackground: '#F7F6F8',
    surface: '#FFFFFF',
    softSurface: '#F0EFF4',
    primary: '#72759A',
    primaryDark: '#4F5278',
    primarySoft: '#E8E7F0',
    textPrimary: '#292A3A',
    textSecondary: '#737487',
    border: '#E5E3EA',
    success: '#32836A',
    warning: '#B78138',
    danger: '#B95E69',
    info: '#597C9D',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
};

export type ThemeTokens = typeof themeTokens;
