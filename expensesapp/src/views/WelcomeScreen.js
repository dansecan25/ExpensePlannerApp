import React, { useContext, useState } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomTextInput from '../components/customTextInput/customTextInput';
import CustomText from '../components/customText/customText';
import CustomCheckbox from '../components/customCheckbox/customCheckbox.js';
import {dropdownStyles} from "../components/customDropdown/dropdownStylesCustom.js"
import CustomButton from "../components/customButton/customButton.js"
import { StyleSheet, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { addSalary } from "../utils/database_connector.js";
import {Context} from "../utils/store.js"

const WelcomeScreen = ({ navigation }) => {
    const {
        salaryStore:{
            setSalaryModel,
        }
    }=useContext(Context);


  const [typedValue, setTypedValue] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [fixedSalary, setfixedSalary] = useState(true);
  const [payDate, setPayDate]=useState("");
  const [currency, setCurrency]=useState("");
  const [payDay, setPayDay] = useState(1);

  const payDateOptions=[
    {label:"Last day of month"},
    {label:"Pre last day of month"},
    {label:"Quincenal"},
    {label:"Fixed date"}
  ]
  const payDayOptions = Array.from({ length: 31 }, (_, i) => ({
        label: String(i + 1),
        value: i + 1,
    }));

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
            text="Please enter a starting balance"
            style={welcomeScreenStyles.text}
        />
        <CustomTextInput
            value={startingBalance}
            setValue={setStartingBalance}
            placeholder="Balance"
            keyboardType="numeric"
        />
        <CustomText
            type="body3"
            text="Please select the income type you receive"
        />
        <View style={welcomeScreenStyles.checkboxRow}>
            <CustomCheckbox
                label="Fixed"
                containerStyles={{width:"50%"}}
                checked={fixedSalary}
                onToggle={() => setfixedSalary(true)}
            />

            <CustomCheckbox
                label="Variable"
                containerStyles={{width:"50%"}}
                checked={!fixedSalary}
                onToggle={() => setfixedSalary(false)}
            />
        </View>

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
                    type="body3"
                    text="Please enter your currency"
                    style={welcomeScreenStyles.text}
                />
                <CustomTextInput
                    value={currency}
                    setValue={setCurrency}
                    placeholder="Currency (CRC,USD,$,etc)"
                />

                <CustomText
                    type="body4"
                    style={{...welcomeScreenStyles.text,marginBottom:0,marginTop:10}}
                    text={`Select the salary deposit date from the options below`}
                />
                <CustomText
                    type="body5"
                    style={{...welcomeScreenStyles.text,marginTop:0,marginLeft:2}}
                    text={`*If fixed date is selected, select the date also from the dropdown`}
                />
                <View>
                    <Dropdown
                    data={payDateOptions}
                    value={payDate}
                    placeholder="Select a pay date"

                    labelField="label"
                    valueField="label"

                    onChange={(item) => {
                        setPayDate(item.label);
                    }}

                    style={dropdownStyles.input}
                    dropdownStyle={dropdownStyles.dropdown}
                    itemContainerStyle={dropdownStyles.itemContainer}
                    itemTextStyle={dropdownStyles.itemText}
                    placeholderStyle={dropdownStyles.placeholderText}
                    selectedTextStyle={dropdownStyles.selectedText}

                    maxHeight={200} 
                    />
                </View>
                {payDate === "Fixed date" && (
                <View>
                    <CustomText
                    type="body4"
                    style={{ ...welcomeScreenStyles.text, marginBottom: 0 }}
                    text="Select the day of the month your salary is deposited"
                    />

                    <Dropdown
                    data={payDayOptions}
                    value={payDay}
                    placeholder="Select a day"

                    labelField="label"
                    valueField="value"

                    onChange={(item) => {
                        setPayDay(item.value);
                    }}

                    style={dropdownStyles.input}
                    dropdownStyle={dropdownStyles.dropdown}
                    itemContainerStyle={dropdownStyles.itemContainer}
                    itemTextStyle={dropdownStyles.itemText}
                    placeholderStyle={dropdownStyles.placeholderText}
                    selectedTextStyle={dropdownStyles.selectedText}

                    maxHeight={200}
                    />
                </View>
                )}

                <View style={{marginTop:40}}>
                    <CustomButton
                        text="Set options"
                        onPress={async ()=>{
                            await addSalary({
                                amount: parseFloat(typedValue),
                                balance: parseFloat(startingBalance),
                                currency: currency,
                                fixed: fixedSalary,
                                deposits_date: payDate,
                                fixed_day: parseInt(payDay),
                            });
                            navigation.navigate("Taxes config");
                        }}
                        disabled={typedValue.length<=0 || currency.length<=0 || payDate==="" || 
                            (payDate==="Fixed date"? payDay==="" : false) || startingBalance.length<=0
                        }
                    />
                </View>

            </View>:
            <View>
                <CustomText
                    type="body3"
                    text="Do you want to set an estimated amount per month?"
                    style={welcomeScreenStyles.text}
                />
                <CustomTextInput
                    value={typedValue}
                    setValue={setTypedValue}
                    placeholder="Salary"
                    keyboardType="numeric"
                />
                <View style={{marginTop:40}}>
                    <CustomButton
                        text={typedValue.length===0 ? "Set salary later" : "Set variable salary"}
                        onPress={()=>{
                            console.log("Testing values to be stored on db:")
                            console.log(payDate)
                            console.log(typedValue)
                            console.log(currency)
                        }}
                        disabled={startingBalance.length<=0}
                        
                    />
                </View>


            </View>
        }
      </View>
    </SafeAreaView>
  );
};

const welcomeScreenStyles = StyleSheet.create({
    text:{
        marginVertical:10,
    },
    checkboxRow: {
        flexDirection: 'row',
        marginVertical:20,
        marginBottom:15
    },
})

export default WelcomeScreen;
