import { useCallback, useEffect, useState } from 'react';
import { crearPublicacionesEjemplo } from '../data/searchDemo';

// MOCK: usuario actual y publicadores de ejemplo.
// Al conectar el backend, reemplazar por la sesión real y por el
// publicador que devuelva la API.
const USUARIO_ACTUAL_ID = 'usuario-actual';

const PUBLICADORES = [
  {
    id: USUARIO_ACTUAL_ID,
    name: 'Vos (usuario de ejemplo)',
    zone: 'Palermo',
    memberSince: '2024-03-10',
    reputation: { completedReturns: 4, positiveReviews: 5, negativeReviews: 0 },
    badges: [],
  },
  {
    id: 'u-lucia',
    name: 'Lucía Fernández',
    zone: 'Caballito',
    memberSince: '2023-08-21',
    reputation: { completedReturns: 12, positiveReviews: 11, negativeReviews: 1 },
    badges: [],
  },
  {
    id: 'u-martin',
    name: 'Martín Gómez',
    zone: 'Belgrano',
    memberSince: '2025-01-05',
    reputation: { completedReturns: 0, positiveReviews: 0, negativeReviews: 0 },
    badges: [],
  },
];

const FRANJAS = ['Mañana (6 a 12 h)', 'Tarde (12 a 19 h)', 'Noche (19 a 6 h)'];
const ESTADOS = ['abierta', 'enReclamo', 'resuelta'];

function hash(texto) {
  return [...texto].reduce(
    (acc, caracter) => (acc * 31 + caracter.charCodeAt(0)) >>> 0,
    7
  );
}

// MOCK: construye el detalle a partir de las publicaciones de ejemplo.
// Reemplazar por: fetch(`${API}/publicaciones/${id}`).
function armarDetalle(base) {
  const h = hash(base.id);
  const estado = ESTADOS[h % ESTADOS.length];

  return {
    ...base,
    // Sin URIs reales: la pantalla muestra placeholders.
    fotos: Array.from({ length: 1 + (h % 3) }, () => null),
    franja: FRANJAS[h % FRANJAS.length],
    estado,
    reclamoAceptado: estado !== 'abierta' && h % 2 === 0,
    direccionExacta: `Av. de ejemplo ${100 + (h % 900)}, ${base.barrio}`,
    publicador: PUBLICADORES[h % PUBLICADORES.length],
  };
}

export default function usePublicacion(id) {
  const [publicacion, setPublicacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [siguiendo, setSiguiendo] = useState(false);
  const [reclamoEnviado, setReclamoEnviado] = useState(false);

  useEffect(() => {
    let activo = true;
    setLoading(true);
    setError('');

    // MOCK: simula latencia de red. Reemplazar por el fetch real.
    const temporizador = setTimeout(() => {
      if (!activo) return;

      const base = crearPublicacionesEjemplo().find(
        (item) => item.id === id
      );

      if (base) {
        setPublicacion(armarDetalle(base));
      } else {
        setPublicacion(null);
        setError('No encontramos la publicación.');
      }

      setLoading(false);
    }, 300);

    return () => {
      activo = false;
      clearTimeout(temporizador);
    };
  }, [id]);

  const esPropia = publicacion?.publicador.id === USUARIO_ACTUAL_ID;

  // MOCK: reemplazar por POST /publicaciones/:id/seguir (o DELETE).
  const toggleSeguir = useCallback(async () => {
    setSiguiendo((actual) => !actual);
  }, []);

  // MOCK: reemplazar por POST /publicaciones/:id/reclamos { mensaje }.
  const reclamar = useCallback(async (mensaje) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    setReclamoEnviado(true);
    return { ok: true, mensaje };
  }, []);

  const visible =
    publicacion && {
      ...publicacion,
      reclamoEnviado,
      // La dirección exacta solo se expone si el reclamo fue aceptado
      // y el usuario es parte (publicador o quien reclamó).
      direccionExacta:
        publicacion.reclamoAceptado && (esPropia || reclamoEnviado)
          ? publicacion.direccionExacta
          : null,
    };

  return {
    publicacion: visible,
    loading,
    error,
    esPropia,
    siguiendo,
    toggleSeguir,
    reclamar,
  };
}
