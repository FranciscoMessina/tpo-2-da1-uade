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

- Alta de publicaciones de objetos o mascotas, con fotos (galería o cámara), categoría, zona, ubicación y dirección exacta opcional; en los hallazgos son obligatorias una pregunta de verificación y su respuesta privada (`CreatePostScreen`, `components/FormularioPublicacion.js`, `hooks/useCrearPublicacion.js`, `services/publicaciones.js`). Las fotos se eligen con `expo-image-picker` y la ubicación se obtiene con `expo-location`.
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
- Reabrir sin conexión: si al iniciar no se puede validar la sesión por falta de red, se usa el perfil mínimo guardado (id y nombre) para leer la caché, y la sesión se revalida al volver la conexión (`hooks/useAuth.js`, `services/sesion.js`).
- Borrador y cola: el formulario de alta guarda un borrador por cuenta (`services/borradores.js`). Sin conexión, la publicación se puede guardar para enviar después: la cola (`services/colaPublicaciones.js`, `services/procesadorCola.js`, `context/ColaPublicacionesContext.js`) la envía sola al recuperar la red, sin duplicarla (mismo `clientId`). El estado se ve en el aviso inferior y en «Publicaciones pendientes». La cola y los borradores de una cuenta solo se procesan con esa cuenta logueada.
- `expo-file-system` es un módulo nativo: después de instalar dependencias hace falta un dev build (`npm run android:dev`).

## Estructura

```
App.js                navegación (pantallas de ingreso y de la app) y proveedores
context/              ConexionContext (conexión), SearchContext (búsqueda, alertas, seguidas, novedades) y ColaPublicacionesContext (envíos pendientes)
hooks/                lógica de pantallas y estado (useAuth, useCrearPublicacion, useGestionPublicacion, ...)
screens/              pantallas
components/           componentes reutilizables
services/             cliente HTTP (api.js) y llamadas a la API por dominio
data/searchDemo.js    constantes (categorías, zonas, periodos) y validación de filtros de búsqueda;
                      el nombre es histórico y el archivo no contiene datos de prueba
```

## Verificación

Correr las pruebas unitarias (Jest con el preset `jest-expo`, no necesitan emulador ni backend):

```powershell
npm test
```

Las pruebas están en `__tests__/` y cubren la lógica de `services/`: cola de publicaciones y su procesador (un alta por publicación aunque se corte la red, fotos que no se vuelven a subir), caché offline por cuenta y minimización de datos, borradores, sesión, conexión y búsqueda con caché. Los módulos nativos (AsyncStorage, SecureStore, sistema de archivos) y la API se reemplazan por dobles en `jest.setup.js` y dentro de cada prueba. Para correr una sola: `npm test -- cola` (filtra por nombre de archivo).

Compilar el bundle de Android sin levantar el emulador:

```powershell
npx expo export --platform android --output-dir "$env:TEMP\export-hallado"
```

Debe terminar con una línea `Exported: ...`. Si cambiaste `EXPO_PUBLIC_API_URL`, agregar `-c` para no reutilizar la caché de Metro. Esta verificación comprueba que el proyecto compila; no reemplaza probar la app contra el backend.
