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
import ConfiguracionScreen from './screens/ConfiguracionScreen';
import BloqueoBiometrico from './components/BloqueoBiometrico';
import CreatePostScreen from './screens/CreatePostScreen';
import AlertasScreen from './screens/AlertasScreen';
import SeguidasScreen from './screens/SeguidasScreen';
import PublicationDetailScreen from './screens/PublicationDetailScreen';
import MisReclamosScreen from './screens/MisReclamosScreen';
import HistorialScreen from './screens/HistorialScreen';
import { SearchProvider } from './context/SearchContext';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import useAuth, { AuthProvider } from './hooks/useAuth';

const Stack = createNativeStackNavigator();

function PublicProfileRoute({ route }) {
  return (
    <PublicProfileScreen usuario={route.params.usuario} />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContenido />
    </AuthProvider>
  );
}

function AppContenido() {
  const { autenticado } = useAuth();

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
            {!autenticado ? (
              <Stack.Navigator>
                <Stack.Screen
                  name="Login"
                  component={LoginScreen}
                  options={{ title: 'Ingresar' }}
                />
                <Stack.Screen
                  name="Registro"
                  component={RegisterScreen}
                  options={{ title: 'Registro' }}
                />
                <Stack.Screen
                  name="RecuperarContraseña"
                  component={ForgotPasswordScreen}
                  options={{ title: 'Recuperar contraseña' }}
                />
              </Stack.Navigator>
            ) : (
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
                name="CrearPublicacion"
                component={CreatePostScreen}
                options={{ title: 'Nueva publicación' }}
              />

              <Stack.Screen
                name="Alertas"
                component={AlertasScreen}
                options={{ title: 'Alertas' }}
              />

              <Stack.Screen
                name="Seguidas"
                component={SeguidasScreen}
                options={{ title: 'Publicaciones seguidas' }}
              />

              <Stack.Screen
                name="MisReclamos"
                component={MisReclamosScreen}
                options={{ title: 'Mis reclamos' }}
              />

              <Stack.Screen
                name="Historial"
                component={HistorialScreen}
                options={{ title: 'Historial de devoluciones' }}
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

              <Stack.Screen
                name="Configuracion"
                component={ConfiguracionScreen}
                options={{ title: 'Configuración' }}
              />

              <Stack.Screen
                name="DetallePublicacion"
                component={PublicationDetailScreen}
                options={{ title: 'Publicación' }}
              />
            </Stack.Navigator>
            )}
          </SafeAreaView>
          <BloqueoBiometrico />
        </NavigationContainer>
      </SearchProvider>
    </SafeAreaProvider>
  );
}