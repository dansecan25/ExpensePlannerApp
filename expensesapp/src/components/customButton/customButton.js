import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
} from 'react-native';

export default function CustomButton({
  text,
  type = 'primary',
  icon = null,
  onPress,
  disabled = false,
  style = {},
  fontSize = 16, // 👈 NEW PROP
}) {
  const hasText = Boolean(text);
  const hasIcon = Boolean(icon);

  const containerStyles = [
    styles.base,
    styles[type],
    disabled && styles.disabled,
    !hasText && hasIcon && styles.iconOnly,
    style,
  ];

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {hasText && (
          <Text
            style={[
              styles.text,
              styles[`${type}Text`],
              { fontSize }, // 👈 APPLY HERE
            ]}
          >
            {text}
          </Text>
        )}

        {hasIcon && (
          <View style={hasText ? styles.iconRight : styles.iconCenter}>
            {icon}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Variants */
  primary: {
    backgroundColor: '#007AFF',
  },
  secondary: {
    backgroundColor: '#E5E5EA',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  warning: {
    backgroundColor: '#FF3B30',
  },

  /* Text colors */
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryText: {
    color: '#000000',
  },
  ghostText: {
    color: '#007AFF',
  },
  warningText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  /* Icon positioning */
  iconRight: {
    marginLeft: 8,
  },
  iconCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  iconOnly: {
    paddingHorizontal: 12,
  },

  disabled: {
    opacity: 0.5,
  },
});
