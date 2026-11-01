import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, StyleSheet, View } from 'react-native';
import SelectorFecha from '../components/SelectorFecha';
import CasoResuelto from '../components/CasoResuelto';
import { fechaLocal } from '../data/busqueda';
import { obtenerHistorial } from '../services/historial';
import { mensajeErrorApi } from '../services/api';
import {
  Boton,
  Cargando,
  ErrorConReintento,
  EstadoVacio,
  Paginacion,
  Pestanas,
  Texto,
  colores,
  espacio,
  estilosPantalla,
} from '../components/ui';

export default function HistorialScreen({ navigation }) {
  const [tipo, setTipo] = useState('devolvi');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filtros, setFiltros] = useState({});
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState({ items: [], totalPages: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorFiltro, setErrorFiltro] = useState('');
  const [actualizacion, setActualizacion] = useState(0);

  useFocusEffect(useCallback(() => {
    let activo = true;
    setCargando(true);
    setError('');
    obtenerHistorial({ ...filtros, tipo, page: pagina })
      .then((datos) => { if (activo) setResultado(datos); })
      .catch((e) => { if (activo) setError(mensajeErrorApi(e)); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [tipo, filtros, pagina, actualizacion]));

  function aplicarFiltros() {
    const inicio = desde;
    const fin = hasta;
    if (inicio && fin && inicio > fin) {
      setErrorFiltro('La fecha desde debe ser anterior o igual a hasta.');
      return;
    }
    setErrorFiltro('');
    setPagina(1);
    setFiltros({ desde: inicio || undefined, hasta: fin || undefined });
  }

  function recargar() { setActualizacion((n) => n + 1); }

  return (
    <View style={estilosPantalla.pantalla}>
      <Pestanas
        opciones={[
          { valor: 'devolvi', nombre: 'Devolví' },
          { valor: 'recupere', nombre: 'Recuperé' },
        ]}
        valor={tipo}
        onChange={(valor) => {
          setTipo(valor);
          setPagina(1);
        }}
      />

      <View style={styles.filtros}>
        <Texto variante="etiqueta" tono="secundario">Fecha de devolución</Texto>

        <View style={styles.fila}>
          <View style={styles.fecha}>
            <SelectorFecha
              placeholder="Desde"
              accessibilityLabel="Fecha desde"
              valor={desde}
              onChange={setDesde}
              maximo={hasta || fechaLocal()}
              permitirVaciar
            />
          </View>
          <View style={styles.fecha}>
            <SelectorFecha
              placeholder="Hasta"
              accessibilityLabel="Fecha hasta"
              valor={hasta}
              onChange={setHasta}
              minimo={desde || undefined}
              maximo={fechaLocal()}
              permitirVaciar
            />
          </View>
        </View>

        {!!errorFiltro && <Texto variante="cuerpoChico" tono="peligro">{errorFiltro}</Texto>}

        <View style={styles.fila}>
          <Boton titulo="Filtrar" variante="secundario" chico flexible onPress={aplicarFiltros} />
          <Boton
            titulo="Limpiar fechas"
            variante="terciario"
            chico
            flexible
            onPress={() => {
              setDesde('');
              setHasta('');
              setFiltros({});
              setPagina(1);
              setErrorFiltro('');
            }}
          />
        </View>
      </View>

      {cargando ? (
        <Cargando pantalla />
      ) : error ? (
        <View style={estilosPantalla.centrado}>
          <ErrorConReintento mensaje={error} onReintentar={recargar} />
        </View>
      ) : (
        <FlatList
          data={resultado.items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={estilosPantalla.contenido}
          refreshing={cargando}
          onRefresh={recargar}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <CasoResuelto caso={item} navigation={navigation} onGuardar={recargar} />
          )}
          ListEmptyComponent={
            <EstadoVacio icono="history" mensaje="No hay casos resueltos para estos filtros." />
          }
          ListFooterComponent={resultado.totalPages > 1 ? (
            <Paginacion
              pagina={pagina}
              totalPaginas={resultado.totalPages}
              onCambiar={setPagina}
            />
          ) : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filtros: {
    padding: espacio.md,
    gap: espacio.xs,
    backgroundColor: colores.superficie,
  },
  fila: { flexDirection: 'row', gap: espacio.xs },
  fecha: { flex: 1 },
});
