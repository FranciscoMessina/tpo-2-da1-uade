import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { mensajeErrorApi } from '../services/api';
import {
  esErrorDeConectividad,
  reportarFalloConexion,
} from '../services/conexion';
import {
  aceptarReclamo as aceptarReclamoApi,
  editarPublicacion,
  eliminarPublicacion,
  mensajeErrorPublicacion,
  obtenerPublicacionPropia,
  obtenerReclamosDePublicacion,
  rechazarReclamo as rechazarReclamoApi,
  renovarPublicacion,
} from '../services/publicaciones';
import { resolverPublicacion } from '../services/historial';

// Gestión de una publicación propia sobre la API: detalle (con la respuesta de verificación),
// reclamos recibidos, edición, renovación, baja y resolución.
// Las acciones devuelven { ok, error } y mientras corre una `procesando` indica cuál
// (la clave de la acción o el id del reclamo).
export default function useGestionPublicacion(publicacionId) {
  const [publicacion, setPublicacion] = useState(null);
  const [reclamos, setReclamos] = useState([]);
  const [paginacion, setPaginacion] = useState({ pagina: 1, totalPaginas: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(null);
  const version = useRef(0);
  const conDatos = useRef(false);
  const enCurso = useRef(false);
  const fotosSubidas = useRef(new Map());

  // `recarga` mantiene visible lo que ya se cargó (pull to refresh, volver a la pantalla, tras una acción)
  const cargar = useCallback(async ({ recarga = false } = {}) => {
    if (!publicacionId) {
      setError('No se indicó la publicación.');
      setLoading(false);
      return;
    }

    const actual = ++version.current;
    if (recarga) setRefrescando(true);
    else if (!conDatos.current) setLoading(true);
    setError('');

    try {
      const [detalle, recibidos] = await Promise.all([
        obtenerPublicacionPropia(publicacionId),
        obtenerReclamosDePublicacion(publicacionId),
      ]);
      if (actual !== version.current) return;

      conDatos.current = true;
      setPublicacion(detalle);
      setReclamos(recibidos.items || []);
      setPaginacion({
        pagina: recibidos.page || 1,
        totalPaginas: recibidos.totalPages || 1,
        total: recibidos.total ?? (recibidos.items || []).length,
      });
    } catch (e) {
      if (actual !== version.current) return;
      if (esErrorDeConectividad(e)) reportarFalloConexion();
      setError(mensajeErrorApi(e));
    } finally {
      if (actual === version.current) {
        setLoading(false);
        setRefrescando(false);
      }
    }
  }, [publicacionId]);

  useFocusEffect(
    useCallback(() => {
      cargar({ recarga: conDatos.current });
    }, [cargar])
  );

  const recargar = useCallback(() => cargar({ recarga: conDatos.current }), [cargar]);

  const cargarMasReclamos = useCallback(async () => {
    if (cargandoMas || paginacion.pagina >= paginacion.totalPaginas) return;

    const actual = version.current;
    setCargandoMas(true);

    try {
      const res = await obtenerReclamosDePublicacion(publicacionId, {
        pagina: paginacion.pagina + 1,
      });
      if (actual !== version.current) return;

      setReclamos((previos) => {
        const ids = new Set(previos.map((r) => r.id));
        return [...previos, ...(res.items || []).filter((r) => !ids.has(r.id))];
      });
      setPaginacion({
        pagina: res.page || paginacion.pagina + 1,
        totalPaginas: res.totalPages || paginacion.totalPaginas,
        total: res.total ?? paginacion.total,
      });
    } catch (e) {
      if (actual === version.current) setError(mensajeErrorApi(e));
    } finally {
      setCargandoMas(false);
    }
  }, [cargandoMas, paginacion, publicacionId]);

  // Ejecuta una acción de escritura de a una por vez; el estado se vuelve a pedir al servidor al terminar
  async function ejecutar(clave, accion, { recargarAlTerminar = true } = {}) {
    if (enCurso.current) {
      return { ok: false, error: 'Hay otra operación en curso. Esperá un momento.' };
    }
    enCurso.current = true;
    setProcesando(clave);

    try {
      const resultado = await accion();
      if (recargarAlTerminar) await cargar({ recarga: true });
      return { ok: true, datos: resultado };
    } catch (e) {
      if (esErrorDeConectividad(e)) reportarFalloConexion();
      return { ok: false, error: mensajeErrorPublicacion(e) };
    } finally {
      enCurso.current = false;
      setProcesando(null);
    }
  }

  // PATCH /publicaciones/:id (solo mientras esté abierta); `datos` viene del formulario
  const guardarCambios = (datos) =>
    ejecutar(
      'guardar',
      async () => {
        const actualizada = await editarPublicacion(publicacionId, datos, {
          fotosSubidas: fotosSubidas.current,
        });
        setPublicacion(actualizada);
        return actualizada;
      },
      { recargarAlTerminar: false }
    );

  // DELETE /publicaciones/:id (baja lógica)
  const eliminar = () =>
    ejecutar('eliminar', () => eliminarPublicacion(publicacionId), {
      recargarAlTerminar: false,
    });

  // POST /publicaciones/:id/renovar
  const renovar = () => ejecutar('renovar', () => renovarPublicacion(publicacionId));

  // POST /reclamos/:id/aceptar (la publicación pasa a «en reclamo»)
  const aceptarReclamo = (reclamoId) =>
    ejecutar(reclamoId, () => aceptarReclamoApi(reclamoId));

  // POST /reclamos/:id/rechazar
  const rechazarReclamo = (reclamoId) =>
    ejecutar(reclamoId, () => rechazarReclamoApi(reclamoId));

  // POST /publicaciones/:id/resolver (confirma la devolución; las valoraciones están en el historial)
  const confirmarDevolucion = () =>
    ejecutar('resolver', () => resolverPublicacion(publicacionId));

  return {
    publicacion,
    reclamos,
    totalReclamos: paginacion.total,
    hayMasReclamos: paginacion.pagina < paginacion.totalPaginas,
    loading,
    refrescando,
    cargandoMas,
    error,
    procesando,
    recargar,
    cargarMasReclamos,
    guardarCambios,
    eliminar,
    renovar,
    aceptarReclamo,
    rechazarReclamo,
    confirmarDevolucion,
  };
}
