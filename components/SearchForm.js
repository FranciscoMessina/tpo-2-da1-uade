import { useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  PERIODOS,
  fechaLocal,
  RADIO_KM_INICIAL,
  formatearRadio,
  parsearRadio,
  radioEfectivo,
  radioValido,
  validarFiltros,
} from '../data/busqueda';
import useUbicacionActual from '../hooks/useUbicacionActual';
import { catalogoActual, suscribirCatalogo } from '../services/catalogos';
import { describirUbicacion } from '../services/ubicacion';
import SelectorBarrio from './SelectorBarrio';
import SelectorFecha from './SelectorFecha';
import {
  Aviso,
  Boton,
  Campo,
  GrupoOpciones,
  Seccion,
  Texto,
  espacio,
} from './ui';

// El radio solo existe con GPS: una búsqueda anterior con GPS pero sin radio se refina con el
// inicial, y una por barrio no arrastra ninguno.
function filtrosDeInicio(initialFilters) {
  const { radioKm: _radioKm, ...filtros } = initialFilters;
  const radio = radioEfectivo(initialFilters);

  return radio === undefined ? filtros : { ...filtros, radioKm: radio };
}

export default function SearchForm({
  initialFilters,
  onSubmit,
  submitLabel = 'Buscar coincidencias',
}) {
  const [filtros, setFiltros] = useState(() =>
    filtrosDeInicio(initialFilters)
  );
  // Texto que está escribiendo la persona; null muestra el radio ya guardado en los filtros.
  const [radioEscrito, setRadioEscrito] = useState(null);
  const [error, setError] = useState('');
  // Barrio más cercano al punto de GPS: solo informa, la búsqueda sigue siendo por radio.
  // null = sin consulta; { buscando: true } mientras se calcula; { barrio } con el resultado,
  // donde barrio es null si ninguno del catálogo queda cerca.
  const [cerca, setCerca] = useState(null);
  const consultaGps = useRef(0);
  // Mismo catálogo que el formulario de publicación; sin conexión, el último válido.
  // SelectorBarrio lo inicia por su cuenta.
  const catalogo = useSyncExternalStore(suscribirCatalogo, catalogoActual);
  const {
    obtener: obtenerUbicacion,
    cargando: ubicando,
    error: errorUbicacion,
  } = useUbicacionActual();

  function cambiar(campo, valor) {
    setError('');

    setFiltros((actuales) => ({
      ...actuales,
      [campo]: valor,
    }));
  }

  // Un barrio es un filtro textual: no hay centro ni radio.
  function elegirZona(zona) {
    // «Sin barrio» no quita la ubicación ya tomada: solo elegir un barrio la reemplaza.
    if (zona === '' && filtros.ubicacion) return;

    consultaGps.current += 1;
    setError('');
    setRadioEscrito(null);
    setCerca(null);

    setFiltros(({ radioKm: _radioKm, ...actuales }) => ({
      ...actuales,
      zona,
      ubicacion: null,
    }));
  }

  function cambiarRadio(texto) {
    setError('');
    setRadioEscrito(texto);

    setFiltros((actuales) => ({
      ...actuales,
      radioKm: parsearRadio(texto),
    }));
  }

  async function usarUbicacionActual() {
    setError('');

    const coords = await obtenerUbicacion();

    if (coords) {
      setRadioEscrito(null);
      setCerca({ buscando: true });
      const consulta = ++consultaGps.current;
      describirUbicacion(coords).then(({ barrio }) => {
        if (consulta === consultaGps.current) setCerca({ barrio });
      });

      // El centro queda fijo en este punto. Un radio ya elegido se conserva; si no hay, o es
      // inválido, se vuelve al inicial.
      setFiltros((actuales) => ({
        ...actuales,
        zona: '',
        ubicacion: coords,
        radioKm:
          actuales.ubicacion && radioValido(actuales.radioKm)
            ? actuales.radioKm
            : RADIO_KM_INICIAL,
      }));
    }
  }

  function buscar() {
    const mensaje = validarFiltros(filtros);

    if (mensaje) {
      setError(mensaje);
      return;
    }

    onSubmit({
      ...filtros,
      palabras: filtros.palabras.trim(),
    });
  }

  return (
    <View style={styles.formulario}>
      <Seccion
        titulo="1. ¿Qué te pasó?"
        descripcion={
          filtros.situacion === 'perdi'
            ? 'Vas a ver lo que otras personas encontraron.'
            : 'Vas a ver lo que otras personas perdieron.'
        }
      >
        <GrupoOpciones
          opciones={[
            { valor: 'perdi', nombre: 'Perdí algo' },
            { valor: 'encontre', nombre: 'Encontré algo' },
          ]}
          valor={filtros.situacion}
          onChange={(valor) => cambiar('situacion', valor)}
        />
      </Seccion>

      <Seccion titulo="2. ¿Qué es?">
        <GrupoOpciones
          opciones={catalogo.categorias.map((nombre) => ({
            valor: nombre,
            nombre,
          }))}
          valor={filtros.categoria}
          onChange={(valor) => cambiar('categoria', valor)}
        />

        <Campo
          etiqueta="Palabras clave (opcional)"
          accessibilityLabel="Palabras clave"
          value={filtros.palabras}
          onChangeText={(valor) => cambiar('palabras', valor)}
          placeholder="Por ejemplo: llavero azul"
          maxLength={100}
        />
      </Seccion>

      <Seccion titulo="3. ¿Dónde?" descripcion="Elegí un barrio o una localidad.">
        <SelectorBarrio
          etiqueta="Barrio"
          accessibilityLabel="Barrio"
          placeholder="Elegir barrio"
          valor={filtros.zona}
          onChange={elegirZona}
          permitirVaciar
        />

        <Boton
          titulo={ubicando ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}
          variante="secundario"
          icono="crosshairs-gps"
          cargando={ubicando}
          onPress={usarUbicacionActual}
        />

        {errorUbicacion !== '' && !filtros.ubicacion && (
          <Texto variante="cuerpoChico" tono="peligro" accessibilityRole="alert">
            {errorUbicacion}
          </Texto>
        )}

        {filtros.ubicacion && (
          <Texto variante="cuerpoChico" tono="secundario">
            Usando tu ubicación actual (
            {filtros.ubicacion.latitud.toFixed(4)},{' '}
            {filtros.ubicacion.longitud.toFixed(4)}). Se buscará
            en todos los barrios dentro del radio.
          </Texto>
        )}

        {filtros.ubicacion && cerca?.buscando && (
          <Texto variante="cuerpoChico" tono="secundario">
            Buscando el barrio más cercano…
          </Texto>
        )}

        {filtros.ubicacion && cerca && !cerca.buscando && (
          <Texto variante="cuerpoChico" tono="secundario">
            {cerca.barrio
              ? `Cerca de: ${cerca.barrio}`
              : 'No estás cerca de ningún barrio disponible.'}
          </Texto>
        )}

        {filtros.ubicacion && (
          <Campo
            etiqueta="Radio de búsqueda (km)"
            accessibilityLabel="Radio de búsqueda en kilómetros"
            ayuda="Entre 0,1 y 500 km. El centro queda fijo en este punto: no seguimos tu ubicación después, tampoco para las alertas."
            value={radioEscrito ?? formatearRadio(filtros.radioKm)}
            onChangeText={cambiarRadio}
            placeholder={formatearRadio(RADIO_KM_INICIAL)}
            maxLength={6}
            keyboardType="decimal-pad"
          />
        )}
      </Seccion>

      <Seccion titulo="4. ¿Cuándo?">
        <GrupoOpciones
          opciones={PERIODOS}
          valor={filtros.periodo}
          onChange={(valor) => cambiar('periodo', valor)}
        />

        {filtros.periodo === 'rango' && (
          <View style={styles.fechas}>
            <SelectorFecha
              etiqueta="Desde"
              accessibilityLabel="Fecha desde"
              valor={filtros.desde}
              onChange={(valor) => cambiar('desde', valor)}
              maximo={filtros.hasta && filtros.hasta < fechaLocal() ? filtros.hasta : fechaLocal()}
            />

            <SelectorFecha
              etiqueta="Hasta"
              accessibilityLabel="Fecha hasta"
              valor={filtros.hasta}
              onChange={(valor) => cambiar('hasta', valor)}
              minimo={filtros.desde || undefined}
              maximo={fechaLocal()}
            />
          </View>
        )}
      </Seccion>

      {error !== '' && <Aviso tono="peligro" mensaje={error} accessibilityRole="alert" />}

      <Boton titulo={submitLabel} icono="magnify" onPress={buscar} />
    </View>
  );
}

const styles = StyleSheet.create({
  formulario: { gap: espacio.sm },
  fechas: { gap: espacio.sm },
});
