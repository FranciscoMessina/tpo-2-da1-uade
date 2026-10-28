import { isAxiosError } from 'axios';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { obtenerPerfilPublico } from '../services/perfiles';
import { mensajeErrorApi } from '../services/api';

export default function usePerfilPublico(usuarioId) {
  const [resultado, setResultado] = useState({
    id: null,
    usuario: null,
    loading: true,
    error: '',
  });
  const [intento, setIntento] = useState(0);

  useFocusEffect(useCallback(() => {
    let activo = true;

    obtenerPerfilPublico(usuarioId)
      .then((usuario) => {
        if (activo) {
          setResultado({ id: usuarioId, usuario, loading: false, error: '' });
        }
      })
      .catch((e) => {
        if (activo) {
          setResultado({
            id: usuarioId,
            usuario: null,
            loading: false,
            error: isAxiosError(e)
              ? mensajeErrorApi(e)
              : e?.message || 'No se pudo cargar el perfil público.',
          });
        }
      });

    return () => { activo = false; };
  }, [usuarioId, intento]));

  const recargarPerfil = useCallback(() => {
    setResultado({ id: usuarioId, usuario: null, loading: true, error: '' });
    setIntento((valor) => valor + 1);
  }, [usuarioId]);

  const vigente = resultado.id === usuarioId;

  return {
    usuario: vigente ? resultado.usuario : null,
    loading: vigente ? resultado.loading : true,
    error: vigente ? resultado.error : '',
    recargarPerfil,
  };
}
