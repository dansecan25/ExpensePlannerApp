import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, useColorScheme } from 'react-native';
import MainApp from './src/MainApp';
import { Context, storage } from './src/utils/store';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    storage.themeStore.setSystemTheme(isDarkMode);
  }, [isDarkMode]);

  return (
    <Context.Provider value={storage}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <MainApp />
      </SafeAreaProvider>
    </Context.Provider>
  );
}
