import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isCancel } from 'axios';
import useAuth from './useAuth';
import { useSearch } from '../context/SearchContext';
import { obtenerPublicacion, enviarReclamo } from '../services/publicaciones';
import { mensajeErrorApi } from '../services/api';

export default function usePublicacion(id) {
  const { usuario } = useAuth();
  const usuarioId = usuario?.id;
  const {
    seguirPublicacion,
    dejarDeSeguirPublicacion,
    seguidasGuardando,
    seguidasError,
    recargarSeguidas,
  } = useSearch();
  const alcance = useMemo(() => ({ id, usuarioId }), [id, usuarioId]);
  const [estado, setEstado] = useState({
    alcance: null, publicacion: null, loading: false, error: '',
  });
  const [intento, setIntento] = useState(0);
  const sesionActual = useRef(null);

  useEffect(() => {
    const sesion = { alcance, activa: true, reclamando: false };
    sesionActual.current = sesion;
    return () => { sesion.activa = false; };
  }, [alcance]);

  useEffect(() => {
    if (!id || !usuarioId) return;
    let activo = true;
    const controller = new AbortController();

    obtenerPublicacion(id, { signal: controller.signal })
      .then((publicacion) => {
        if (activo) setEstado({ alcance, publicacion, loading: false, error: '' });
      })
      .catch((error) => {
        if (!activo || isCancel(error)) return;
        setEstado({ alcance, publicacion: null, loading: false, error: mensajeErrorApi(error) });
      });

    return () => {
      activo = false;
      controller.abort();
    };
  }, [id, usuarioId, alcance, intento]);

  const recargar = useCallback(() => {
    if (!id || !usuarioId) return;
    setEstado({ alcance, publicacion: null, loading: true, error: '' });
    setIntento((actual) => actual + 1);
  }, [id, usuarioId, alcance]);

  const vigente = estado.alcance === alcance;
  const publicacion = vigente ? estado.publicacion : null;

  const toggleSeguir = useCallback(async () => {
    const sesion = sesionActual.current;
    if (!sesion?.activa || sesion.alcance !== alcance || !publicacion || publicacion.esPropia) {
      return false;
    }

    const siguiendo = !publicacion.siguiendo;
    const guardada = await (siguiendo
      ? seguirPublicacion(id)
      : dejarDeSeguirPublicacion(id));
    if (!guardada || !sesion.activa) return false;

    recargar();
    return true;
  }, [alcance, publicacion, id, seguirPublicacion, dejarDeSeguirPublicacion, recargar]);

  const reclamar = useCallback(async (mensaje) => {
    const sesion = sesionActual.current;
    if (!sesion?.activa || sesion.alcance !== alcance || !publicacion || sesion.reclamando) {
      return null;
    }
    sesion.reclamando = true;

    try {
      const reclamo = await enviarReclamo(id, mensaje);
      if (!sesion.activa) return null;
      recargar();
      return reclamo;
    } catch (error) {
      if (!sesion.activa) return null;
      throw error;
    } finally {
      sesion.reclamando = false;
    }
  }, [alcance, publicacion, id, recargar]);

  return {
    publicacion,
    loading: !!id && !!usuarioId && (!vigente || estado.loading),
    error: !id ? 'No se indicó la publicación.' : vigente ? estado.error : '',
    esPropia: publicacion?.esPropia ?? false,
    siguiendo: publicacion?.siguiendo ?? false,
    guardandoSeguimiento: seguidasGuardando,
    errorSeguimiento: seguidasError,
    recargarSeguimiento: recargarSeguidas,
    toggleSeguir,
    reclamar,
    recargar,
  };
}
