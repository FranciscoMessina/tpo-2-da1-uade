// Configuración de ESLint (flat config) basada en eslint-config-expo.
// No se aplicó autofix: lo preexistente se registra abajo y se corrige en planes propios.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const globalesJest = {
  jest: 'readonly',
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  afterAll: 'readonly',
  afterEach: 'readonly',
};

const globalesNode = {
  require: 'readonly',
  module: 'writable',
};

// Deuda preexistente (al crear esta configuración): reglas que ya incumplían estos archivos.
// Se bajan de "error" a "warn" SOLO en estos archivos y SOLO para estas reglas, así siguen
// apareciendo en la salida de `npm run lint`, y cualquier archivo nuevo o no listado las
// trata como error. El script `lint` usa --max-warnings con el total actual: sumar un
// aviso nuevo falla; al corregir deuda, bajar ese número en package.json y sacar el archivo de acá.
const deudaPreexistente = [
  {
    // Setear estado dentro de un efecto (regla nueva de eslint-plugin-react-hooks 7).
    regla: 'react-hooks/set-state-in-effect',
    archivos: [
      'components/ImagenPrivada.js',
      'context/ColaPublicacionesContext.js',
      'context/ConexionContext.js',
      'hooks/useMensajesReclamo.js',
      'screens/SearchResultsScreen.js',
    ],
  },
  {
    // Leer/escribir un ref durante el render.
    regla: 'react-hooks/refs',
    archivos: [
      'components/FormularioPublicacion.js',
      'hooks/useBorradorPublicacion.js',
      'hooks/useCrearPublicacion.js',
    ],
  },
  {
    // Comillas sin escapar en texto JSX (estilo; no cambia el comportamiento).
    regla: 'react/no-unescaped-entities',
    archivos: ['components/AvisoSincronizacion.js', 'screens/CreatePostScreen.js'],
  },
  {
    // BUG REAL: SearchResultsScreen.js usa `visibles` (línea ~200) sin definirla.
    regla: 'no-undef',
    archivos: ['screens/SearchResultsScreen.js'],
  },
];

module.exports = defineConfig([
  // Solo se ignoran artefactos generados, nunca código propio.
  globalIgnores(['dist/*', '.expo/*', 'android/*', 'ios/*', '.claude/*']),
  expoConfig,
  {
    files: ['__tests__/**/*.js', 'jest.setup.js'],
    languageOptions: { globals: globalesJest },
  },
  {
    files: ['eslint.config.js'],
    languageOptions: { globals: globalesNode },
  },
  ...deudaPreexistente.map(({ regla, archivos }) => ({
    files: archivos,
    rules: { [regla]: 'warn' },
  })),
]);
