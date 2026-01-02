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

const GeneralExpenseAddScreen = ({ navigation }) => {


  return (
    <SafeAreaView style={{ flex: 1, paddingHorizontal: 18, marginTop: 30 }}>
        <ScrollView
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
        >
                <CustomText type="header3" text="In what did you spend money?" style={{width:"60%",paddingRight:0}} />

            <CustomButton
                type="primary"
                text="Add deductions"
                style={{ marginTop: 40 }}
                onPress={async () => {
                    try {

                        navigation.goBack();


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




export default GeneralExpenseAddScreen;