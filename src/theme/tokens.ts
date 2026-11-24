export const themeTokens = {
  colors: {
    appBackground: '#F8FAFC', // Crisp Slate Canvas (Light Theme)
    surface: '#FFFFFF',       // Pure White Card Surfaces
    softSurface: '#F1F5F9',   // Light Slate Surface Tint
    primary: '#2563EB',       // Electric Sapphire Blue (The 'G' - Active Brand)
    primaryDark: '#1D4ED8',   // Deep Sapphire Blue (Primary CTAs & Icons)
    primarySoft: '#EFF6FF',   // Soft Sapphire Tint (Active Tab Pills)
    accentGold: '#D97706',    // Imperial Amber Gold (The '2' - VIP & Deals)
    accentGoldSoft: '#FEF3C7',// Warm Gold Tint (Badges & Highlights)
    midnightNavy: '#020912',  // Luxury Midnight Navy (Logo & Splash Anchor)
    textPrimary: '#0F172A',   // High-Contrast Obsidian Slate
    textSecondary: '#64748B', // Clean Secondary Slate
    border: '#E2E8F0',        // Subtle Hairline Slate Divider
    success: '#16A34A',       // Forest Emerald (Completed & Today)
    warning: '#D97706',       // Amber Warning
    danger: '#DC2626',        // Alert Rose Red
    info: '#0284C7',          // Sky Info
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
