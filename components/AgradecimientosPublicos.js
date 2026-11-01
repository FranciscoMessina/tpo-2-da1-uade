import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { obtenerAgradecimientos } from '../services/historial';
import { mensajeErrorApi } from '../services/api';
import {
  Cargando,
  ErrorConReintento,
  Paginacion,
  Seccion,
  Separador,
  Texto,
  espacio,
} from './ui';

export default function AgradecimientosPublicos({ usuarioId }) {
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState({ items: [], totalPages: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useFocusEffect(useCallback(() => {
    let activo = true;
    setCargando(true);
    setError('');
    obtenerAgradecimientos(usuarioId, pagina)
      .then((datos) => { if (activo) setResultado(datos); })
      .catch((e) => { if (activo) setError(mensajeErrorApi(e)); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [usuarioId, pagina, intento]));

  return (
    <Seccion titulo="Agradecimientos">
      {cargando ? (
        <Cargando chico />
      ) : error ? (
        <ErrorConReintento mensaje={error} onReintentar={() => setIntento((n) => n + 1)} />
      ) : (
        <>
          {resultado.items.length === 0 && (
            <Texto variante="cuerpoChico" tono="secundario">
              Todavía no recibió agradecimientos.
            </Texto>
          )}

          {resultado.items.map((item, indice) => (
            <View key={item.id} style={styles.item}>
              {indice > 0 && <Separador />}
              <Texto variante="etiqueta">{item.autor.name}</Texto>
              <Texto variante="cuerpoChico">{item.mensaje}</Texto>
              <Texto variante="leyenda" tono="secundario">
                {new Date(item.createdAt).toLocaleDateString('es-AR')}
              </Texto>
            </View>
          ))}

          {resultado.totalPages > 1 && (
            <Paginacion
              pagina={pagina}
              totalPaginas={resultado.totalPages}
              onCambiar={setPagina}
            />
          )}
        </>
      )}
    </Seccion>
  );
}

const styles = StyleSheet.create({
  item: { gap: espacio.xxs },
});
