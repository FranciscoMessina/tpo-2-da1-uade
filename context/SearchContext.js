import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { claveBusqueda, radioValido } from '../data/busqueda';
import useAlertas from '../hooks/useAlertas';
import useAuth from '../hooks/useAuth';
import useSeguidas from '../hooks/useSeguidas';
import useNovedades from '../hooks/useNovedades';

const SearchContext = createContext(null);
// El historial es de cada cuenta: sin el id en la clave, quien ingresa después ve las búsquedas
// de la cuenta anterior.
const PREFIJO_RECIENTES = '@hallado:busquedas-recientes:v2:';
// Clave global de versiones anteriores: no se sabe de qué cuenta es, así que se descarta.
const CLAVE_RECIENTES_LEGADA = '@hallado:busquedas-recientes:v1';
// Cuántas búsquedas se guardan por cuenta: al hacer una nueva se descarta la más vieja.
export const MAX_RECIENTES = 5;

export function claveRecientes(uid) {
  return `${PREFIJO_RECIENTES}${uid}`;
}

function esBusquedaGuardada(item) {
  const filtros = item?.filtros;

  return (
    typeof item?.clave === 'string' &&
    filtros &&
    ['perdi', 'encontre'].includes(filtros.situacion) &&
    ['categoria', 'palabras', 'zona', 'periodo', 'desde', 'hasta'].every(
      (campo) => typeof filtros[campo] === 'string'
    ) &&
    (filtros.ubicacion === null ||
      (Number.isFinite(filtros.ubicacion?.latitud) &&
        Number.isFinite(filtros.ubicacion?.longitud))) &&
    // El radio es opcional (búsquedas guardadas antes de poder elegirlo), pero si está debe ser válido.
    (filtros.radioKm === undefined || radioValido(filtros.radioKm))
  );
}

// Las claves guardadas pueden ser de una versión anterior (sin radio): se recalculan y se descartan repetidas.
function recientesGuardados(datos) {
  const vistas = new Set();

  return datos
    .filter(esBusquedaGuardada)
    .map((item) => ({
      clave: claveBusqueda(item.filtros),
      filtros: item.filtros,
    }))
    .filter((item) => {
      if (vistas.has(item.clave)) {
        return false;
      }

      vistas.add(item.clave);

      return true;
    })
    .slice(0, MAX_RECIENTES);
}

export function SearchProvider({ children }) {
  const { usuario } = useAuth();
  const uid = usuario?.id ? String(usuario.id) : null;
  const [recientes, setRecientes] = useState([]);
  // Cuenta (o null, sin sesión) a la que pertenece `recientes`; undefined hasta la primera carga
  const [recientesDe, setRecientesDe] = useState(undefined);
  const {
    alertas,
    loading: alertasLoading,
    error: alertasError,
    guardando: alertasGuardando,
    recargar: recargarAlertas,
    crearAlerta,
    eliminarAlerta,
    activarAlerta,
  } = useAlertas(usuario?.id);
  const {
    publicaciones: seguidas,
    loading: seguidasLoading,
    error: seguidasError,
    guardando: seguidasGuardando,
    seguir: seguirPublicacion,
    dejarDeSeguir: dejarDeSeguirPublicacion,
    recargar: recargarSeguidas,
  } = useSeguidas(usuario?.id);
  const {
    porAlerta: novedadesPorAlerta,
    porPublicacion: novedadesPorPublicacion,
    porReclamo: novedadesPorReclamo,
    mensajesPorReclamo,
    loading: novedadesLoading,
    error: novedadesError,
    guardando: novedadesGuardando,
    recargar: recargarNovedades,
    marcarAlertaLeida,
    marcarPublicacionLeida,
    marcarReclamoLeido,
  } = useNovedades(usuario?.id);
  const cargando = recientesDe === undefined;
  // Mientras se carga la cuenta nueva no se muestra el historial de la anterior
  const recientesVisibles = recientesDe === uid ? recientes : [];

  const puedeGuardar = useRef(false);
  const colaGuardado = useRef(Promise.resolve());

  useEffect(() => {
    let activo = true;
    puedeGuardar.current = false;

    async function cargarHistorial() {
      AsyncStorage.removeItem(CLAVE_RECIENTES_LEGADA).catch(() => {});

      if (!uid) {
        setRecientes([]);
        setRecientesDe(null);
        return;
      }

      try {
        const texto = await AsyncStorage.getItem(claveRecientes(uid));
        const datos = texto ? JSON.parse(texto) : [];

        if (!Array.isArray(datos)) {
          throw new Error(
            'El historial guardado no tiene el formato esperado.'
          );
        }

        if (activo) {
          setRecientes(recientesGuardados(datos));
          setRecientesDe(uid);

          puedeGuardar.current = true;
        }
      } catch {
        if (activo) {
          setRecientes([]);
          setRecientesDe(uid);

          Alert.alert(
            'Historial no disponible',
            'No se pudo cargar el historial. Podés buscar, pero las búsquedas de esta sesión no se guardarán al cerrar la app.'
          );
        }
      }
    }

    cargarHistorial();

    return () => {
      activo = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || recientesDe !== uid || !puedeGuardar.current) {
      return;
    }

    const texto = JSON.stringify(recientes);
    const clave = claveRecientes(uid);

    colaGuardado.current = colaGuardado.current
      .then(() =>
        AsyncStorage.setItem(clave, texto)
      )
      .catch(() => {
        Alert.alert(
          'No se pudo guardar el historial',
          'Las búsquedas siguen disponibles en esta sesión. Intentá realizar otra búsqueda para volver a guardarlas.'
        );
      });
  }, [recientes, recientesDe, uid]);

  function recordarBusqueda(filtros) {
    if (!uid || recientesDe !== uid) {
      return;
    }

    const clave = claveBusqueda(filtros);

    setRecientes((actuales) =>
      [
        {
          clave,
          filtros: { ...filtros },
        },
        ...actuales.filter(
          (item) => item.clave !== clave
        ),
      ].slice(0, MAX_RECIENTES)
    );
  }

  function eliminarReciente(clave) {
    if (!uid || recientesDe !== uid) {
      return;
    }

    setRecientes((actuales) =>
      actuales.filter((item) => item.clave !== clave)
    );
  }

  if (cargando) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F3F4F6',
          gap: 12,
        }}
      >
        <ActivityIndicator
          size="large"
          color="#1D4ED8"
        />

        <Text style={{ color: '#374151' }}>
          Cargando búsquedas...
        </Text>
      </View>
    );
  }

  return (
    <SearchContext.Provider
      value={{
        recientes: recientesVisibles,
        alertas,
        alertasLoading,
        alertasError,
        alertasGuardando,
        recargarAlertas,
        marcarAlertaLeida,
        crearAlerta,
        eliminarAlerta,
        activarAlerta,
        recordarBusqueda,
        eliminarReciente,
        seguidas,
        seguidasLoading,
        seguidasError,
        seguidasGuardando,
        seguirPublicacion,
        dejarDeSeguirPublicacion,
        recargarSeguidas,
        novedadesPorAlerta,
        novedadesPorPublicacion,
        novedadesPorReclamo,
        mensajesPorReclamo,
        novedadesLoading,
        novedadesError,
        novedadesGuardando,
        recargarNovedades,
        marcarPublicacionLeida,
        marcarReclamoLeido,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const contexto = useContext(SearchContext);

  if (!contexto) {
    throw new Error(
      'useSearch debe usarse dentro de SearchProvider.'
    );
  }

  return contexto;
}
