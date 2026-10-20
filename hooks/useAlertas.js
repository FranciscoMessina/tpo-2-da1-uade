import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { claveBusqueda } from '../data/searchDemo';

// MOCK DE BACKEND: las alertas se persisten en AsyncStorage.
// Para conectar el backend real, reemplazar leerAlertas/escribirAlertas
// (y las acciones de abajo) por llamadas fetch a la API.
const CLAVE_ALERTAS = '@hallado:alertas:v1';

async function leerAlertas() {
  const texto = await AsyncStorage.getItem(CLAVE_ALERTAS);
  const datos = texto ? JSON.parse(texto) : [];

  if (!Array.isArray(datos)) {
    throw new Error('Las alertas guardadas no tienen el formato esperado.');
  }

  return datos.filter(
    (a) => typeof a?.id === 'string' && typeof a?.clave === 'string' && a.filtros
  );
}

async function escribirAlertas(lista) {
  await AsyncStorage.setItem(CLAVE_ALERTAS, JSON.stringify(lista));
}

export default function useAlertas() {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const actual = useRef([]);
  const cola = useRef(Promise.resolve());
  const cargado = useRef(false);

  useEffect(() => {
    let activo = true;

    leerAlertas()
      .then((lista) => {
        if (!activo) return;
        actual.current = lista;
        cargado.current = true;
        setAlertas(lista);
      })
      .catch(() => {
        if (activo) setError('No se pudieron cargar las alertas.');
      })
      .finally(() => {
        if (activo) setLoading(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  // Aplica un cambio, actualiza el estado y persiste en orden.
  const aplicar = useCallback((transformar) => {
    const siguiente = transformar(actual.current);

    if (siguiente === actual.current) return;

    actual.current = siguiente;
    setAlertas(siguiente);
    setError(null);

    if (!cargado.current) return;

    cola.current = cola.current
      .then(() => escribirAlertas(siguiente))
      .catch(() => {
        setError('No se pudieron guardar los cambios de las alertas.');
      });
  }, []);

  const crearAlerta = useCallback(
    (filtros) => {
      const clave = claveBusqueda(filtros);
      const existente = actual.current.find((a) => a.clave === clave);

      if (existente) return existente;

      const nueva = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        clave,
        filtros: { ...filtros },
        activa: true,
        creadaEn: new Date().toISOString(),
      };

      aplicar((lista) => [nueva, ...lista]);
      return nueva;
    },
    [aplicar]
  );

  const eliminarAlerta = useCallback(
    (id) => aplicar((lista) => lista.filter((a) => a.id !== id)),
    [aplicar]
  );

  const activarAlerta = useCallback(
    (id, activa = true) =>
      aplicar((lista) =>
        lista.map((a) => (a.id === id ? { ...a, activa } : a))
      ),
    [aplicar]
  );

  return {
    alertas,
    loading,
    error,
    crearAlerta,
    eliminarAlerta,
    activarAlerta,
  };
}
