import React from 'react';
import { TextInput, StyleSheet } from 'react-native';

const CustomTextInput=({
  value,
  setValue,
  placeholder = '',
  keyboardType = 'default',
  style,
})=>{
  return (
    <TextInput
      value={value}
      placeholder={placeholder}
      placeholderTextColor={"#a8a8a8ff"}
      onChangeText={(text) => setValue(text)}
      style={[styles.input, style]}
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
    backgroundColor:"#ffffff",
    borderColor: '#ccc',
    fontSize: 16,
  },
});

export default CustomTextInput;
