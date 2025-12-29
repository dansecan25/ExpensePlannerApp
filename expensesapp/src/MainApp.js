import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {initDatabase} from './utils/database_connector.js'
import { getColors } from './utils/color-picker.js';

import HomeScreen from './views/MainScreen.js';
import WelcomeScreen from './views/WelcomeScreen.js'
import DeductionSetupScreen from './views/DeductionsSetup.js'

const Stack = createNativeStackNavigator();

export default function MainApp() {

  useEffect(() => {
    initDatabase().catch(console.error);
  }, []);

  const view=2;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: getColors('background'),
          },
        }}
      >
        <Stack.Screen 
          name="Home"
        >
          {({ navigation }) => { 
            //check, if salary is not null, show home screen, if its null, show welcome screen
            
            if(view===1){
              return (<HomeScreen navigation={navigation} />);
            }else{
              return (<WelcomeScreen navigation={navigation}/>)
            }
            
            }}
        </Stack.Screen>
        <Stack.Screen 
          name="Welcome Screen"
        >
          {({ navigation }) => <WelcomeScreen navigation={navigation} />}
        </Stack.Screen>
        <Stack.Screen 
          name="Taxes config"
        >
          {({ navigation }) => <DeductionSetupScreen navigation={navigation} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
