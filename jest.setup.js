// Configuración común de las pruebas (se carga después de instalar el entorno de Jest).
// Los módulos nativos se reemplazan por dobles en memoria: las pruebas no tocan el dispositivo.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Red del dispositivo: por defecto conectada. `__emitir(cambios)` simula un cambio del sistema
// (modo avión, red que vuelve) y `__restablecer()` la deja como al principio.
jest.mock('expo-network', () => {
  const inicial = { type: 'WIFI', isConnected: true, isInternetReachable: true };
  const oyentes = new Set();
  let estado = inicial;
  return {
    __emitir(cambios) {
      estado = { ...estado, ...cambios };
      [...oyentes].forEach((oyente) => oyente(estado));
    },
    __restablecer() {
      estado = inicial;
      oyentes.clear();
    },
    getNetworkStateAsync: jest.fn(async () => estado),
    addNetworkStateListener: jest.fn((oyente) => {
      oyentes.add(oyente);
      return { remove: () => oyentes.delete(oyente) };
    }),
  };
});

jest.mock('expo-secure-store', () => {
  const almacen = new Map();
  return {
    __almacen: almacen,
    setItemAsync: jest.fn(async (clave, valor) => {
      almacen.set(clave, valor);
    }),
    getItemAsync: jest.fn(async (clave) => (almacen.has(clave) ? almacen.get(clave) : null)),
    deleteItemAsync: jest.fn(async (clave) => {
      almacen.delete(clave);
    }),
  };
});

// Sistema de archivos mínimo: ningún archivo existe y las operaciones no hacen nada.
// Alcanza para los módulos que solo consultan o borran; las pruebas que necesitan
// otro comportamiento reemplazan './archivosLocales' con jest.mock.
jest.mock('expo-file-system', () => {
  class Directory {
    constructor(...partes) {
      const base = partes
        .map((p) => (typeof p === 'string' ? p : p.uri))
        .map((p) => p.replace(/^\/+|\/+$/g, ''))
        .join('/');
      this.uri = `${base}/`;
      this.exists = false;
    }
    create() {}
    delete() {}
    list() {
      return [];
    }
  }
  class File {
    constructor(...partes) {
      this.uri = partes.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
      this.exists = false;
      this.size = 0;
    }
    async copy() {}
    delete() {}
    static async downloadFileAsync() {
      throw new Error('Descarga no disponible en las pruebas');
    }
  }
  return { Directory, File, Paths: { document: { uri: 'file:///documentos/' } } };
});

// Los íconos cargan su fuente al dibujarse: en las pruebas no aportan nada.
jest.mock('@react-native-vector-icons/material-design-icons', () => ({
  MaterialDesignIcons: () => null,
}));

// Navegación: dobles de los hooks de React Navigation. Las pruebas de hooks y pantallas no
// montan un NavigationContainer; `__navegacion` expone el objeto que devuelve useNavigation
// para verificar llamadas (navigate, goBack...) y `__ruta` los parámetros de useRoute.
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  const navegacion = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    popTo: jest.fn(),
    replace: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
  const ruta = { params: {} };
  return {
    __navegacion: navegacion,
    __ruta: ruta,
    useNavigation: () => navegacion,
    useRoute: () => ruta,
    // Como en la app, el efecto corre al montar y se limpia al desmontar (pantalla siempre enfocada).
    useFocusEffect: (efecto) => React.useEffect(efecto, [efecto]),
    useIsFocused: () => true,
    NavigationContainer: ({ children }) => children,
  };
});

beforeEach(async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  await (AsyncStorage.default ?? AsyncStorage).clear();
  require('expo-secure-store').__almacen.clear();
  const navegacion = require('@react-navigation/native');
  Object.values(navegacion.__navegacion).forEach((f) => f.mockClear());
  navegacion.__ruta.params = {};
});

// Selector nativo de fecha y hora: en Android se abre por la API imperativa (`open`), en iOS es un
// componente. Las pruebas leen las props con que se lo llamó y disparan sus eventos a mano.
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props) => React.createElement(View, { testID: 'datetimepicker', ...props }),
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});
