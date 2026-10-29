import { StyleSheet, Text, View } from 'react-native';
import ImagenPrivada from './ImagenPrivada';

const tieneTexto = (valor) => typeof valor === 'string' && valor.trim() !== '';

// Reclamos viejos: la evidencia viajaba embebida en el mensaje, una parte por bloque
function extraerDelMensaje(mensaje) {
  const evidencia = { respuestaVerificacion: null, barrio: null, fotoPrueba: null, texto: '' };
  if (!tieneTexto(mensaje)) return evidencia;

  const restos = [];
  for (const parte of mensaje.split(/\n\n+/)) {
    const barrio = parte.match(/^Barrio donde se encontró:\s*([\s\S]+)$/);
    const respuesta = parte.match(/^Respuesta a verificación:\s*([\s\S]+)$/);
    const foto = parte.match(/^Foto (?:del hallazgo|de comprobación):\s*(\/uploads\/\S+)$/);
    const libre = parte.match(/^(?:Descripción|Mensaje):\s*([\s\S]+)$/);

    if (barrio) evidencia.barrio = barrio[1].trim();
    else if (respuesta) evidencia.respuestaVerificacion = respuesta[1].trim();
    else if (foto) evidencia.fotoPrueba = foto[1];
    else restos.push(libre ? libre[1].trim() : parte.trim());
  }

  evidencia.texto = restos.filter(Boolean).join('\n\n');
  return evidencia;
}

/**
 * Evidencia que acompaña a un reclamo: respuesta de verificación, barrio y foto de prueba.
 *
 * Props:
 * - reclamo: reclamo del backend (respuestaVerificacion, fotoPrueba, barrio, mensaje).
 * - publicacion: publicación del reclamo (por defecto reclamo.publicacion). Se usa para el tipo,
 *   la pregunta y, si es del dueño de un hallazgo, su respuesta privada para comparar.
 * - esDuenio: true si quien mira es el dueño de la publicación (por defecto publicacion.esPropia).
 * - mostrarMensaje: muestra también el mensaje libre del reclamo (por defecto true).
 */
export default function EvidenciaReclamo({
  reclamo,
  publicacion = undefined,
  esDuenio = undefined,
  mostrarMensaje = true,
}) {
  if (!reclamo) return null;

  const pub = publicacion || reclamo.publicacion || null;
  const soyDuenio = esDuenio ?? pub?.esPropia === true;

  const estructurada =
    tieneTexto(reclamo.respuestaVerificacion) ||
    tieneTexto(reclamo.barrio) ||
    tieneTexto(reclamo.fotoPrueba);
  const legado = estructurada ? null : extraerDelMensaje(reclamo.mensaje);

  const respuesta = estructurada ? reclamo.respuestaVerificacion : legado.respuestaVerificacion;
  const barrio = estructurada ? reclamo.barrio : legado.barrio;
  const foto = estructurada ? reclamo.fotoPrueba : legado.fotoPrueba;
  // En reclamos viejos con evidencia embebida, el mensaje libre es lo que sobra
  const texto = legado ? legado.texto : reclamo.mensaje;

  const respuestaDuenio = pub?.tipo === 'encontrado' && soyDuenio ? pub.respuestaVerificacion : null;
  const comparar = tieneTexto(respuestaDuenio) && tieneTexto(respuesta);
  const encontradoPorReclamante = pub?.tipo === 'perdido';

  return (
    <View style={styles.contenedor}>
      {mostrarMensaje && tieneTexto(texto) && <Text style={styles.mensaje}>{texto}</Text>}

      {comparar ? (
        <View>
          {tieneTexto(pub.preguntaVerificacion) && (
            <Text style={styles.pregunta}>Pregunta: {pub.preguntaVerificacion}</Text>
          )}
          <View style={styles.comparacion}>
            <View style={[styles.columna, styles.columnaPropia]}>
              <Text style={styles.etiqueta}>Tu respuesta privada</Text>
              <Text style={styles.valor}>{respuestaDuenio}</Text>
            </View>
            <View style={[styles.columna, styles.columnaReclamante]}>
              <Text style={styles.etiqueta}>Respuesta del reclamante</Text>
              <Text style={styles.valor}>{respuesta}</Text>
            </View>
          </View>
        </View>
      ) : (
        tieneTexto(respuesta) && (
          <View style={styles.bloque}>
            <Text style={styles.etiqueta}>Respuesta de verificación</Text>
            <Text style={styles.valor}>{respuesta}</Text>
          </View>
        )
      )}

      {tieneTexto(barrio) && (
        <View style={styles.bloque}>
          <Text style={styles.etiqueta}>
            {encontradoPorReclamante ? 'Barrio donde lo encontró' : 'Barrio'}
          </Text>
          <Text style={styles.valor}>{barrio}</Text>
        </View>
      )}

      {tieneTexto(foto) && (
        <View style={styles.bloque}>
          <Text style={styles.etiqueta}>
            {encontradoPorReclamante ? 'Foto del objeto encontrado' : 'Foto de prueba'}
          </Text>
          <ImagenPrivada
            ruta={foto}
            style={styles.foto}
            accessibilityLabel="Foto de prueba del reclamo"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 10 },
  mensaje: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  bloque: { gap: 4 },
  etiqueta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  valor: { fontSize: 14, color: '#111827', lineHeight: 20 },
  pregunta: { fontSize: 13, color: '#4B5563', marginBottom: 6 },
  comparacion: { flexDirection: 'row', gap: 8 },
  columna: { flex: 1, padding: 10, borderRadius: 8, gap: 4 },
  columnaPropia: { backgroundColor: '#EFF6FF' },
  columnaReclamante: { backgroundColor: '#FEF3C7' },
  foto: { width: '100%', height: 180, borderRadius: 10 },
});
