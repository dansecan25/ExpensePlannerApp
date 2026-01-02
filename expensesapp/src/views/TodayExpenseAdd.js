import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";

import CustomTextInput from "../components/customTextInput/customTextInput";
import CustomText from "../components/customText/customText";
import CustomButton from "../components/customButton/customButton";

import { dropdownStyles } from "../components/customDropdown/dropdownStylesCustom";
import {
  getAccountsCreated,
  getAllTags,
  insertExpense,
} from "../utils/database_connector";
import CustomCheckbox from "../components/customCheckbox/customCheckbox";

const TodayExpenseAddScreen = ({ navigation }) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [tags, setTags] = useState([]);

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);

  const [inflated,setInflated]=useState(false);
  const [inflatedAmount,setInflatedAmount]=useState("");

  useEffect(() => {
    const loadData = async () => {
      const accountsFromDb = await getAccountsCreated();
      const tagsFromDb = await getAllTags();

      setAccounts(
        accountsFromDb.map(a => ({
          label: a.name,
          value: a.id,
        }))
      );

      setTags(
        tagsFromDb.map(t => ({
          label: t.name,
          value: t.id,
        }))
      );
    };

    loadData();
  }, []);

  const handleSave = async () => {
    const todayISO = new Date().toISOString();

    await insertExpense(
      name,
      parseFloat(amount),
      inflatedAmount === ""? amount:inflatedAmount,
      selectedTag ? [selectedTag] : [],
      selectedAccount,
      todayISO,
      description
    );
    navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, paddingHorizontal: 18, marginTop: 30 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <CustomText
          type="header2"
          text="In what did you spend money today?"
          style={{ marginBottom: 20 }}
        />

        {/* NAME */}
        <View style={styles.row}>
          <CustomText style={styles.label} text="Name" type="body4" />
          <CustomTextInput
            style={styles.input}
            placeholder="What was it?"
            value={name}
            setValue={setName}
          />
        </View>

        {/* AMOUNT */}
        <View style={styles.row}>
          <CustomText style={styles.label} text="Amount" type="body4" />
          <CustomTextInput
            style={styles.input}
            placeholder="How much?"
            keyboardType="numeric"
            value={amount}
            setValue={setAmount}
          />
        </View>
        <View style={styles.row}>
          <CustomText style={styles.label} text="Want to inflated the value?" type="body4" />
          <CustomCheckbox
                label="Inflate"
                containerStyles={{width:"50%"}}
                checked={inflated}
                onToggle={() => {
                    if(inflated===false){
                        setInflated(true)
                    }else{
                        setInflated(false);
                    }
                }}
            />
        </View>
        {inflated && 
        <View style={styles.row}>
          <CustomText style={styles.label} text="Inflated amount" type="body4" />
          <CustomTextInput
            style={styles.input}
            placeholder="How much?"
            keyboardType="numeric"
            value={inflatedAmount}
            setValue={setInflatedAmount}
          />
        </View>
        
        
        }
        

        {/* DESCRIPTION */}
        <View style={styles.row}>
          <CustomText style={styles.label} text="Description" type="body4" />
          <CustomTextInput
            style={styles.input}
            placeholder="Extra info (optional)"
            value={description}
            setValue={setDescription}
          />
        </View>

        {/* ACCOUNT */}
        <View style={styles.row}>
          <CustomText
            style={styles.label}
            text="Account (optional)"
            type="body4"
          />
          <Dropdown
            style={[dropdownStyles.dropdown, styles.dropdown]}
            data={accounts}
            labelField="label"
            valueField="value"
            placeholder="Select account"
            value={selectedAccount}
            onChange={item => setSelectedAccount(item.value)}
          />
        </View>

        {/* TAG */}
        <View style={styles.row}>
          <CustomText
            style={styles.label}
            text="Tag (optional)"
            type="body4"
          />
          <Dropdown
            style={[dropdownStyles.dropdown, styles.dropdown]}
            data={tags}
            labelField="label"
            valueField="value"
            placeholder="Select tag"
            value={selectedTag}
            onChange={item => setSelectedTag(item.value)}
          />
        </View>

        <CustomButton
          type="primary"
          text="Add expense"
          style={{ marginTop: 40 }}
          onPress={handleSave}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  label: {
    width: "30%",
  },
  input: {
    width: "68%",
    marginLeft: 5,
  },
  dropdown: {
    width: "68%",
    height:48,
    padding:16,
    marginLeft: 5,
  },
});

export default TodayExpenseAddScreen;
