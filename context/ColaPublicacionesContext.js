import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import useAuth from '../hooks/useAuth';
import { estaConectado, suscribirConexion, verificarConexion } from '../services/conexion';
import {
  descartarDeCola,
  leerCola,
  proximaEspera,
  recuperarCola,
  reintentarEnCola,
  resumenCola,
  suscribirCola,
} from '../services/colaPublicaciones';
import { procesarCola } from '../services/procesadorCola';

// Cuánto se muestra el aviso de «publicación enviada»
const DURACION_AVISO_MS = 10000;

const RESUMEN_VACIO = { total: 0, pendientes: 0, enviando: 0, conError: 0 };

const ColaPublicacionesContext = createContext({
  cola: [],
  resumen: RESUMEN_VACIO,
  avisos: [],
  descartarAviso: () => {},
  procesarAhora: async () => {},
  reintentarItem: async () => {},
  descartarItem: async () => false,
});

/**
 * Mantiene a la vista la cola de publicaciones de la cuenta activa y la procesa:
 * al abrir la app o iniciar sesión, al recuperar la conexión, al volver a primer plano,
 * al vencer la espera de un reintento y a pedido (`procesarAhora`). Solo procesa la cola
 * de la cuenta con sesión iniciada, y se detiene (cancelando el envío en curso) al salir.
 * Mientras la sesión esté sin validar (restaurada sin conexión) no envía nada.
 */
export function ColaPublicacionesProvider({ children }) {
  const { usuario, sesionOffline } = useAuth();
  const uid = usuario?.id !== undefined && usuario?.id !== null ? String(usuario.id) : null;
  const habilitado = Boolean(uid) && !sesionOffline;

  const [cola, setCola] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const recuperada = useRef(Promise.resolve());
  const correrRef = useRef(null);

  // Estado visible de la cola: se carga con la sesión (también sin conexión) y sigue sus cambios
  useEffect(() => {
    setCola([]);
    setAvisos([]);
    if (!uid) {
      recuperada.current = Promise.resolve();
      return undefined;
    }

    let activo = true;
    // Un envío que quedó «enviando» por un cierre de la app vuelve a pendiente antes de procesar
    recuperada.current = recuperarCola(uid)
      .then((actual) => {
        if (activo) setCola(actual);
      })
      .catch(() => {});

    const desuscribir = suscribirCola((cuenta, actual) => {
      if (activo && cuenta === uid) setCola(actual);
    });

    return () => {
      activo = false;
      desuscribir();
    };
  }, [uid]);

  useEffect(() => {
    if (!habilitado) {
      correrRef.current = null;
      return undefined;
    }

    const controlador = new AbortController();
    let activo = true;
    let temporizador = null;

    function avisarEnvio({ item, publicacion }) {
      const aviso = {
        id: item.id,
        titulo: item.datos.titulo,
        publicacionId: publicacion?.id,
      };
      setAvisos((actuales) => [...actuales.filter((a) => a.id !== aviso.id), aviso]);
      setTimeout(
        () => setAvisos((actuales) => actuales.filter((a) => a.id !== aviso.id)),
        DURACION_AVISO_MS
      );
    }

    async function correr({ ignorarEspera = false } = {}) {
      clearTimeout(temporizador);

      try {
        await recuperada.current;
        if (!activo) return;

        await procesarCola(uid, {
          signal: controlador.signal,
          ignorarEspera,
          alEnviar: avisarEnvio,
        });
        if (!activo) return;

        // Si quedó un pendiente en espera de reintento, se vuelve a intentar cuando venza
        const espera = proximaEspera(await leerCola(uid));
        if (activo && espera !== null && estaConectado()) {
          temporizador = setTimeout(() => correr(), espera + 100);
        }
      } catch {
        // Un fallo de almacenamiento no debe romper la app: se reintenta en el próximo evento
      }
    }

    correrRef.current = correr;
    correr();

    // Al recuperar la conexión se reintenta sin esperar el backoff
    const desuscribirConexion = suscribirConexion((disponible) => {
      if (disponible) correr({ ignorarEspera: true });
    });
    const suscripcionEstado = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') correr();
    });

    return () => {
      activo = false;
      correrRef.current = null;
      controlador.abort();
      clearTimeout(temporizador);
      desuscribirConexion();
      suscripcionEstado.remove();
    };
  }, [uid, habilitado]);

  const procesarAhora = useCallback(async () => {
    // Confirma la conexión real antes de intentar: el estado compartido puede estar desactualizado
    await verificarConexion();
    await correrRef.current?.({ ignorarEspera: true });
  }, []);

  const reintentarItem = useCallback(
    async (id) => {
      await reintentarEnCola(uid, id);
      await procesarAhora();
    },
    [uid, procesarAhora]
  );

  const descartarItem = useCallback((id) => descartarDeCola(uid, id), [uid]);

  const descartarAviso = useCallback((id) => {
    setAvisos((actuales) => actuales.filter((a) => a.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      cola,
      resumen: cola.length > 0 ? resumenCola(cola) : RESUMEN_VACIO,
      avisos,
      descartarAviso,
      procesarAhora,
      reintentarItem,
      descartarItem,
    }),
    [cola, avisos, descartarAviso, procesarAhora, reintentarItem, descartarItem]
  );

  return (
    <ColaPublicacionesContext.Provider value={value}>
      {children}
    </ColaPublicacionesContext.Provider>
  );
}

export function useColaPublicaciones() {
  return useContext(ColaPublicacionesContext);
}
