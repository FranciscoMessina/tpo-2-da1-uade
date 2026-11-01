# Hallado

Trabajo práctico de Desarrollo de Aplicaciones 1. Aplicación móvil (Expo / React Native) para publicar y buscar objetos y mascotas perdidos o encontrados.

La app consume la API real del backend de Hallado. Todas las pantallas leen y escriben en el backend; la única información local es la caché offline descrita más abajo.

## Requisitos

- Node.js y npm. El proyecto usa `package-lock.json`.
- Expo SDK 57 (`expo` 57.0.x) y React Native 0.86, definidos en `package.json`.
- Un emulador Android (Android Studio) o un celular Android.
- El backend de Hallado en ejecución (ver la sección siguiente).

## Backend

La app necesita el backend para iniciar sesión y para todos los datos. Levantarlo antes que el frontend:

[Backend de Hallado](https://github.com/FedericoFrandsen/backend-tpo2-da1)

### Primera instalación

Se necesita **Bun 1.4.2 o superior**. Los siguientes comandos son para PowerShell y deben ejecutarse en una carpeta distinta de la del frontend:

```powershell
git clone https://github.com/FedericoFrandsen/backend-tpo2-da1.git
cd backend-tpo2-da1
bun install --frozen-lockfile
Copy-Item .env.example .env
bun run db:seed
bun run dev
```

El backend utiliza SQLite y aplica las migraciones automáticamente. No hace falta instalar un servidor de base de datos. El comando `db:seed` carga usuarios y publicaciones de demostración sin sobrescribir los datos existentes.

### Ejecuciones siguientes

Desde la carpeta del backend:

```powershell
bun run dev
```

Dejar esa terminal abierta mientras se usa la app y ejecutar el frontend en otra terminal.

### Comprobar que funciona

- Estado del servidor: [http://localhost:3000/health](http://localhost:3000/health). Debe responder con `status: "ok"`.
- Documentación de las rutas: [http://localhost:3000/docs](http://localhost:3000/docs).

### Usuario de prueba

Después de ejecutar el seed, las cuentas nuevas de demostración tienen estas credenciales:

- Email: `demo@hallado.com`
- Contraseña: `Hallado123`

Si la cuenta ya existía, el seed conserva su contraseña anterior.

### Códigos OTP

La configuración inicial del backend usa `EMAIL_MODE=console`. Los códigos para registro y recuperación de contraseña aparecen en la terminal del backend; no se envían por correo en este modo. Hay que usar el código generado para cada solicitud.

## Configuración de la API

La URL del backend se toma de la variable `EXPO_PUBLIC_API_URL`. Expo la lee desde un archivo `.env` en la raíz del frontend y la incorpora al bundle durante el empaquetado (`process.env.EXPO_PUBLIC_API_URL` en `services/api.js`).

Crear el archivo local a partir de la plantilla:

```powershell
Copy-Item .env.example .env
```

| Escenario | Valor de `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Emulador Android (valor por defecto) | `http://10.0.2.2:3000` |
| Celular físico en la misma red Wi-Fi | `http://192.168.0.10:3000` (IPv4 de la PC, por ejemplo con `ipconfig`) |
| Fuera del desarrollo local | URL HTTPS del backend desplegado |

Reglas:

- Si la variable no está definida o está vacía, la app usa `http://10.0.2.2:3000`.
- Las barras finales se quitan automáticamente.
- Para un celular físico, el puerto 3000 debe ser accesible desde el celular (revisar el firewall de Windows).
- Después de cambiar la variable, reiniciar Expo con caché limpia: `npx expo start -c`. El valor queda fijado al empaquetar y la caché de Metro puede conservar el anterior.
- `.env` no se versiona (está en `.gitignore`). `.env.example` sí.
- No guardar secretos en variables `EXPO_PUBLIC_*`: quedan incluidas en el bundle de la app.

## Instalación y ejecución

Primera vez, desde la carpeta del frontend:

```powershell
npm install
```

Luego, con el backend corriendo:

```powershell
npm start            # servidor de desarrollo de Expo
npm run android      # abre la app en el emulador o dispositivo Android conectado
```

## Funcionalidades

**Cuenta y sesión**

- Ingreso con email y contraseña; registro y recuperación de contraseña con código OTP (`LoginScreen`, `RegisterScreen`, `ForgotPasswordScreen`, `hooks/useAuth.js`).
- El token de sesión se guarda en almacenamiento seguro (`services/sesion.js`, `expo-secure-store`). Si el backend invalida la sesión, la app vuelve al ingreso.
- Bloqueo biométrico opcional al abrir la app, configurable desde Configuración (`BloqueoBiometrico`, `hooks/useBloqueoBiometrico.js`, `expo-local-authentication`).
- Perfil propio y perfil público de otros usuarios (`ProfileScreen`, `PublicProfileScreen`, `services/perfiles.js`).

**Publicaciones**

- Alta de publicaciones de objetos o mascotas, con fotos (galería o cámara), categoría, zona, ubicación y dirección exacta opcional; en los hallazgos son obligatorias una pregunta de verificación y su respuesta privada (`CreatePostScreen`, `components/FormularioPublicacion.js`, `hooks/useCrearPublicacion.js`, `services/publicaciones.js`). La cámara está dentro de la app (`components/CamaraModal.js`, `expo-camera`: requiere un dev client reconstruido), las fotos de la galería se eligen con `expo-image-picker` y la ubicación se obtiene con `expo-location`.
- Borrador automático del alta y cola de publicaciones para enviar después cuando no hay conexión (ver «Conexión y caché offline»).
- Mis publicaciones, filtradas por estado (`hooks/useMisPublicaciones.js`).
- Gestión de la publicación propia: editar, eliminar y renovar, con aviso de vencimiento (`GestionPublicacionScreen`, `hooks/useGestionPublicacion.js`).
- Detalle de publicación (`PublicationDetailScreen`, `hooks/usePublicacion.js`).

**Búsqueda**

- Búsqueda con filtros (categoría, zona, periodo y fechas) y resultados paginados con orden configurable (`SearchScreen`, `SearchResultsScreen`, `buscarPublicacionesConCache` en `services/publicaciones.js`).

**Reclamos**

- Reclamo sobre una publicación con evidencia estructurada: mensaje, respuesta a la pregunta de verificación (si la publicación tiene una), barrio y foto de prueba (`enviarReclamo`, `components/EvidenciaReclamo.js`).
- Bandejas de reclamos enviados y recibidos, con aceptar o rechazar los recibidos (`MisReclamosScreen`, `services/publicaciones.js`).
- Encuentro para la devolución: proponer y aceptar un punto de encuentro (`components/EncuentroReclamo.js`, `components/PuntoEncuentro.js`, `services/encuentros.js`).
- Mensajería dentro de cada reclamo (`ConversacionReclamoScreen`, `hooks/useMensajesReclamo.js`, `services/mensajes.js`).
- Historial de devoluciones: resolver publicaciones, valorar devoluciones y enviar agradecimientos. Los agradecimientos recibidos se muestran en el perfil público (`HistorialScreen`, `services/historial.js`, `components/AgradecimientosPublicos.js`).

**Alertas, seguidas y novedades**

- Alertas de búsqueda: crear, activar o desactivar, eliminar y marcar como leídas (`AlertasScreen`, `hooks/useAlertas.js`, `services/alertas.js`).
- Publicaciones seguidas: seguir y dejar de seguir (`SeguidasScreen`, `hooks/useSeguidas.js`).
- Novedades: notificaciones del usuario con marcado de leídas (`hooks/useNovedades.js`, `services/notificaciones.js`).

**Conexión y caché offline**

- Detección de conexión: `services/conexion.js` consulta el backend con `GET /categorias` (timeout de 3 segundos) al iniciar y cada 12 segundos con la app en primer plano. Cuando una petición falla por falta de conectividad, la app lo reporta sin esperar al siguiente sondeo. `context/ConexionContext.js` expone el estado a la interfaz.
- Caché por cuenta: la caché se guarda bajo una clave propia de cada usuario (`services/cacheOffline.js`). Al cerrar sesión se borra la caché de la cuenta que sale. Al iniciar, se descarta la caché de versiones anteriores, que era compartida entre cuentas.
- Sin conexión, la app muestra lo último que tiene guardado: resultados de búsqueda, publicaciones consultadas recientemente (hasta 25) y últimos reclamos. Ante un error HTTP con respuesta del servidor, el error se muestra tal cual y no se reemplaza con la caché.
- Fotos offline: las fotos de las publicaciones consultadas (y la primera de cada resultado guardado) se descargan a una carpeta de la cuenta con `expo-file-system` y se usan sin conexión. Las fotos de prueba de reclamos son privadas y nunca se descargan.
- Mensajes y bloqueo sin conexión: la app distingue dos causas. Sin red en el dispositivo (modo avión, sin señal; `expo-network` en `services/red.js`) dice «Sin conexión a internet» y deja el backend como no disponible al instante, sin esperar al timeout. Con red pero sin respuesta del servidor dice «No pudimos conectar con el servidor» (el ping de `services/conexion.js` decide). Solo se usa `isConnected` de `expo-network`: `isInternetReachable` es falso en una Wi-Fi local sin internet aunque el backend responda. Los dos textos están en `services/api.js`; `Aviso`, `ErrorConReintento` y `AvisoSinConexion` los dibujan como aviso de conexión (ícono y título según la causa) en lugar de error. Una petición real que falla por conectividad comprueba la conexión enseguida. Las acciones que necesitan el backend usan `<Boton requiereConexion notaSinConexion="…" />`, que queda bloqueado sin conexión y explica por qué; alertas, seguidas y las pantallas de ingreso, registro y recuperación de contraseña también muestran un aviso de conexión. Lo único que se puede crear sin conexión es una publicación nueva (cola de arriba). `expo-network` es un módulo nativo: tras agregarlo hay que reconstruir el dev client.
- Reabrir sin conexión: si al iniciar no se puede validar la sesión por falta de red, se usa el perfil mínimo guardado (id y nombre) para leer la caché, y la sesión se revalida al volver la conexión (`hooks/useAuth.js`, `services/sesion.js`).
- Borrador y cola: el formulario de alta guarda un borrador por cuenta (`services/borradores.js`). Sin conexión, la publicación se puede guardar para enviar después: la cola (`services/colaPublicaciones.js`, `services/procesadorCola.js`, `context/ColaPublicacionesContext.js`) la envía sola al recuperar la red, sin duplicarla (mismo `clientId`). El estado se ve en el aviso inferior y en «Publicaciones pendientes». La cola y los borradores de una cuenta solo se procesan con esa cuenta logueada.
- `expo-file-system` es un módulo nativo: después de instalar dependencias hace falta un dev build (`npm run android:dev`).

## Estructura

```
App.js                navegación (ingreso, cinco pestañas y pantallas apiladas) y proveedores
DESIGN.md             tokens, componentes y reglas del sistema de diseño
context/              ConexionContext (conexión), SearchContext (búsqueda, alertas, seguidas, novedades) y ColaPublicacionesContext (envíos pendientes)
hooks/                lógica de pantallas y estado (useAuth, useCrearPublicacion, useGestionPublicacion, ...)
screens/              pantallas
components/           componentes de dominio (formularios, tarjetas, reclamos)
components/ui/        sistema de diseño: tema.js (tokens), controles y patrones compartidos
services/             cliente HTTP (api.js) y llamadas a la API por dominio
data/busqueda.js    constantes (categorías, zonas, periodos) y validación de filtros de búsqueda;
                      el nombre es histórico y el archivo no contiene datos de prueba
```

## Verificación

Correr las pruebas unitarias (Jest con el preset `jest-expo`, no necesitan emulador ni backend):

```powershell
npm test
```

Las pruebas están en `__tests__/`. `__tests__/services/` cubre la lógica de `services/`: cola de publicaciones y su procesador (un alta por publicación aunque se corte la red, fotos que no se vuelven a subir), caché offline por cuenta y minimización de datos, borradores, sesión, conexión y búsqueda con caché. Los módulos nativos (AsyncStorage, SecureStore, sistema de archivos) y la API se reemplazan por dobles en `jest.setup.js` y dentro de cada prueba. Para correr una sola: `npm test -- cola` (filtra por nombre de archivo). Para repetir la corrida exacta de verificación: `npm test -- --runInBand`.

### Pruebas de hooks y pantallas

`__tests__/hooks/` y `__tests__/screens/` usan `@testing-library/react-native` (`renderHook`, `render`). El entorno común:

- `jest.setup.js` reemplaza `@react-navigation/native` (`useNavigation`, `useRoute`, `useFocusEffect`, `useIsFocused`): no se monta un `NavigationContainer`. `__navegacion` y `__ruta`, exportados por ese doble, permiten verificar `navigate`/`goBack` y fijar parámetros de ruta; se reinician antes de cada prueba.
- `__tests__/hooks/entorno.js` (no es una prueba) ofrece `diferida()` (promesa que la prueba resuelve a mano, para probar respuestas tardías sin red), `controlarAppState()`/`restaurarAppState()` (doble de `AppState` con `emitir('background' | 'active')`) y `simularConectividad(bool)` (estado de `services/conexion`).
- La API se reemplaza con `jest.mock('../../services/<módulo>')`; los temporizadores con `jest.useFakeTimers()`. Ninguna prueba usa red ni temporizadores reales.

Ejemplos: `useNovedades.test.js` (cambio de cuenta durante una petición, respuesta tardía descartada, desmontaje que cancela y libera temporizador y `AppState`) y `HistorialScreen.test.js` (respuesta tardía de un filtro anterior, reintento tras error).

### Recorridos de borrador, cola y reintento

`__tests__/screens/CreatePostScreen.test.js` monta la pantalla de alta con la cola, el borrador y `crearPublicacion` reales, y reemplaza solo la sesión, el GPS y la red por un servidor simulado que, como el backend, guarda una publicación por cuenta y `clientId`. Cubre: el borrador que sobrevive al cierre de la pantalla y se retoma o descarta, el aislamiento del borrador y de la cola por cuenta, guardar sin conexión sin llamar al servidor, el envío posterior desde la cola con una sola publicación aunque se pierda la respuesta del primer intento, el reintento en línea con el mismo `clientId` y que un segundo toque mientras se envía no crea otra alta.

Lo que **no** certifica Jest, y sigue sin validarse hasta que una persona lo pruebe en un Android real: cámara y galería, permisos de ubicación denegados, GPS real, biometría real, Maps, el modo avión del sistema operativo (aquí se simula con `simularConectividad`), el reinicio real de la app (aquí se simula montando la pantalla de nuevo) y la recepción de correo real del código OTP. La prueba contra el backend real que se hizo a mano (servicios y `useNovedades` del frontend contra el proceso del backend con base temporal) no se guarda como prueba automática de este repositorio.

### Chequeo estático

```powershell
npm run lint        # ESLint (eslint-config-expo, flat config en eslint.config.js)
npm run typecheck   # tsc --noEmit con checkJs sobre JavaScript (tsconfig.json); no hay migración a TypeScript
```

Ambos terminan en 0 hoy, pero **el chequeo es parcial**:

- **Lint** cubre todo el proyecto. Los incumplimientos que ya existían (reglas nuevas de `react-hooks` 7, y comillas sin escapar en JSX) están registrados en `eslint.config.js` como `warn` solo en los archivos afectados y solo para esa regla; siguen apareciendo en la salida. `lint` usa `--max-warnings 25` (el total actual): un aviso nuevo hace fallar el comando. Al corregir deuda, sacar el archivo de la lista y bajar ese número.
- **Typecheck** (`checkJs`, `strict: false`, sin `DOM` en `lib`) cubre solo los archivos listados en `include` de `tsconfig.json` y lo que importan: 66 de 91 archivos de `App.js`, `index.js`, `components/`, `context/`, `hooks/`, `screens/`, `services/` y `data/`. Quedan fuera los que hoy no pasan, o que importan alguno que no pasa (TypeScript igual chequea todo archivo importado, por eso no se usa `exclude`). **No** incluye `__tests__/` (no hay `@types/jest`) ni se puede afirmar que el proyecto esté tipado. Para ver la deuda, agregar el archivo a `include` y correr `npm run typecheck`. Hoy el chequeo completo da 45 errores en 13 archivos: `App.js` (4), `components/FormularioPublicacion.js` (20), `AvisoSincronizacion.js` (2), `ImagenPrivada.js` (1), `PublicacionesPendientes.js` (2), `context/ColaPublicacionesContext.js` (1), `hooks/useBorradorPublicacion.js` (1), `screens/CreatePostScreen.js` (1), `ForgotPasswordScreen.js` (3), `LoginScreen.js` (2), `RegisterScreen.js` (3), `services/colaPublicaciones.js` (3) y `procesadorCola.js` (2). Casi todos son inferencia de JS sin anotaciones (props opcionales, `useState({})`, una cadena de promesas en `serializar`).

Compilar el bundle de Android sin levantar el emulador:

```powershell
npx expo export --platform android --output-dir "$env:TEMP\export-hallado"
```

Debe terminar con una línea `Exported: ...`. Si cambiaste `EXPO_PUBLIC_API_URL`, agregar `-c` para no reutilizar la caché de Metro. Esta verificación comprueba que el proyecto compila; no reemplaza probar la app contra el backend.
