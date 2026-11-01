import { useEffect, useState, useSyncExternalStore } from 'react';
import { FlatList, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { catalogoActual, iniciarCatalogo, suscribirCatalogo } from '../services/catalogos';
import {
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

// Desplegable de categorías: se ve como un campo y al tocarlo abre una lista con las categorías del
// catálogo vigente (son pocas, por eso no lleva buscador). Es un `Modal` propio, como
// SelectorBarrio, y sirve también dentro de otro modal. Una categoría guardada que ya no está en el
// catálogo se muestra tal cual y se puede cambiar.
export default function SelectorCategoria({
  etiqueta = 'Categoría',
  valor = '',
  onChange,
  error = undefined,
  placeholder = 'Elegir categoría',
  accessibilityLabel = undefined,
  disabled = false,
}) {
  const catalogo = useSyncExternalStore(suscribirCatalogo, catalogoActual);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    iniciarCatalogo();
  }, []);

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
        onPress={() => setAbierto(true)}
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

          <FlatList
            data={catalogo.categorias}
            keyExtractor={(nombre) => nombre}
            contentContainerStyle={styles.lista}
            renderItem={({ item }) => {
              const seleccionada = item === valor;

              return (
                <Tocable
                  radio={radios.chico}
                  onPress={() => elegir(item)}
                  accessibilityLabel={item}
                  accessibilityState={{ selected: seleccionada }}
                  style={[styles.fila, seleccionada && styles.seleccionada]}
                >
                  <Texto
                    variante={seleccionada ? 'etiqueta' : 'cuerpo'}
                    style={[styles.nombre, seleccionada && { color: tonos.info.texto }]}
                  >
                    {item}
                  </Texto>
                  {seleccionada && <Icono nombre="check" tamano={20} color={tonos.info.texto} />}
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
});
