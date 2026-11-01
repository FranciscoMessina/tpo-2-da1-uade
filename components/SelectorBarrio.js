import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { FlatList, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  catalogoActual,
  iniciarCatalogo,
  normalizar,
  opcionesZona,
  suscribirCatalogo,
} from '../services/catalogos';
import {
  Campo,
  CampoSeleccion,
  Icono,
  Texto,
  Tocable,
  colores,
  espacio,
  estilosPantalla,
  radios,
  tonos,
} from './ui';

const SIN_BARRIO = 'Sin barrio';

// Desplegable de barrios: se ve como un campo y al tocarlo abre una lista con buscador (sin
// distinguir tildes ni mayúsculas) sobre el catálogo vigente. La lista es un `Modal` propio y sirve
// también dentro de otro modal (filtros, reclamo): un Modal declarado dentro de otro se presenta
// encima. Un barrio guardado que ya no está en el catálogo se muestra tal cual y se puede cambiar.
export default function SelectorBarrio({
  etiqueta = 'Barrio',
  valor = '',
  onChange,
  error = undefined,
  placeholder = 'Elegir barrio',
  accessibilityLabel = undefined,
  disabled = false,
  permitirVaciar = false,
}) {
  const catalogo = useSyncExternalStore(suscribirCatalogo, catalogoActual);
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState('');

  useEffect(() => {
    iniciarCatalogo();
  }, []);

  const zonas = useMemo(() => opcionesZona(catalogo, valor), [catalogo, valor]);
  const opciones = useMemo(() => {
    const clave = normalizar(consulta);
    const filtradas = clave
      ? zonas.filter((zona) => normalizar(zona.nombre).includes(clave))
      : zonas;

    return permitirVaciar && !clave ? [{ nombre: '', vacio: true }, ...filtradas] : filtradas;
  }, [zonas, consulta, permitirVaciar]);
  const actual = normalizar(valor ?? '');

  function abrir() {
    setConsulta('');
    setAbierto(true);
  }

  function elegir(nombre) {
    setAbierto(false);
    onChange(nombre);
  }

  return (
    <View>
      <CampoSeleccion
        etiqueta={etiqueta}
        valor={valor ?? ''}
        placeholder={placeholder}
        error={error}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        onPress={abrir}
      />

      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.barra}>
            <Tocable
              radio={radios.pastilla}
              onPress={() => setAbierto(false)}
              accessibilityLabel="Cerrar"
              style={styles.cerrar}
            >
              <Icono nombre="close" tamano={24} />
            </Tocable>

            <Texto variante="seccion" numberOfLines={1} style={styles.titulo}>
              {etiqueta}
            </Texto>
          </View>

          <View style={styles.buscador}>
            <Campo
              accessibilityLabel="Buscar barrio"
              placeholder="Buscar barrio"
              value={consulta}
              onChangeText={setConsulta}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            data={opciones}
            keyExtractor={(zona) => (zona.vacio ? '__vacio__' : zona.nombre)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.lista}
            ListEmptyComponent={
              <Texto tono="secundario" style={styles.vacio}>
                No hay barrios que coincidan con la búsqueda.
              </Texto>
            }
            renderItem={({ item }) => {
              const seleccionado = item.vacio ? actual === '' : normalizar(item.nombre) === actual;

              return (
                <Tocable
                  radio={radios.chico}
                  onPress={() => elegir(item.nombre)}
                  accessibilityLabel={item.vacio ? SIN_BARRIO : item.nombre}
                  accessibilityState={{ selected: seleccionado }}
                  style={[styles.fila, seleccionado && styles.seleccionada]}
                >
                  <Texto
                    variante={seleccionado ? 'etiqueta' : 'cuerpo'}
                    style={[styles.nombre, seleccionado && { color: tonos.info.texto }]}
                  >
                    {item.vacio ? SIN_BARRIO : item.nombre}
                  </Texto>
                  {seleccionado && <Icono nombre="check" tamano={20} color={tonos.info.texto} />}
                </Tocable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { ...estilosPantalla.pantalla, backgroundColor: colores.superficie },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xxs,
    paddingHorizontal: espacio.xxs,
    minHeight: 56,
  },
  cerrar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  titulo: { flex: 1 },
  buscador: { paddingHorizontal: espacio.md, paddingBottom: espacio.xs },
  lista: { paddingHorizontal: espacio.xs, paddingBottom: espacio.lg },
  fila: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    paddingHorizontal: espacio.sm,
    paddingVertical: espacio.xs,
  },
  seleccionada: { backgroundColor: colores.primarioSuave },
  nombre: { flex: 1 },
  vacio: { padding: espacio.md },
});
