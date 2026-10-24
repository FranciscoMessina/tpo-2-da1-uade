import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError, isCancel } from 'axios';
import {
  obtenerSeguidas,
  seguirPublicacion,
  dejarDeSeguirPublicacion,
} from '../services/publicaciones';
import { mensajeErrorApi } from '../services/api';

async function cargarSeguidas(signal) {
  let pagina = 1;
  let datos;
  const publicaciones = new Map();

  do {
    datos = await obtenerSeguidas({ pagina, signal });
    datos.items.forEach((publicacion) => publicaciones.set(publicacion.id, publicacion));
    pagina += 1;
  } while (pagina <= datos.totalPages);

  return [...publicaciones.values()];
}

function mensajeError(error) {
  return isAxiosError(error)
    ? mensajeErrorApi(error)
    : error?.message || 'No se pudo completar la operación.';
}

export default function useSeguidas(usuarioId) {
  const alcance = useMemo(() => ({ usuarioId }), [usuarioId]);
  const [estado, setEstado] = useState({
    alcance: null, publicaciones: [], loading: false, error: '',
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

    cargarSeguidas(controller.signal)
      .then((publicaciones) => {
        if (activo) {
          setEstado({ alcance, publicaciones, loading: false, error: '' });
        }
      })
      .catch((error) => {
        if (!activo || isCancel(error)) return;
        setEstado((actual) => ({
          alcance,
          publicaciones: actual.alcance === alcance ? actual.publicaciones : [],
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
      publicaciones: actual.alcance === alcance ? actual.publicaciones : [],
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
          publicaciones: actual.alcance === alcance ? actual.publicaciones : [],
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

  const seguir = useCallback(
    (id) => ejecutar(() => seguirPublicacion(id)), [ejecutar]
  );
  const dejarDeSeguir = useCallback(
    (id) => ejecutar(() => dejarDeSeguirPublicacion(id)), [ejecutar]
  );

  const vigente = estado.alcance === alcance;

  return {
    publicaciones: usuarioId && vigente ? estado.publicaciones : [],
    loading: !!usuarioId && (!vigente || estado.loading),
    error: usuarioId && vigente ? estado.error : '',
    guardando: !!usuarioId && operacion.alcance === alcance && operacion.guardando,
    seguir,
    dejarDeSeguir,
    recargar,
  };
}
