# Hallado

Trabajo práctico de Desarrollo de Aplicaciones 1. Aplicación para publicar y buscar objetos y mascotas perdidas o encontradas.

## Backend

Para utilizar la autenticación de la app hay que ejecutar el backend de este repositorio:

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

La configuración inicial usa `EMAIL_MODE=console`. Los códigos para registro y recuperación de contraseña aparecen en la terminal del backend; no se envían por correo en este modo. Hay que usar el código generado para cada solicitud.

### Conexión desde Android

En `services/api.js`, `API_URL` está configurada como `http://10.0.2.2:3000` para acceder al backend de la computadora desde el emulador Android.

Para probar desde un celular físico, usar la IPv4 de la computadora en esa URL. Ambos dispositivos deben estar en la misma red Wi-Fi y el puerto 3000 debe ser accesible desde el celular.
