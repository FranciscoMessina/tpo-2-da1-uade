import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError, isCancel } from 'axios';
import {
  obtenerAlertas,
  crearAlerta as crearEnServidor,
  actualizarAlerta,
  eliminarAlerta as eliminarEnServidor,
  marcarAlertaLeida,
} from '../services/alertas';
import { mensajeErrorApi } from '../services/api';

async function cargarAlertas(signal) {
  let pagina = 1;
  let datos;
  const alertas = new Map();

  do {
    datos = await obtenerAlertas({ pagina, signal });
    datos.items.forEach((alerta) => alertas.set(alerta.id, alerta));
    pagina += 1;
  } while (pagina <= datos.totalPages);

  return [...alertas.values()];
}

function mensajeError(error) {
  return isAxiosError(error)
    ? mensajeErrorApi(error)
    : error?.message || 'No se pudo completar la operación.';
}

export default function useAlertas(usuarioId) {
  const alcance = useMemo(() => ({ usuarioId }), [usuarioId]);
  const [estado, setEstado] = useState({
    alcance: null, alertas: [], loading: false, error: '',
  });
  const [operacion, setOperacion] = useState({
    alcance: null, guardando: false,
  });
  const [intento, setIntento] = useState(0);
  const sesionActual = useRef(null);

  useEffect(() => {
    const sesion = { alcance, activa: true, ocupada: false };
    sesionActual.current = sesion;
    return () => { sesion.activa = false; };
  }, [alcance]);

  useEffect(() => {
    if (!usuarioId) return;
    let activo = true;
    const controller = new AbortController();

    cargarAlertas(controller.signal)
      .then((alertas) => {
        if (activo) {
          setEstado({ alcance, alertas, loading: false, error: '' });
        }
      })
      .catch((error) => {
        if (!activo || isCancel(error)) return;
        setEstado((actual) => ({
          alcance,
          alertas: actual.alcance === alcance ? actual.alertas : [],
          loading: false,
          error: mensajeError(error),
        }));
      });

    return () => {
      activo = false;
      controller.abort();
    };
  }, [usuarioId, alcance, intento]);

  const recargar = useCallback(() => {
    if (!usuarioId) return;
    setEstado((actual) => ({
      alcance,
      alertas: actual.alcance === alcance ? actual.alertas : [],
      loading: true,
      error: '',
    }));
    setIntento((actual) => actual + 1);
  }, [usuarioId, alcance]);

  const ejecutar = useCallback(async (accion) => {
    const sesion = sesionActual.current;
    if (!usuarioId || !sesion?.activa || sesion.alcance !== alcance || sesion.ocupada) {
      return false;
    }

    sesion.ocupada = true;
    setOperacion({ alcance, guardando: true });
    setEstado((actual) => ({ ...actual, error: '' }));

    try {
      await accion();
      if (!sesion.activa) return false;
      recargar();
      return true;
    } catch (error) {
      if (sesion.activa) {
        setEstado((actual) => ({
          alcance,
          alertas: actual.alcance === alcance ? actual.alertas : [],
          loading: actual.alcance === alcance && actual.loading,
          error: mensajeError(error),
        }));
      }
      return false;
    } finally {
      sesion.ocupada = false;
      if (sesion.activa) setOperacion({ alcance, guardando: false });
    }
  }, [usuarioId, alcance, recargar]);

  const crearAlerta = useCallback(
    (filtros) => ejecutar(() => crearEnServidor(filtros)), [ejecutar]
  );
  const eliminarAlerta = useCallback(
    (id) => ejecutar(() => eliminarEnServidor(id)), [ejecutar]
  );
  const activarAlerta = useCallback(
    (id, activa = true) => ejecutar(() => actualizarAlerta(id, activa)), [ejecutar]
  );
  const marcarLeida = useCallback(
    (id) => ejecutar(() => marcarAlertaLeida(id)), [ejecutar]
  );

  const vigente = estado.alcance === alcance;

  return {
    alertas: usuarioId && vigente ? estado.alertas : [],
    loading: !!usuarioId && (!vigente || estado.loading),
    error: usuarioId && vigente ? estado.error : '',
    guardando: !!usuarioId && operacion.alcance === alcance && operacion.guardando,
    crearAlerta,
    eliminarAlerta,
    activarAlerta,
    marcarLeida,
    recargar,
  };
}
