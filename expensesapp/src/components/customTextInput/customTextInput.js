import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { getColors } from '../../utils/color-picker';
import { useTheme } from '../../utils/themeContext';

const CustomTextInput=({
  value,
  setValue,
  placeholder = '',
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  style,
})=>{
  useTheme();
  return (
    <TextInput
      value={value}
      placeholder={placeholder}
      placeholderTextColor={getColors("placeholder")}
      onChangeText={(text) => setValue(text)}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      style={[
        styles.input,
        {
          backgroundColor: getColors("input"),
          borderColor: getColors("border"),
          color: getColors("secondaryText"),
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    width: '100%',
    height:48,
    borderWidth: 2,
    paddingHorizontal:15,
    borderRadius: 8,
    fontSize: 16,
  },
});

export default CustomTextInput;
