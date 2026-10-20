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
import { claveBusqueda } from '../data/searchDemo';
import useAlertas from '../hooks/useAlertas';

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
        Number.isFinite(filtros.ubicacion?.longitud)))
  );
}

export function SearchProvider({ children }) {
  const [recientes, setRecientes] = useState([]);
  const {
    alertas,
    loading: alertasLoading,
    error: alertasError,
    crearAlerta,
    eliminarAlerta,
    activarAlerta,
  } = useAlertas();
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
          setRecientes(
            datos.filter(esBusquedaGuardada).slice(0, 5)
          );

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
        crearAlerta,
        eliminarAlerta,
        activarAlerta,
        recordarBusqueda,
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