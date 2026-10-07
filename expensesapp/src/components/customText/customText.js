import React from 'react';
import { StyleSheet, Text } from 'react-native';
import getColors from '../../utils/color-picker';
import { useTheme } from '../../utils/themeContext';

const textStyle=(type)=>{

    if(type==="header1"){
        return {
            fontSize:46,
            fontWeight:"bold",
            //fontFamily:"todefine"
        }
    }else if(type==="header2"){
        return {
            fontSize:32,
            fontWeight:"bold",
            //fontFamily:"todefine"
        }
    }else if(type==="header3"){
        return {
            fontSize:24,
            fontWeight:"bold",
            //fontFamily:"todefine"
        }
    }else if(type==="header4"){
        return {
            fontSize:32,
            fontWeight:"thin",
            //fontFamily:"todefine"
        }
    }else if(type==="body1"){
        return {
            fontSize:16,
            fontWeight:"thin",
            //fontFamily:"todefine"
        }
    }else if(type==="body2"){
        return {
            fontSize:16,
            fontWeight:"bold",
            //fontFamily:"todefine"
        }
    }else if(type==="body3"){
        return {
            fontSize:20,
            fontWeight:"thin",
            //fontFamily:"todefine"
        }
    }else if(type==="body4"){
        return {
            fontSize:20,
            fontWeight:"bold",
            //fontFamily:"todefine"
        }
    }else if(type==="body5"){
        return {
            fontSize:14,
            fontWeight:"thin",
            //fontFamily:"todefine"
        }
    }else if(type==="body6"){
        return {
            fontSize:14,
            fontWeight:"bold",
            //fontFamily:"todefine"
        }
    }

}


const CustomText=({
  text="",
  type = 'header1',
  style,
})=>{
  useTheme();
  return (
    <Text
        style={[styles.text, textStyle(type), { color: getColors("textprimary") }, style]}
    >
        {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {},
});

export default CustomText;
