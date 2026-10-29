import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { mensajeErrorApi } from '../services/api';
import { obtenerMisPublicaciones } from '../services/publicaciones';

// Lista las publicaciones del usuario actual (GET /mis-publicaciones), paginada y
// filtrable por estado. Se recarga cada vez que la pantalla toma el foco o cambia el filtro.
export default function useMisPublicaciones() {
  const [estado, setEstado] = useState('');
  const [publicaciones, setPublicaciones] = useState([]);
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');
  const [errorMas, setErrorMas] = useState('');
  const version = useRef(0);
  const conDatos = useRef(false);

  // `recarga` mantiene visible la lista actual mientras se actualiza (pull to refresh o volver a la pantalla)
  const cargar = useCallback(async (filtro, { recarga = false } = {}) => {
    const actual = ++version.current;
    if (recarga) setRefrescando(true);
    else if (!conDatos.current) setLoading(true);
    setError('');
    setErrorMas('');

    try {
      const res = await obtenerMisPublicaciones({ estado: filtro });
      if (actual !== version.current) return;

      conDatos.current = true;
      setPublicaciones(res.items);
      setPaginacion({
        pagina: res.page || 1,
        totalPaginas: res.totalPages || 1,
        total: res.total ?? res.items.length,
      });
    } catch {
      if (actual !== version.current) return;
      // Si ya había una lista se conserva; el error se muestra igual para poder reintentar
      setError('No se pudieron cargar tus publicaciones.');
    } finally {
      if (actual === version.current) {
        setLoading(false);
        setRefrescando(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar(estado, { recarga: conDatos.current });
    }, [cargar, estado])
  );

  const cambiarEstado = useCallback((nuevo) => {
    conDatos.current = false;
    setPublicaciones([]);
    setPaginacion({ pagina: 1, totalPaginas: 1, total: 0 });
    setEstado(nuevo);
  }, []);

  const recargar = useCallback(
    () => cargar(estado, { recarga: true }),
    [cargar, estado]
  );

  const cargarMas = useCallback(async () => {
    if (cargandoMas || paginacion.pagina >= paginacion.totalPaginas) return;

    const actual = version.current;
    setCargandoMas(true);
    setErrorMas('');

    try {
      const res = await obtenerMisPublicaciones({
        estado,
        pagina: paginacion.pagina + 1,
      });
      // Si se recargó o cambió el filtro mientras tanto, esta página ya no corresponde
      if (actual !== version.current) return;

      setPublicaciones((previas) => {
        const ids = new Set(previas.map((p) => p.id));
        return [...previas, ...res.items.filter((p) => !ids.has(p.id))];
      });
      setPaginacion({
        pagina: res.page || paginacion.pagina + 1,
        totalPaginas: res.totalPages || paginacion.totalPaginas,
        total: res.total ?? paginacion.total,
      });
    } catch (e) {
      if (actual === version.current) setErrorMas(mensajeErrorApi(e));
    } finally {
      setCargandoMas(false);
    }
  }, [cargandoMas, estado, paginacion]);

  return {
    publicaciones,
    estado,
    cambiarEstado,
    total: paginacion.total,
    hayMas: paginacion.pagina < paginacion.totalPaginas,
    loading,
    refrescando,
    cargandoMas,
    error,
    errorMas,
    recargar,
    cargarMas,
  };
}
