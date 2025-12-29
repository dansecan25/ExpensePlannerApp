import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { getSalaryRow, initDatabase } from './utils/database_connector.js';
import { getColors } from './utils/color-picker.js';

import HomeScreen from './views/MainScreen.js';
import WelcomeScreen from './views/WelcomeScreen.js';
import DeductionSetupScreen from './views/DeductionsSetup.js';

const Stack = createNativeStackNavigator();

export default function MainApp() {
  const [isLoading, setIsLoading] = useState(true);
  const [salary, setSalary] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        await initDatabase();
        const result = await getSalaryRow(); // returns row or null
        setSalary(result);
        console.log(result)
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  if (isLoading) {
    return null; // or splash screen
  }

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
        <Stack.Screen name="Home">
          {({ navigation }) => {
            
            if (salary) {
              return <HomeScreen navigation={navigation} />;
            }
            return <WelcomeScreen navigation={navigation} />;
          }}
        </Stack.Screen>

        <Stack.Screen name="Welcome Screen">
          {({ navigation }) => (
            <WelcomeScreen navigation={navigation} />
          )}
        </Stack.Screen>

        <Stack.Screen name="Taxes config">
          {({ navigation }) => (
            <DeductionSetupScreen navigation={navigation} />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
