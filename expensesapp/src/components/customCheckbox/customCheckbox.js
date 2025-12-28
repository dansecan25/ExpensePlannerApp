import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function CustomCheckbox({
  label,
  checked,
  onToggle,
}) {
  return (
    <TouchableOpacity
      style={customCheckboxStyles.container}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[styles.box, checked && customCheckboxStyles.checkedBox]}>
        {checked && <View style={customCheckboxStyles.innerBox} />}
      </View>

      {label && <Text style={customCheckboxStyles.label}>{label}</Text>}
    </TouchableOpacity>
  );
}
const customCheckboxStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#555',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    borderColor: '#007AFF',
  },
  innerBox: {
    width: 12,
    height: 12,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  label: {
    marginLeft: 10,
    fontSize: 16,
  },
});

