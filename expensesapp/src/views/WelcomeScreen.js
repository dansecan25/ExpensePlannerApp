import React, { useState } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomTextInput from '../components/customTextInput/customTextInput';
import CustomText from '../components/customText/customText';
import { StyleSheet, Text, View } from "react-native";

const WelcomeScreen = ({ navigation }) => {
  const [typedValue, setTypedValue] = useState("");
  const [fixedSalary, setfixedSalary] = useState(true);
  const [variableSalary, setVariableSalary] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1,paddingHorizontal:18,marginTop:30}}>
      <View style={{ flex: 1 }}>
         <CustomText
            type="header2"
            text="Welcome! "
        />
         <CustomText
            type="header3"
            style={{marginBottom:40}}
            text="Please configure your experience before beginning "
        />
        <CustomText
            type="body3"
            text="Please select the income type you receive"
        />
        

        {fixedSalary===true ?
            <View> 
                <CustomText
                    type="body3"
                    text="Please enter your salary"
                    style={welcomeScreenStyles.text}
                />
                <CustomTextInput
                    value={typedValue}
                    setValue={setTypedValue}
                    placeholder="Salary"
                    keyboardType="numeric"
                />

                <CustomText
                    type="body4"
                    text={`Typed value: ${typedValue}`}
                />
                <CustomText
                    type="body4"
                    style={{...welcomeScreenStyles.text,marginBottom:0}}
                    text={`Select the salary deposit date from the options below`}
                />
                <CustomText
                    type="body5"
                    style={{...welcomeScreenStyles.text,marginTop:0,marginLeft:2}}
                    text={`*If fixed date is selected, select the date also from the dropdown`}
                />
            </View>:
            <View>


            </View>
        }
      </View>
    </SafeAreaView>
  );
};

const welcomeScreenStyles = StyleSheet.create({
    text:{
        marginVertical:10,
    }
})

export default WelcomeScreen;
