import { StyleSheet, View } from 'react-native';
import { useColaPublicaciones } from '../context/ColaPublicacionesContext';
import useAuth from '../hooks/useAuth';
import { textoResumenCola } from '../services/colaPublicaciones';
import { Icono, Texto, Tocable, espacio, radios, tonos } from './ui';

function AccionFranja({ titulo, color, onPress }) {
  return (
    <Tocable radio={radios.chico} hitSlop={12} onPress={onPress}>
      <Texto variante="etiqueta" style={[styles.accion, { color }]}>{titulo}</Texto>
    </Tocable>
  );
}

// Franja inferior con lo que quedó pendiente de sincronizar: publicaciones recién enviadas,
// sesión sin validar (restaurada sin conexión) y estado de la cola de publicaciones.
export default function AvisoSincronizacion({ navegar }) {
  const { autenticado, sesionOffline } = useAuth();
  const { resumen, avisos, descartarAviso } = useColaPublicaciones();

  if (!autenticado) return null;

  const textoCola = textoResumenCola(resumen);
  if (!textoCola && !sesionOffline && avisos.length === 0) return null;

  const tonoCola = tonos[resumen.conError > 0 ? 'peligro' : 'aviso'];

  return (
    <View>
      {avisos.map((aviso) => (
        <View key={aviso.id} style={[styles.franja, { backgroundColor: tonos.exito.fondo }]}>
          <Icono nombre="check-circle-outline" tamano={20} color={tonos.exito.texto} />

          <Texto
            variante="cuerpoChico"
            accessibilityRole="alert"
            style={[styles.texto, { color: tonos.exito.texto }]}
          >
            Se publicó "{aviso.titulo}".
          </Texto>

          {aviso.publicacionId && (
            <AccionFranja
              titulo="Ver"
              color={tonos.exito.texto}
              onPress={() => {
                descartarAviso(aviso.id);
                navegar('GestionPublicacion', { publicacionId: aviso.publicacionId });
              }}
            />
          )}

          <Tocable
            radio={radios.pastilla}
            accessibilityLabel="Cerrar aviso"
            hitSlop={12}
            onPress={() => descartarAviso(aviso.id)}
          >
            <Icono nombre="close" tamano={20} color={tonos.exito.texto} />
          </Tocable>
        </View>
      ))}

      {sesionOffline && (
        <View style={[styles.franja, { backgroundColor: tonos.neutro.fondo }]}>
          <Icono nombre="wifi-off" tamano={20} color={tonos.neutro.texto} />

          <Texto variante="cuerpoChico" style={[styles.texto, { color: tonos.neutro.texto }]}>
            Sesión sin validar: estás viendo datos guardados en este dispositivo. Se validará al
            volver la conexión.
          </Texto>
        </View>
      )}

      {textoCola && (
        <Tocable
          radio={0}
          style={[styles.franja, { backgroundColor: tonoCola.fondo }]}
          onPress={() => navegar('PublicacionesPendientes')}
        >
          <Icono
            nombre={resumen.conError > 0 ? 'alert-circle-outline' : 'cloud-upload-outline'}
            tamano={20}
            color={tonoCola.texto}
          />

          <Texto variante="cuerpoChico" style={[styles.texto, { color: tonoCola.texto }]}>
            {textoCola}
          </Texto>

          <Texto variante="etiqueta" style={[styles.accion, { color: tonoCola.texto }]}>Ver</Texto>
        </Tocable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  franja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.sm,
    paddingVertical: espacio.xs,
    paddingHorizontal: espacio.md,
    minHeight: 44,
  },
  texto: { flex: 1 },
  accion: { textDecorationLine: 'underline' },
});
