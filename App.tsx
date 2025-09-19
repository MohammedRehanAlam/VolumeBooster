/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View, Platform } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import setNavigationBarColor from 'react-native-navigation-bar-color';
import { useEffect } from 'react';

interface Theme {
  background: string;
  statusBar: string;
  navigationBar: string;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  
  // Define theme colors
  const theme = {
    dark: {
      background: '#000000',
      statusBar: '#000000',
      navigationBar: '#000000',
    },
    light: {
      background: '#ffffff',
      statusBar: '#ffffff',
      navigationBar: '#ffffff',
    },
  };
  
  const currentTheme = isDarkMode ? theme.dark : theme.light;

  // Set navigation bar color for Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      setNavigationBarColor(currentTheme.navigationBar, !isDarkMode);
    }
  }, [isDarkMode, currentTheme.navigationBar]);

  return (
    <SafeAreaProvider>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={currentTheme.statusBar}
        translucent={false}
      />
      <AppContent theme={currentTheme} />
    </SafeAreaProvider>
  );
}

function AppContent({ theme }: { theme: Theme }) {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <NewAppScreen
        templateFileName="App.tsx"
        safeAreaInsets={safeAreaInsets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
