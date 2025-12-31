import React, { useContext, useState } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomTextInput from '../components/customTextInput/customTextInput';
import CustomText from '../components/customText/customText';
import CustomCheckbox from '../components/customCheckbox/customCheckbox.js';
import {dropdownStyles} from "../components/customDropdown/dropdownStylesCustom.js"
import CustomButton from "../components/customButton/customButton.js"
import { ScrollView, StyleSheet, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { insertOtherTaxes, insertSalaryDeductions } from "../utils/database_connector.js";
import { CommonActions } from "@react-navigation/native";
import { Context } from "../utils/store.js";

const DeductionSetupScreen = ({ navigation }) => {
  const {pullFromDB}=useContext(Context);
  const [salaryRanges, setSalaryRanges] = useState([
    { range: "918000-1347000", percentage: "10" },
    { range: "1347000-2364000", percentage: "15" },
    { range: "2364000-4727000", percentage: "20" },
    { range: "4727000", percentage: "25" },
    ]);

    const [otherTaxes, setOtherTaxes] = useState([
        { name: "CCSS", percentage: "10" },
    ]);
    const addSalaryRange = () => {
        setSalaryRanges([...salaryRanges, { range: "", percentage: "" }]);
    };

    const addOtherTax = () => {
        setOtherTaxes([...otherTaxes, { name: "", percentage: "" }]);
    };
    const removeSalaryRange = () => {
        if (salaryRanges.length > 1) {
            setSalaryRanges(salaryRanges.slice(0, -1));
        }
    };

    const removeOtherTax = () => {
        if (otherTaxes.length > 1) {
            setOtherTaxes(otherTaxes.slice(0, -1));
        }
    };


    const parseSalaryRanges = (salaryRanges) => {
        return salaryRanges.map(({ range, percentage }) => {
            const parts = range.split("-");

            const min_salary = parseFloat(parts[0]);
            const max_salary =
            parts.length > 1 && parts[1] !== ""
                ? parseFloat(parts[1])
                : null;

            return {
            min_salary,
            max_salary,
            percentage: parseFloat(percentage),
            };
        });
    };
    const parseOtherTaxes = (otherTaxes) => {
        return otherTaxes.map(({ name, percentage }) => ({
            name,
            percentage: parseFloat(percentage),
        }));
    };




    const renderSalaryRangeRow = (item, index) => (
        <View key={index} style={styles.row}>
            <CustomTextInput
                placeholder="Salary range"
                value={item.range}
                setValue={(val) => {
                    const updated = [...salaryRanges];
                    updated[index].range = val;
                    setSalaryRanges(updated);
                }}
                style={{ flex: 1, marginRight: 8 }}
            />

            <CustomTextInput
                placeholder="%"
                keyboardType="numeric"
                value={item.percentage}
                setValue={(val) => {
                    const updated = [...salaryRanges];
                    updated[index].percentage = val;
                    setSalaryRanges(updated);
                }}
                style={{ width: 80 }}
            />

            {index === salaryRanges.length - 1 && (
                <CustomButton
                    text="+"
                    type="ghost"
                    onPress={addSalaryRange}
                />
            )}
        </View>
    );
    const renderOtherTaxRow = (item, index) => (
        <View key={index} style={styles.row}>
            <CustomTextInput
                placeholder="Tax name"
                value={item.name}
                setValue={(val) => {
                    const updated = [...otherTaxes];
                    updated[index].name = val;
                    setOtherTaxes(updated);
                }}
                style={{ flex: 1, marginRight: 8 }}
            />

            <CustomTextInput
                placeholder="%"
                keyboardType="numeric"
                value={item.percentage}
                setValue={(val) => {
                    const updated = [...otherTaxes];
                    updated[index].percentage = val;
                    setOtherTaxes(updated);
                }}
                style={{ width: 80 }}
            />

            {index === otherTaxes.length - 1 && (
                <CustomButton
                    text="+"
                    type="ghost"
                    onPress={addOtherTax}
                />
            )}

        </View>
    );





  return (
    <SafeAreaView style={{ flex: 1, paddingHorizontal: 18, marginTop: 30 }}>
        <ScrollView
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.sectionHeader}>
                <CustomText type="header3" text="Salary deductions" style={{width:"60%",paddingRight:0}} />

                <CustomButton
                    text="-"
                    type="ghost"
                    style={styles.removeButton}
                    onPress={removeSalaryRange}
                    disabled={salaryRanges.length <= 1}
                />
            </View>


            {salaryRanges.map(renderSalaryRangeRow)}

            <View style={[styles.sectionHeader, { marginTop: 30 }]}>
                <CustomText type="header3" text="Other taxes" style={{width:"40%",paddingRight:0}}/>

                <CustomButton
                    text="-"
                    type="ghost"
                    style={styles.removeButton}
                    onPress={removeOtherTax}
                    disabled={otherTaxes.length <= 1}
                />
            </View>


            {otherTaxes.map(renderOtherTaxRow)}
            <CustomButton
                type="primary"
                text="Save deductions"
                style={{ marginTop: 40 }}
                onPress={async () => {
                    const parsedSalaryRanges = parseSalaryRanges(salaryRanges);
                    const parsedOtherTaxes = parseOtherTaxes(otherTaxes);
                    
                    try {
                        

                        await insertSalaryDeductions(parsedSalaryRanges);
                        await insertOtherTaxes(parsedOtherTaxes);

                        
                        await pullFromDB();

                        navigation.dispatch(
                        CommonActions.reset({
                            index: 0,
                            routes: [{ name: "Home" }],
                        })
                        );


                        } catch (err) {
                            console.error("Failed to save deductions", err);
                        }
                }}

            />


        </ScrollView>
    </SafeAreaView>

  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  removeButton: {
    borderColor: "#FF3B30",
  },
});



export default DeductionSetupScreen;
