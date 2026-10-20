import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import ProfileScreen from './screens/ProfileScreen';
import PublicProfileScreen from './screens/PublicProfileScreen';
import GestionPublicacionScreen from './screens/GestionPublicacionScreen';
import SearchScreen from './screens/SearchScreen';
import SearchResultsScreen from './screens/SearchResultsScreen';
import { SearchProvider } from './context/SearchContext';

const Stack = createNativeStackNavigator();

function PublicProfileRoute({ route }) {
  return (
    <PublicProfileScreen usuario={route.params.usuario} />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />

      <SearchProvider>
        <NavigationContainer>
          <SafeAreaView
            edges={['left', 'right', 'bottom']}
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
            }}
          >
            <Stack.Navigator initialRouteName="Buscador">
              <Stack.Screen
                name="Buscador"
                component={SearchScreen}
                options={{ title: 'Hallado' }}
              />

              <Stack.Screen
                name="Resultados"
                component={SearchResultsScreen}
                options={{ title: 'Resultados' }}
              />

              <Stack.Screen
                name="Perfil"
                component={ProfileScreen}
                options={{ title: 'Mi perfil' }}
              />

              <Stack.Screen
                name="GestionPublicacion"
                component={GestionPublicacionScreen}
                options={{ title: 'Gestionar publicación' }}
              />

              <Stack.Screen
                name="PerfilPublico"
                component={PublicProfileRoute}
                options={{ title: 'Perfil público' }}
              />
            </Stack.Navigator>
          </SafeAreaView>
        </NavigationContainer>
      </SearchProvider>
    </SafeAreaProvider>
  );
}