// Configuración común de las pruebas (se carga después de instalar el entorno de Jest).
// Los módulos nativos se reemplazan por dobles en memoria: las pruebas no tocan el dispositivo.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

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

beforeEach(async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  await (AsyncStorage.default ?? AsyncStorage).clear();
  require('expo-secure-store').__almacen.clear();
});
