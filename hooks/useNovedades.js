import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { isCancel } from 'axios';
import {
  obtenerNotificaciones,
  marcarNotificacionLeida,
} from '../services/notificaciones';
import { mensajeErrorApi } from '../services/api';

async function cargarNotificaciones(signal) {
  const notificaciones = new Map();
  let pagina = 1;
  let datos;

  do {
    datos = await obtenerNotificaciones({ pagina, signal });
    datos.items.forEach((item) => notificaciones.set(item.id, item));
    pagina += 1;
  } while (pagina <= datos.totalPages);

  return [...notificaciones.values()];
}

export default function useNovedades(usuarioId) {
  const alcance = useMemo(() => ({ usuarioId }), [usuarioId]);
  const [estado, setEstado] = useState({
    alcance: null, notificaciones: [], loading: false, error: '',
  });
  const [operacion, setOperacion] = useState({ alcance: null, guardando: false });
  const [intento, setIntento] = useState(0);
  const sesionActual = useRef(null);

  useEffect(() => {
    const sesion = {
      alcance, activa: true, ocupada: false, consultando: false,
      controller: null, notificaciones: [],
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

    cargarNotificaciones(controller.signal)
      .then((notificaciones) => {
        if (!sesion.activa || controller.signal.aborted) return;
        sesion.notificaciones = notificaciones;
        setEstado({ alcance, notificaciones, loading: false, error: '' });
      })
      .catch((error) => {
        if (!sesion.activa || controller.signal.aborted || isCancel(error)) return;
        setEstado((actual) => ({
          alcance,
          notificaciones: actual.alcance === alcance ? actual.notificaciones : [],
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
      notificaciones: actual.alcance === alcance ? actual.notificaciones : [],
      loading: true,
      error: '',
    }));
    setIntento((actual) => actual + 1);
  }, [usuarioId, alcance]);

  const marcarLeidas = useCallback(async (tipo, campo, id) => {
    const sesion = sesionActual.current;
    if (!usuarioId || !sesion?.activa || sesion.alcance !== alcance || sesion.ocupada) {
      return false;
    }
    const pendientes = sesion.notificaciones.filter(
      (item) => !item.leidaEn && item.tipo === tipo && item[campo] === id
    );
    if (pendientes.length === 0) return true;

    sesion.ocupada = true;
    sesion.controller?.abort();
    setOperacion({ alcance, guardando: true });
    setEstado((actual) => ({ ...actual, loading: false, error: '' }));

    try {
      for (const item of pendientes) {
        if (!sesion.activa) return false;
        await marcarNotificacionLeida(item.id);
        if (!sesion.activa) return false;
        const leidaEn = new Date().toISOString();
        sesion.notificaciones = sesion.notificaciones.map((actual) => (
          actual.id === item.id ? { ...actual, leidaEn } : actual
        ));
        setEstado({
          alcance, notificaciones: sesion.notificaciones, loading: false, error: '',
        });
      }
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

  const marcarAlertaLeida = useCallback(
    (id) => marcarLeidas('coincidencia', 'alertaId', id), [marcarLeidas]
  );
  const marcarPublicacionLeida = useCallback(
    (id) => marcarLeidas('publicacion', 'publicacionId', id), [marcarLeidas]
  );
  const marcarReclamoLeido = useCallback(
    (id) => marcarLeidas('mensaje', 'reclamoId', id), [marcarLeidas]
  );

  const { porAlerta, porPublicacion, porReclamo } = useMemo(() => {
    const coincidencias = new Map();
    const porAlerta = new Map();
    const porPublicacion = new Map();
    const porReclamo = new Map();

    if (estado.alcance === alcance && usuarioId) {
      estado.notificaciones.forEach((item) => {
        if (item.leidaEn) return;
        if (item.tipo === 'coincidencia' && item.alertaId && item.publicacionId) {
          if (!coincidencias.has(item.alertaId)) coincidencias.set(item.alertaId, new Set());
          coincidencias.get(item.alertaId).add(item.publicacionId);
        }
        if (item.tipo === 'publicacion' && item.publicacionId) {
          porPublicacion.set(item.publicacionId, (porPublicacion.get(item.publicacionId) || 0) + 1);
        }
        if (item.tipo === 'mensaje' && item.reclamoId) {
          porReclamo.set(item.reclamoId, (porReclamo.get(item.reclamoId) || 0) + 1);
        }
      });
      coincidencias.forEach((ids, id) => porAlerta.set(id, ids.size));
    }
    return { porAlerta, porPublicacion, porReclamo };
  }, [estado, alcance, usuarioId]);

  const vigente = estado.alcance === alcance;
  return {
    porAlerta,
    porPublicacion,
    porReclamo,
    loading: !!usuarioId && (!vigente || estado.loading),
    error: usuarioId && vigente ? estado.error : '',
    guardando: !!usuarioId && operacion.alcance === alcance && operacion.guardando,
    recargar,
    marcarAlertaLeida,
    marcarPublicacionLeida,
    marcarReclamoLeido,
  };
}
