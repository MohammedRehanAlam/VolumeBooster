/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar, StyleSheet, useColorScheme, View, Platform } from 'react-native';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import setNavigationBarColor from 'react-native-navigation-bar-color';
import { useEffect } from 'react';
import { VolumeBooster } from './src';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  // Set navigation bar color for Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      setNavigationBarColor(isDarkMode ? '#000000' : '#FFFFFF', !isDarkMode);
    }
  }, [isDarkMode]);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent={true}
      />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  return (
    <View style={styles.container}>
      <VolumeBooster />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
