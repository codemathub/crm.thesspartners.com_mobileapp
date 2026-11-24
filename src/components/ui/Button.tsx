import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { themeTokens } from '../../theme/tokens';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'soft' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return styles.primaryBtn;
      case 'secondary':
        return styles.secondaryBtn;
      case 'outline':
        return styles.outlineBtn;
      case 'danger':
        return styles.dangerBtn;
      case 'soft':
        return styles.softBtn;
      case 'gold':
        return styles.goldBtn;
      default:
        return styles.primaryBtn;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'primary':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'danger':
        return styles.dangerText;
      case 'soft':
        return styles.softText;
      case 'gold':
        return styles.goldText;
      default:
        return styles.primaryText;
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'md':
        return styles.sizeMd;
      case 'lg':
        return styles.sizeLg;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        getVariantStyle(),
        getSizeStyle(),
        (disabled || loading) && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : themeTokens.colors.primaryDark}
        />
      ) : (
        <>
          {icon ? <>{icon}</> : null}
          <Text style={[styles.baseText, getTextStyle(), textStyle]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: themeTokens.borderRadius.md,
    gap: 8,
  },
  sizeSm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  sizeMd: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sizeLg: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  primaryBtn: {
    backgroundColor: themeTokens.colors.primaryDark,
    borderRadius: 10,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: themeTokens.colors.primary,
    borderRadius: 10,
  },
  secondaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  goldBtn: {
    backgroundColor: themeTokens.colors.accentGold,
    borderRadius: 10,
  },
  goldText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  outlineBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: themeTokens.colors.border,
    borderRadius: 10,
  },
  outlineText: {
    color: themeTokens.colors.textPrimary,
    fontWeight: '600',
  },
  dangerBtn: {
    backgroundColor: themeTokens.colors.danger,
    borderRadius: 10,
  },
  dangerText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  softBtn: {
    backgroundColor: themeTokens.colors.primarySoft,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
  },
  softText: {
    color: themeTokens.colors.primaryDark,
    fontWeight: '700',
  },
  baseText: {
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
});
