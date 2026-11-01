import { StyleSheet, View } from 'react-native';
import ImagenPrivada from './ImagenPrivada';
import { FilaDato, Panel, Texto, espacio, radios, tonos } from './ui';

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
      {mostrarMensaje && tieneTexto(texto) && (
        <Panel>
          <Texto variante="cuerpoChico">{texto}</Texto>
        </Panel>
      )}

      {comparar ? (
        <View style={styles.contenedor}>
          {tieneTexto(pub.preguntaVerificacion) && (
            <Texto variante="cuerpoChico" tono="secundario">
              Pregunta: {pub.preguntaVerificacion}
            </Texto>
          )}
          <View style={styles.comparacion}>
            <Panel style={[styles.columna, { backgroundColor: tonos.info.fondo }]}>
              <FilaDato etiqueta="Tu respuesta privada" valor={respuestaDuenio} />
            </Panel>
            <Panel style={[styles.columna, { backgroundColor: tonos.aviso.fondo }]}>
              <FilaDato etiqueta="Respuesta del reclamante" valor={respuesta} />
            </Panel>
          </View>
        </View>
      ) : (
        tieneTexto(respuesta) && (
          <FilaDato etiqueta="Respuesta de verificación" valor={respuesta} />
        )
      )}

      {tieneTexto(barrio) && (
        <FilaDato
          etiqueta={encontradoPorReclamante ? 'Barrio donde lo encontró' : 'Barrio'}
          valor={barrio}
        />
      )}

      {tieneTexto(foto) && (
        <View style={styles.bloque}>
          <Texto variante="leyendaFuerte" tono="secundario">
            {encontradoPorReclamante ? 'Foto del objeto encontrado' : 'Foto de prueba'}
          </Texto>
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
  contenedor: { gap: espacio.xs },
  bloque: { gap: espacio.xxs },
  comparacion: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs },
  columna: { flexGrow: 1, flexBasis: 128 },
  foto: { width: '100%', height: 180, borderRadius: radios.control },
});
