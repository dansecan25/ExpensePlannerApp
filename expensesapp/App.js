import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainApp from './src/MainApp';
import { StatusBar, useColorScheme } from 'react-native';
import { Context, storage } from './src/utils/store';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <Context.Provider value={storage}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <MainApp />
      </SafeAreaProvider>
    </Context.Provider>
  );
}