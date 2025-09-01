import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'react-native';

// Screens
import DeviceListScreen from './src/screens/DeviceListScreen';
import DeviceControlScreen from './src/screens/DeviceControlScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      <Stack.Navigator
        initialRouteName="DeviceList"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1a1a1a',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          cardStyle: { backgroundColor: '#121212' },
        }}
      >
        <Stack.Screen
          name="DeviceList"
          component={DeviceListScreen}
          options={{ title: 'Veo Dongle' }}
        />
        <Stack.Screen
          name="DeviceControl"
          component={DeviceControlScreen}
          options={({ route }) => ({ title: route.params?.deviceName || 'Device Control' })}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
