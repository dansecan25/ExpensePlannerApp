import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainApp from './src/MainApp';
import { StatusBar, useColorScheme } from 'react-native';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <MainApp />
    </SafeAreaProvider>
  );
}