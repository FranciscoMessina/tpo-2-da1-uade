import { useCallback, useEffect, useState } from 'react';
import {
  tablaPublicaciones,
  tablaReclamos,
  tablaValoraciones,
} from '../data/misPublicacionesDemo';

const espera = () => new Promise((resolver) => setTimeout(resolver, 250));

// Gestión de una publicación propia.
// BACKEND: las funciones marcadas con "BACKEND" simulan una llamada de red; reemplazar
// la lógica sobre las tablas mock por el fetch correspondiente.
// La dirección exacta y el teléfono del reclamante solo se exponen cuando hay un
// reclamo aceptado (el backend debería aplicar esa regla).
export default function useGestionPublicacion(publicacionId) {
  const [publicacion, setPublicacion] = useState(null);
  const [reclamos, setReclamos] = useState([]);
  const [valoracion, setValoracion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sincronizar = useCallback(() => {
    const p = tablaPublicaciones.find((x) => x.id === publicacionId);
    if (!p) {
      setPublicacion(null);
      setReclamos([]);
      return;
    }
    const rs = tablaReclamos.filter((r) => r.publicacionId === publicacionId);
    const hayAceptado = rs.some((r) => r.estado === 'aceptado');

    setPublicacion({
      ...p,
      direccionExacta: hayAceptado ? p.direccionExacta : null,
    });
    setReclamos(
      rs.map((r) => ({
        ...r,
        telefono:
          r.estado === 'aceptado' && r.permiteTelefono ? r.telefono : null,
      }))
    );
    setValoracion(
      tablaValoraciones.find((v) => v.publicacionId === publicacionId) || null
    );
  }, [publicacionId]);

  useEffect(() => {
    let activo = true;
    setLoading(true);
    setError('');

    // BACKEND: GET /publicaciones/:id y GET /publicaciones/:id/reclamos
    espera().then(() => {
      if (!activo) return;
      if (!tablaPublicaciones.some((x) => x.id === publicacionId)) {
        setError('No se encontró la publicación.');
      } else {
        sincronizar();
      }
      setLoading(false);
    });

    return () => {
      activo = false;
    };
  }, [publicacionId, sincronizar]);

  async function ejecutar(accion) {
    setError('');
    try {
      await espera();
      accion();
      sincronizar();
      return { ok: true };
    } catch (e) {
      const mensaje = e.message || 'No se pudo completar la acción.';
      setError(mensaje);
      return { ok: false, error: mensaje };
    }
  }

  const original = () => tablaPublicaciones.find((x) => x.id === publicacionId);

  // BACKEND: PATCH /publicaciones/:id
  const guardarCambios = (cambios) =>
    ejecutar(() => {
      const titulo = (cambios.titulo ?? '').trim();
      if (titulo.length < 3) {
        throw new Error('El título debe tener al menos 3 caracteres.');
      }
      if (!(cambios.categoria ?? '').trim()) {
        throw new Error('Elegí una categoría.');
      }
      Object.assign(original(), {
        titulo,
        descripcion: (cambios.descripcion ?? '').trim(),
        categoria: cambios.categoria,
        barrio: (cambios.barrio ?? '').trim(),
      });
    });

  // BACKEND: POST /reclamos/:id/aceptar (el backend pasa el estado a en_reclamo)
  const aceptarReclamo = (reclamoId) =>
    ejecutar(() => {
      const r = tablaReclamos.find((x) => x.id === reclamoId);
      if (!r) throw new Error('Reclamo inexistente.');
      if (original().estado === 'resuelta') {
        throw new Error('La publicación ya está resuelta.');
      }
      tablaReclamos.forEach((x) => {
        if (x.publicacionId === publicacionId && x.estado === 'aceptado') {
          x.estado = 'pendiente';
        }
      });
      r.estado = 'aceptado';
      original().estado = 'en_reclamo';
    });

  // BACKEND: POST /reclamos/:id/rechazar
  const rechazarReclamo = (reclamoId) =>
    ejecutar(() => {
      const r = tablaReclamos.find((x) => x.id === reclamoId);
      if (!r) throw new Error('Reclamo inexistente.');
      const eraAceptado = r.estado === 'aceptado';
      r.estado = 'rechazado';
      if (eraAceptado && original().estado === 'en_reclamo') {
        original().estado = 'abierta';
      }
    });

  // BACKEND: POST /publicaciones/:id/resolver
  const marcarResuelta = () =>
    ejecutar(() => {
      const hayAceptado = tablaReclamos.some(
        (r) => r.publicacionId === publicacionId && r.estado === 'aceptado'
      );
      if (!hayAceptado) {
        throw new Error('Para resolver, primero aceptá un reclamo.');
      }
      original().estado = 'resuelta';
    });

  // Alimenta la reputación de la otra parte: { positiva: boolean, comentario }.
  // BACKEND: POST /usuarios/:id/valoraciones
  const valorar = ({ positiva, comentario }) =>
    ejecutar(() => {
      if (original().estado !== 'resuelta') {
        throw new Error('Solo podés valorar tras concretar la devolución.');
      }
      if (tablaValoraciones.some((v) => v.publicacionId === publicacionId)) {
        throw new Error('Ya valoraste esta devolución.');
      }
      const r = tablaReclamos.find(
        (x) => x.publicacionId === publicacionId && x.estado === 'aceptado'
      );
      tablaValoraciones.push({
        publicacionId,
        aUsuario: r?.usuario,
        positiva: Boolean(positiva),
        comentario: (comentario ?? '').trim(),
      });
    });

  // BACKEND: DELETE /publicaciones/:id
  const eliminar = () =>
    ejecutar(() => {
      const i = tablaPublicaciones.findIndex((x) => x.id === publicacionId);
      if (i >= 0) tablaPublicaciones.splice(i, 1);
      for (let j = tablaReclamos.length - 1; j >= 0; j--) {
        if (tablaReclamos[j].publicacionId === publicacionId) {
          tablaReclamos.splice(j, 1);
        }
      }
    });

  return {
    publicacion,
    reclamos,
    valoracion,
    loading,
    error,
    guardarCambios,
    aceptarReclamo,
    rechazarReclamo,
    marcarResuelta,
    valorar,
    eliminar,
  };
}
