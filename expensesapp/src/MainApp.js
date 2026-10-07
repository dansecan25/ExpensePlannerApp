import React, { useCallback, useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { initDatabase } from './utils/database_connector.js';
import { getColors } from './utils/color-picker.js';

import MenuScreens from './views/MenuScreens.js';
import WelcomeScreen from './views/WelcomeScreen.js';
import DeductionSetupScreen from './views/DeductionsSetup.js';
import TodayExpenseAddScreen from './views/TodayExpenseAdd.js';
import GeneralExpenseAddScreen from './views/GeneralExpenseAdd.js';
import { Context } from './utils/store.js';
import { observer } from 'mobx-react-lite';
import { ThemeContext } from './utils/themeContext.js';

const Stack = createNativeStackNavigator();

const MainApp = observer(() => {

  const {
    pullFromDB,
    salaryStore,
    themeStore,
    setThemeOnStore,
  } = useContext(Context);

  const { setupComplete, profileExists } = salaryStore;
  const systemColorScheme = useColorScheme();
  const isDark =
    themeStore.mode === 'system'
      ? themeStore.systemIsDark
      : themeStore.mode === 'dark';

  useEffect(() => {
    setThemeOnStore(systemColorScheme === 'dark');
  }, [setThemeOnStore, systemColorScheme]);



  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      await initDatabase();
      await pullFromDB();
    } catch (error) {
      console.error('Failed to initialize finance database:', error);
      setLoadError(error instanceof Error ? error.message : 'Unknown database error.');
    } finally {
      setIsLoading(false);
    }
  }, [pullFromDB]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return null;
  }

  if (loadError) {
    return (
      <View style={[styles.errorScreen, { backgroundColor: getColors('background') }]}>
        <Text style={styles.errorTitle}>Could not open your planner</Text>
        <Text style={styles.errorMessage}>{loadError}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={load} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ThemeContext.Provider value={{ isDark }}>
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
            setupComplete ? (
              <MenuScreens navigation={navigation} />
            ) : profileExists ? (
              <DeductionSetupScreen navigation={navigation} />
            ) : (
              <WelcomeScreen navigation={navigation} />
            )
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
    </ThemeContext.Provider>
  );
})

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  errorMessage: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 12,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MainApp;