import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import CustomText from '../customText/customText';

export default function CustomCheckbox({
  label,
  checked,
  onToggle,
  containerStyles={}
}) {
  return (
    <TouchableOpacity
      style={{...customCheckboxStyles.container,...containerStyles}}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={[customCheckboxStyles.box, checked && customCheckboxStyles.checkedBox]}>
        {checked && <View style={customCheckboxStyles.innerBox} />}
      </View>

      {label && <CustomText 
        type='body5'
        style={customCheckboxStyles.label}
        text={label}
      />}
    </TouchableOpacity>
  );
}
const customCheckboxStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width:"100%"
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

