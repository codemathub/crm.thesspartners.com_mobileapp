import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { themeTokens } from '../../theme/tokens';

export interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  style,
}) => {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'success':
        return { bg: '#E4F3ED', text: themeTokens.colors.success };
      case 'warning':
        return { bg: '#FDF3E7', text: themeTokens.colors.warning };
      case 'danger':
        return { bg: '#FCECEE', text: themeTokens.colors.danger };
      case 'info':
        return { bg: '#EAF0F6', text: themeTokens.colors.info };
      case 'primary':
        return { bg: themeTokens.colors.primarySoft, text: themeTokens.colors.primaryDark };
      case 'neutral':
      default:
        return { bg: themeTokens.colors.softSurface, text: themeTokens.colors.textSecondary };
    }
  };

  const current = getBadgeStyle();

  return (
    <View style={[styles.badge, { backgroundColor: current.bg }, style]}>
      <Text style={[styles.text, { color: current.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
