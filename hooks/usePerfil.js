import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { actualizarPerfil, obtenerPerfil } from '../services/perfiles';
import { mensajeErrorApi } from '../services/api';

function mensajeError(error) {
  return isAxiosError(error)
    ? mensajeErrorApi(error)
    : error?.message || 'No se pudo completar la operación.';
}

export default function usePerfil() {
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const montado = useRef(false);
  const guardadoEnCurso = useRef(false);

  useEffect(() => {
    let activo = true;
    montado.current = true;

    obtenerPerfil()
      .then((datos) => {
        if (activo) setPerfil(datos);
      })
      .catch((e) => {
        if (activo) {
          setPerfil(null);
          setError(mensajeError(e));
        }
      })
      .finally(() => {
        if (activo) setLoading(false);
      });

    return () => {
      activo = false;
      montado.current = false;
    };
  }, [intento]);

  const recargarPerfil = useCallback(() => {
    setLoading(true);
    setError('');
    setIntento((valor) => valor + 1);
  }, []);

  const guardarPerfil = useCallback(async (cambios) => {
    if (guardadoEnCurso.current || !montado.current) return false;
    guardadoEnCurso.current = true;
    setGuardando(true);
    setError('');

    try {
      const actualizado = await actualizarPerfil(cambios);
      if (!montado.current) return false;
      setPerfil(actualizado);
      return true;
    } catch (e) {
      if (montado.current) setError(mensajeError(e));
      return false;
    } finally {
      guardadoEnCurso.current = false;
      if (montado.current) setGuardando(false);
    }
  }, []);

  return { perfil, loading, guardando, error, guardarPerfil, recargarPerfil };
}