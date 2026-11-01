import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { isCancel } from 'axios';
import {
  obtenerResumenNotificaciones,
  marcarGrupoLeido,
} from '../services/notificaciones';
import { mensajeErrorApi } from '../services/api';

// Cada grupo del resumen: nombre que entiende el servidor, lista y campo de su id.
const GRUPOS = {
  alerta: { lista: 'alertas', campo: 'alertaId' },
  publicacion: { lista: 'publicaciones', campo: 'publicacionId' },
  reclamo: { lista: 'reclamos', campo: 'reclamoId' },
};

function normalizarResumen(datos) {
  return {
    corte: datos?.corte ?? null,
    alertas: datos?.alertas ?? [],
    publicaciones: datos?.publicaciones ?? [],
    reclamos: datos?.reclamos ?? [],
  };
}

function contadores(resumen, grupo) {
  const { lista, campo } = GRUPOS[grupo];
  const cantidades = new Map();
  (resumen?.[lista] ?? []).forEach((item) => {
    if (item[campo] && item.sinLeer > 0) cantidades.set(item[campo], item.sinLeer);
  });
  return cantidades;
}

// De cada reclamo, solo los mensajes del chat sin leer (`sinLeer` suma además reclamos, encuentros
// y devolución).
function contadoresMensajes(resumen) {
  const cantidades = new Map();
  (resumen?.reclamos ?? []).forEach((item) => {
    if (item.reclamoId && item.mensajes > 0) cantidades.set(item.reclamoId, item.mensajes);
  });
  return cantidades;
}

export default function useNovedades(usuarioId) {
  const alcance = useMemo(() => ({ usuarioId }), [usuarioId]);
  const [estado, setEstado] = useState({
    alcance: null, resumen: null, loading: false, error: '',
  });
  const [operacion, setOperacion] = useState({ alcance: null, guardando: false });
  const [intento, setIntento] = useState(0);
  const sesionActual = useRef(null);

  useEffect(() => {
    const sesion = {
      alcance, activa: true, ocupada: false, consultando: false,
      controller: null, resumen: null,
    };
    sesionActual.current = sesion;
    if (!usuarioId) return () => { sesion.activa = false; };

    let enPrimerPlano = AppState.currentState !== 'background'
      && AppState.currentState !== 'inactive';
    function actualizar() {
      if (enPrimerPlano && !sesion.ocupada && !sesion.consultando) {
        setIntento((actual) => actual + 1);
      }
    }

    const intervalo = setInterval(actualizar, 20000);
    const suscripcion = AppState.addEventListener('change', (valor) => {
      enPrimerPlano = valor === 'active';
      if (enPrimerPlano) actualizar();
    });

    return () => {
      sesion.activa = false;
      sesion.controller?.abort();
      clearInterval(intervalo);
      suscripcion.remove();
    };
  }, [usuarioId, alcance]);

  useEffect(() => {
    const sesion = sesionActual.current;
    if (!usuarioId || sesion.ocupada) return;
    const controller = new AbortController();
    sesion.controller = controller;
    sesion.consultando = true;

    // Una sola petición por ciclo: contadores del servidor, no el historial.
    obtenerResumenNotificaciones({ signal: controller.signal })
      .then((datos) => {
        if (!sesion.activa || controller.signal.aborted) return;
        const resumen = normalizarResumen(datos);
        sesion.resumen = resumen;
        setEstado({ alcance, resumen, loading: false, error: '' });
      })
      .catch((error) => {
        if (!sesion.activa || controller.signal.aborted || isCancel(error)) return;
        setEstado((actual) => ({
          alcance,
          resumen: actual.alcance === alcance ? actual.resumen : null,
          loading: false,
          error: mensajeErrorApi(error),
        }));
      })
      .finally(() => {
        if (sesion.controller === controller) sesion.consultando = false;
      });

    return () => controller.abort();
  }, [usuarioId, alcance, intento]);

  const recargar = useCallback(() => {
    const sesion = sesionActual.current;
    if (!usuarioId || !sesion?.activa || sesion.alcance !== alcance || sesion.ocupada) return;
    setEstado((actual) => ({
      alcance,
      resumen: actual.alcance === alcance ? actual.resumen : null,
      loading: true,
      error: '',
    }));
    setIntento((actual) => actual + 1);
  }, [usuarioId, alcance]);

  const marcarLeidas = useCallback(async (grupo, id) => {
    const sesion = sesionActual.current;
    if (!usuarioId || !sesion?.activa || sesion.alcance !== alcance || sesion.ocupada) {
      return false;
    }
    const resumenMostrado = sesion.resumen;
    if (!resumenMostrado?.corte || !contadores(resumenMostrado, grupo).has(id)) return true;

    sesion.ocupada = true;
    sesion.controller?.abort();
    setOperacion({ alcance, guardando: true });
    setEstado((actual) => ({ ...actual, loading: false, error: '' }));

    try {
      // Una escritura por grupo, acotada al corte de lo mostrado: lo que llegó después queda sin leer.
      const datos = await marcarGrupoLeido({ tipo: grupo, id, corte: resumenMostrado.corte });
      if (!sesion.activa) return false;
      // El servidor devuelve el resumen ya reconciliado, con los eventos nuevos incluidos.
      const resumen = normalizarResumen(datos?.resumen);
      sesion.resumen = resumen;
      setEstado({ alcance, resumen, loading: false, error: '' });
      return true;
    } catch (error) {
      if (sesion.activa) {
        setEstado((actual) => ({ ...actual, error: mensajeErrorApi(error) }));
      }
      return false;
    } finally {
      sesion.ocupada = false;
      if (sesion.activa) setOperacion({ alcance, guardando: false });
    }
  }, [usuarioId, alcance]);

  const marcarAlertaLeida = useCallback((id) => marcarLeidas('alerta', id), [marcarLeidas]);
  const marcarPublicacionLeida = useCallback(
    (id) => marcarLeidas('publicacion', id), [marcarLeidas]
  );
  const marcarReclamoLeido = useCallback((id) => marcarLeidas('reclamo', id), [marcarLeidas]);

  const resumen = estado.alcance === alcance && usuarioId ? estado.resumen : null;
  const porAlerta = useMemo(() => contadores(resumen, 'alerta'), [resumen]);
  const porPublicacion = useMemo(() => contadores(resumen, 'publicacion'), [resumen]);
  // Todo lo nuevo de cada reclamo (mensajes, reclamos, encuentros y devolución)
  const porReclamo = useMemo(() => contadores(resumen, 'reclamo'), [resumen]);
  // Solo los mensajes del chat
  const mensajesPorReclamo = useMemo(() => contadoresMensajes(resumen), [resumen]);

  const vigente = estado.alcance === alcance;
  return {
    porAlerta,
    porPublicacion,
    porReclamo,
    mensajesPorReclamo,
    loading: !!usuarioId && (!vigente || estado.loading),
    error: usuarioId && vigente ? estado.error : '',
    guardando: !!usuarioId && operacion.alcance === alcance && operacion.guardando,
    recargar,
    marcarAlertaLeida,
    marcarPublicacionLeida,
    marcarReclamoLeido,
  };
}
