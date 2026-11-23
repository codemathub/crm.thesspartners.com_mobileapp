import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { themeTokens } from '../../theme/tokens';

export interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={themeTokens.colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    fontSize: 13,
    color: themeTokens.colors.textSecondary,
    fontWeight: '500',
  },
});
