import React from 'react';
import { View, Text, Button, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import getColors from '../utils/color-picker';
import CustomText from '../components/customText/customText';
import CustomButton from '../components/customButton/customButton';
import { resetDatabase } from '../utils/database_connector';

export default function MainScreen({ navigation }) {



  return (
    <SafeAreaView style={styles.container}>
        <View>
            <CustomText
                type='header1'
                text={`Expenses App v1.0.0`}
            />
            <CustomText
                type='header3'
                text={`Your salary is: `}
            />
            <CustomButton
                text="Restar databases"
                onPress={async ()=>{
                    await resetDatabase();
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
