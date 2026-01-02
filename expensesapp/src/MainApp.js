import React, { useContext, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { getSalaryRow, initDatabase } from './utils/database_connector.js';
import { getColors } from './utils/color-picker.js';

import MenuScreens from './views/MenuScreens.js';
import WelcomeScreen from './views/WelcomeScreen.js';
import DeductionSetupScreen from './views/DeductionsSetup.js';
import TodayExpenseAddScreen from './views/TodayExpenseAdd.js';
import GeneralExpenseAddScreen from './views/GeneralExpenseAdd.js';
import { Context } from './utils/store.js';
import { observer } from 'mobx-react-lite';

const Stack = createNativeStackNavigator();

const MainApp = observer(() => {

  const {
    pullFromDB,
    salaryStore
  } = useContext(Context);

  const salary = salaryStore.amount;



  const [isLoading, setIsLoading] = useState(true);
  //const [salary, setSalary] = useState(null);

  useEffect(() => {
    const load = async () => {
      await initDatabase();
      await pullFromDB();
      setIsLoading(false);
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
          {({ navigation }) =>
            salary !== null
              ? <MenuScreens navigation={navigation} />
              : <WelcomeScreen navigation={navigation} />
          }
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
        <Stack.Screen name="Add today expense">
          {({ navigation }) => (
            <TodayExpenseAddScreen navigation={navigation} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Add general expense">
          {({ navigation }) => (
            <GeneralExpenseAddScreen navigation={navigation} />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
})

export default MainApp;