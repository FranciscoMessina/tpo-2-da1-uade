import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import ProfileScreen from './screens/ProfileScreen';
import PublicProfileScreen from './screens/PublicProfileScreen';

const Stack = createNativeStackNavigator();

function PublicProfileRoute({ route }) {
  return <PublicProfileScreen usuario={route.params.usuario} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />

      <NavigationContainer>
        <SafeAreaView
          edges={['left', 'right', 'bottom']}
          style={{ flex: 1, backgroundColor: '#F3F4F6' }}
        >
          <Stack.Navigator initialRouteName="Perfil">
            <Stack.Screen
              name="Perfil"
              component={ProfileScreen}
              options={{ title: 'Mi perfil' }}
            />

            <Stack.Screen
              name="PerfilPublico"
              component={PublicProfileRoute}
              options={{ title: 'Perfil público' }}
            />
          </Stack.Navigator>
        </SafeAreaView>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}