import React from 'react';
import { View, Text, Button, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import getColors from '../utils/color-picker';

export default function MainScreen({ navigation }) {



  return (
    <SafeAreaView style={styles.container}>
        <View>
            <Text 
                style={styles.headerText}
            >Expenses app v1.0.0</Text>
            <TextInput
            
            >
                
            </TextInput>

            <TouchableOpacity
                style={{
                    backgroundColor:'white',
                    height:"50%",
                    width:"100%",
                    
                }}
                onPress={()=>{

                }}
            >   
            <Text>
                Click here for magic
                </Text>
            </TouchableOpacity>
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
