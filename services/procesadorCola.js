import { estaConectado, reportarFalloConexion } from './conexion';
import { crearPublicacion, mensajeErrorPublicacion } from './publicaciones';
import { existeArchivo } from './archivosLocales';
import {
  ESTADOS,
  clasificarError,
  fotosFaltantes,
  leerCola,
  liberarArchivosItem,
  liberarEspera,
  marcarEnviando,
  marcarError,
  marcarFalloConectividad,
  marcarFalloServidor,
  marcarInterrumpido,
  modificarCola,
  quitarItem,
  registrarFotoSubida,
  siguienteItem,
} from './colaPublicaciones';

// Un único procesamiento a la vez: pedidos simultáneos (conexión recuperada, app en primer
// plano, botón «enviar ahora») comparten la misma ejecución.
let ejecucion = null;

/**
 * Envía en orden las publicaciones pendientes de la cuenta, de a una:
 *  - reutiliza `crearPublicacion` con el mismo `clientId` del ítem y el mapa de fotos ya
 *    subidas (persistido tras cada foto), así que un corte a mitad del envío no duplica
 *    la publicación ni vuelve a subir las imágenes;
 *  - ante falta de conectividad deja el ítem pendiente con espera exponencial y se detiene;
 *  - ante un rechazo del servidor (4xx de validación) lo marca con error y sigue con el resto;
 *  - ante 5xx/429 reintenta con espera hasta agotar el límite y luego lo marca con error.
 *
 * Opciones (todas opcionales; se inyectan para poder probarlo):
 *   signal           AbortSignal para interrumpir el envío en curso (cierre de sesión)
 *   ignorarEspera    ignora el backoff de los pendientes (conexión recuperada, «enviar ahora»)
 *   alEnviar         callback `({ item, publicacion })` tras cada alta confirmada
 *   crear, hayConexion, existe, ahora, alFallarConexion  reemplazos de las dependencias reales
 *
 * Devuelve `{ enviadas, motivo }`, donde `motivo` indica por qué se detuvo:
 * 'vacia', 'sin-conexion', 'espera', 'cancelado', 'sesion' o 'fallo'.
 */
export function procesarCola(uid, opciones = {}) {
  if (!uid) return Promise.resolve({ enviadas: 0, motivo: 'vacia' });
  if (ejecucion) return ejecucion;

  ejecucion = ejecutar(uid, opciones).finally(() => {
    ejecucion = null;
  });
  return ejecucion;
}

async function ejecutar(uid, opciones) {
  const {
    signal = undefined,
    ignorarEspera = false,
    alEnviar = undefined,
    crear = crearPublicacion,
    hayConexion = estaConectado,
    existe = existeArchivo,
    ahora = Date.now,
    alFallarConexion = reportarFalloConexion,
  } = opciones;

  let enviadas = 0;
  if (ignorarEspera) await modificarCola(uid, liberarEspera);

  while (true) {
    if (signal?.aborted) return { enviadas, motivo: 'cancelado' };
    if (!hayConexion()) return { enviadas, motivo: 'sin-conexion' };

    const cola = await leerCola(uid);
    const item = siguienteItem(cola, ahora());
    if (!item) {
      return { enviadas, motivo: cola.some((i) => i.estado === ESTADOS.PENDIENTE) ? 'espera' : 'vacia' };
    }

    // Si falta alguna foto local que aún no se subió, reintentar no sirve: hay que editar el ítem
    if (fotosFaltantes(item, existe).length > 0) {
      await modificarCola(uid, (c) =>
        marcarError(
          c,
          item.id,
          'Falta una de las fotos guardadas en el dispositivo. Editá la publicación y volvé a elegirla.',
          ahora()
        )
      );
      continue;
    }

    await modificarCola(uid, (c) => marcarEnviando(c, item.id, ahora()));

    try {
      const publicacion = await crear(item.datos, {
        clientId: item.clientId,
        fotosSubidas: new Map(Object.entries(item.fotosSubidas)),
        signal,
        alSubirFoto: (uri, url) =>
          modificarCola(uid, (c) => registrarFotoSubida(c, item.id, uri, url)),
      });

      // Alta confirmada. Si la app se cierra antes de quitarlo, el reenvío con el mismo
      // clientId devuelve esta misma publicación en lugar de crear otra.
      await modificarCola(uid, (c) => quitarItem(c, item.id));
      liberarArchivosItem(uid, item);
      enviadas += 1;
      alEnviar?.({ item, publicacion });
    } catch (error) {
      const clase = clasificarError(error);

      if (clase === 'conectividad') {
        alFallarConexion();
        await modificarCola(uid, (c) => marcarFalloConectividad(c, item.id, ahora()));
        return { enviadas, motivo: 'sin-conexion' };
      }

      if (clase === 'cancelado' || clase === 'sesion') {
        await modificarCola(uid, (c) => marcarInterrumpido(c, item.id, ahora()));
        return { enviadas, motivo: clase };
      }

      const mensaje = mensajeErrorPublicacion(error);

      if (clase === 'servidor') {
        const nueva = await modificarCola(uid, (c) =>
          marcarFalloServidor(c, item.id, mensaje, ahora())
        );
        // Si agotó los reintentos quedó con error y el resto de la cola puede seguir
        if (nueva.find((i) => i.id === item.id)?.estado !== ESTADOS.ERROR) {
          return { enviadas, motivo: 'fallo' };
        }
        continue;
      }

      // Rechazo definitivo: queda con error y el resto de la cola sigue
      await modificarCola(uid, (c) => marcarError(c, item.id, mensaje, ahora()));
    }
  }
}
