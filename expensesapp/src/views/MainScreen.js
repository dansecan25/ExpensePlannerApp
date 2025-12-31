import React, { useContext } from 'react';
import { View, Text, Button, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import getColors from '../utils/color-picker';
import CustomText from '../components/customText/customText';
import CustomButton from '../components/customButton/customButton';
import { resetDatabase } from '../utils/database_connector';
import { CommonActions } from '@react-navigation/native';
import { Context } from '../utils/store';

export default function MainScreen({ navigation }) {
    const {
        salaryStore:{
            amount,
            clear,
        }
    }=useContext(Context);

  return (
    <SafeAreaView style={styles.container}>
        <View>
            <CustomText
                type='header1'
                text={`Expenses App v1.0.0`}
            />
            <CustomText
                type='header3'
                text={`Your salary is: ${amount} `}
            />
            <CustomButton
                text="Restar databases"
                onPress={async ()=>{
                    await resetDatabase();
                    clear(),
                    navigation.dispatch(
                        CommonActions.reset({
                        index: 0,
                        routes: [{ name: "Home" }],
                        })
                    );
                }}
            />
            
        </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container:{
        flex:1,
        marginHorizontal:15,
    },
    headerText:{
        fontSize:20,
        color:getColors("header-01")
    }
});
