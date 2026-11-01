import { StyleSheet, View } from 'react-native';
import { ConexionProvider } from './context/ConexionContext';
import { StatusBar } from 'expo-status-bar';
import {
  DefaultTheme,
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import ProfileScreen from './screens/ProfileScreen';
import PublicProfileScreen from './screens/PublicProfileScreen';
import GestionPublicacionScreen from './screens/GestionPublicacionScreen';
import SearchScreen from './screens/SearchScreen';
import SearchResultsScreen from './screens/SearchResultsScreen';
import ConfiguracionScreen from './screens/ConfiguracionScreen';
import BloqueoBiometrico from './components/BloqueoBiometrico';
import CreatePostScreen from './screens/CreatePostScreen';
import PublicacionesPendientesScreen from './screens/PublicacionesPendientesScreen';
import AvisoSincronizacion from './components/AvisoSincronizacion';
import { ColaPublicacionesProvider } from './context/ColaPublicacionesContext';
import AlertasScreen from './screens/AlertasScreen';
import SeguidasScreen from './screens/SeguidasScreen';
import PublicationDetailScreen from './screens/PublicationDetailScreen';
import MisPublicacionesScreen from './screens/MisPublicacionesScreen';
import MisReclamosScreen from './screens/MisReclamosScreen';
import HistorialScreen from './screens/HistorialScreen';
import ConversacionReclamoScreen from './screens/ConversacionReclamoScreen';
import { SearchProvider, useSearch } from './context/SearchContext';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import useAuth, { AuthProvider } from './hooks/useAuth';
import {
  Boton,
  Icono,
  RUTA_PESTANAS,
  colores,
  espacio,
  estilosPantalla,
  opcionesEncabezado,
  radios,
  tipografia,
  tonos,
} from './components/ui';

const Stack = createNativeStackNavigator();
const BarraInferior = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

const temaNavegacion = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colores.primario,
    background: colores.fondo,
    card: colores.superficie,
    text: colores.texto,
    border: colores.borde,
    notification: colores.primario,
  },
};

function navegar(nombre, params = undefined) {
  if (navigationRef.isReady()) navigationRef.navigate(nombre, params);
}

function PublicProfileRoute({ route }) {
  return (
    <PublicProfileScreen usuario={route.params.usuario} />
  );
}

function totalNovedades(porGrupo) {
  let total = 0;
  porGrupo.forEach((cantidad) => {
    total += cantidad;
  });
  return total > 0 ? total : undefined;
}

function IconoPestana({ activa, nombre, nombreActiva = nombre }) {
  return (
    <View style={[styles.indicador, activa && styles.indicadorActivo]}>
      <Icono
        nombre={activa ? nombreActiva : nombre}
        tamano={22}
        color={activa ? tonos.info.texto : colores.textoSecundario}
      />
    </View>
  );
}

function iconoDePestana(nombre, nombreActiva = nombre) {
  return function Icono({ focused }) {
    return <IconoPestana activa={focused} nombre={nombre} nombreActiva={nombreActiva} />;
  };
}

// Publicar es una de las dos tareas centrales: queda a mano desde cualquier pestaña
function BotonPublicar({ navigation }) {
  return (
    <Boton
      titulo="Publicar"
      icono="plus"
      variante="secundario"
      chico
      onPress={() => navigation.navigate('CrearPublicacion')}
    />
  );
}

function barraConAviso(props) {
  return (
    <View>
      <AvisoSincronizacion navegar={navegar} />
      <BottomTabBar {...props} />
    </View>
  );
}

// Entran el indicador de la pestaña y su etiqueta; la altura por defecto los recorta
const ALTURA_BARRA = 66;

function PestanasPrincipales() {
  const { novedadesPorAlerta, novedadesPorPublicacion, novedadesPorReclamo } = useSearch();
  const insets = useSafeAreaInsets();

  return (
    <BarraInferior.Navigator
      backBehavior="initialRoute"
      tabBar={barraConAviso}
      screenOptions={({ navigation }) => ({
        ...opcionesEncabezado,
        headerRight: () => <BotonPublicar navigation={navigation} />,
        headerRightContainerStyle: styles.accionEncabezado,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: tonos.info.texto,
        tabBarInactiveTintColor: colores.textoSecundario,
        tabBarLabelStyle: tipografia.leyendaFuerte,
        tabBarBadgeStyle: styles.contador,
        tabBarStyle: [styles.barra, { height: ALTURA_BARRA + insets.bottom }],
      })}
    >
      <BarraInferior.Screen
        name="Buscador"
        component={SearchScreen}
        options={{
          title: 'Hallado',
          tabBarLabel: 'Buscar',
          tabBarIcon: iconoDePestana('magnify'),
        }}
      />

      <BarraInferior.Screen
        name="Alertas"
        component={AlertasScreen}
        options={{
          title: 'Alertas',
          tabBarIcon: iconoDePestana('bell-outline', 'bell'),
          tabBarBadge: totalNovedades(novedadesPorAlerta),
        }}
      />

      <BarraInferior.Screen
        name="Seguidas"
        component={SeguidasScreen}
        options={{
          title: 'Publicaciones seguidas',
          tabBarLabel: 'Seguidas',
          tabBarIcon: iconoDePestana('bookmark-outline', 'bookmark'),
          tabBarBadge: totalNovedades(novedadesPorPublicacion),
        }}
      />

      <BarraInferior.Screen
        name="MisReclamos"
        component={MisReclamosScreen}
        options={{
          title: 'Mis reclamos',
          tabBarLabel: 'Reclamos',
          tabBarIcon: iconoDePestana('inbox-outline', 'inbox'),
          tabBarBadge: totalNovedades(novedadesPorReclamo),
        }}
      />

      <BarraInferior.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          title: 'Mi perfil',
          tabBarLabel: 'Perfil',
          tabBarIcon: iconoDePestana('account-outline', 'account'),
        }}
      />
    </BarraInferior.Navigator>
  );
}

// Margen inferior y aviso de sincronización de las pantallas que no tienen barra inferior
function marcoDePantalla({ children, route }) {
  if (route.name === RUTA_PESTANAS) return children;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={estilosPantalla.pantalla}>
      <View style={estilosPantalla.pantalla}>{children}</View>
      <AvisoSincronizacion navegar={navegar} />
    </SafeAreaView>
  );
}

const opcionesStack = {
  ...opcionesEncabezado,
  contentStyle: { backgroundColor: colores.fondo },
};

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

      <ConexionProvider>
      <ColaPublicacionesProvider>
      <SearchProvider>
        <NavigationContainer ref={navigationRef} theme={temaNavegacion}>
          {!autenticado ? (
            <Stack.Navigator screenOptions={opcionesStack} screenLayout={marcoDePantalla}>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ title: 'Ingresar', headerShown: false }}
              />
              <Stack.Screen
                name="Registro"
                component={RegisterScreen}
                options={{ title: 'Crear cuenta' }}
              />
              <Stack.Screen
                name="RecuperarContraseña"
                component={ForgotPasswordScreen}
                options={{ title: 'Recuperar contraseña' }}
              />
            </Stack.Navigator>
          ) : (
            <Stack.Navigator
              initialRouteName={RUTA_PESTANAS}
              screenOptions={opcionesStack}
              screenLayout={marcoDePantalla}
            >
              <Stack.Screen
                name={RUTA_PESTANAS}
                component={PestanasPrincipales}
                options={{ headerShown: false }}
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
                name="MisPublicaciones"
                component={MisPublicacionesScreen}
                options={{ title: 'Mis publicaciones' }}
              />

              <Stack.Screen
                name="PublicacionesPendientes"
                component={PublicacionesPendientesScreen}
                options={{ title: 'Publicaciones pendientes' }}
              />

              <Stack.Screen
                name="ConversacionReclamo"
                component={ConversacionReclamoScreen}
                options={{ title: 'Mensajes' }}
              />

              <Stack.Screen
                name="Historial"
                component={HistorialScreen}
                options={{ title: 'Historial de devoluciones' }}
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
          <BloqueoBiometrico />
        </NavigationContainer>
      </SearchProvider>
      </ColaPublicacionesProvider>
      </ConexionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  accionEncabezado: { paddingRight: espacio.sm },
  barra: { backgroundColor: colores.superficie, borderTopColor: colores.borde },
  indicador: {
    width: 56,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radios.pastilla,
  },
  indicadorActivo: { backgroundColor: colores.primarioSuave },
  contador: {
    backgroundColor: colores.primario,
    color: colores.textoInverso,
    fontSize: tipografia.leyendaFuerte.fontSize,
  },
});
