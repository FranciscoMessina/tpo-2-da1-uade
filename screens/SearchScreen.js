import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { obtenerConsultadasRecientes } from '../services/cacheOffline';
import { StyleSheet, View } from 'react-native';
import SearchForm from '../components/SearchForm';
import { useSearch } from '../context/SearchContext';
import {
  filtrosIniciales,
  resumenBusqueda,
} from '../data/busqueda';
import {
  FilaDeslizable,
  FilaMenu,
  Pantalla,
  Separador,
  Tarjeta,
  Texto,
  espacio,
} from '../components/ui';

export default function SearchScreen({ navigation }) {
  const { recientes, recordarBusqueda, eliminarReciente } = useSearch();
  const [consultadas, setConsultadas] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let activo = true;
      obtenerConsultadasRecientes().then((items) => {
        if (activo) setConsultadas(items);
      });
      return () => {
        activo = false;
      };
    }, [])
  );

  function buscar(filtros) {
    recordarBusqueda(filtros);

    navigation.push('Resultados', {
      filtros,
    });
  }

  return (
    <Pantalla>
      <View style={styles.intro}>
        <Texto variante="pantalla">Encontrá una coincidencia</Texto>
        <Texto tono="secundario">
          Contanos qué pasó para ayudarte a encontrar a la otra persona.
        </Texto>
      </View>

      {recientes.length > 0 && (
        <View style={styles.grupo}>
          <Texto variante="seccion">Últimas búsquedas</Texto>

          <Tarjeta sinRelleno>
            {recientes.map((busqueda, indice) => (
              <View key={busqueda.clave}>
                {indice > 0 && <Separador />}
                <FilaDeslizable onEliminar={() => eliminarReciente(busqueda.clave)}>
                  <FilaMenu
                    icono="history"
                    titulo={resumenBusqueda(busqueda.filtros)}
                    descripcion="Repetir búsqueda"
                    onPress={() => buscar(busqueda.filtros)}
                    accessibilityActions={[{ name: 'delete', label: 'Eliminar búsqueda' }]}
                    onAccessibilityAction={(evento) => {
                      if (evento.nativeEvent.actionName === 'delete') {
                        eliminarReciente(busqueda.clave);
                      }
                    }}
                  />
                </FilaDeslizable>
              </View>
            ))}
          </Tarjeta>
        </View>
      )}

      <SearchForm
        initialFilters={filtrosIniciales()}
        onSubmit={buscar}
      />

      {recientes.length === 0 && (
        <Texto variante="cuerpoChico" tono="secundario" centrado>
          Tus búsquedas aparecerán acá para repetirlas con un toque.
        </Texto>
      )}

      {consultadas.length > 0 && (
        <View style={styles.grupo}>
          <Texto variante="seccion">Publicaciones consultadas (Modo sin conexión)</Texto>
          <Texto variante="cuerpoChico" tono="secundario">
            Guardadas en tu dispositivo. Podés volver a verlas aunque no tengas internet.
          </Texto>

          <Tarjeta sinRelleno>
            {consultadas.slice(0, 5).map((item, indice) => (
              <View key={item.id}>
                {indice > 0 && <Separador />}
                <FilaMenu
                  titulo={item.titulo}
                  descripcion={`${item.tipo === 'encontrado' ? 'Encontrado' : 'Perdido'} · ${item.barrio}`}
                  onPress={() =>
                    navigation.navigate('DetallePublicacion', {
                      publicacionId: item.id,
                    })
                  }
                />
              </View>
            ))}
          </Tarjeta>
        </View>
      )}
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  intro: { gap: espacio.xxs, marginBottom: espacio.xxs },
  grupo: { gap: espacio.xs, marginTop: espacio.xs },
});
