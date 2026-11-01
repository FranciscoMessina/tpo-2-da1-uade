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
const CLAVE_RECIENTES = '@hallado:busquedas-recientes:v1';

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
    .slice(0, 5);
}

export function SearchProvider({ children }) {
  const { usuario } = useAuth();
  const [recientes, setRecientes] = useState([]);
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
    loading: novedadesLoading,
    error: novedadesError,
    guardando: novedadesGuardando,
    recargar: recargarNovedades,
    marcarAlertaLeida,
    marcarPublicacionLeida,
    marcarReclamoLeido,
  } = useNovedades(usuario?.id);
  const [cargando, setCargando] = useState(true);

  const puedeGuardar = useRef(false);
  const colaGuardado = useRef(Promise.resolve());

  useEffect(() => {
    let activo = true;

    async function cargarHistorial() {
      try {
        const texto = await AsyncStorage.getItem(CLAVE_RECIENTES);
        const datos = texto ? JSON.parse(texto) : [];

        if (!Array.isArray(datos)) {
          throw new Error(
            'El historial guardado no tiene el formato esperado.'
          );
        }

        if (activo) {
          setRecientes(recientesGuardados(datos));

          puedeGuardar.current = true;
        }
      } catch {
        if (activo) {
          Alert.alert(
            'Historial no disponible',
            'No se pudo cargar el historial. Podés buscar, pero las búsquedas de esta sesión no se guardarán al cerrar la app.'
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargarHistorial();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (cargando || !puedeGuardar.current) {
      return;
    }

    const texto = JSON.stringify(recientes);

    colaGuardado.current = colaGuardado.current
      .then(() =>
        AsyncStorage.setItem(CLAVE_RECIENTES, texto)
      )
      .catch(() => {
        Alert.alert(
          'No se pudo guardar el historial',
          'Las búsquedas siguen disponibles en esta sesión. Intentá realizar otra búsqueda para volver a guardarlas.'
        );
      });
  }, [recientes, cargando]);

  function recordarBusqueda(filtros) {
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
      ].slice(0, 5)
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
        recientes,
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
