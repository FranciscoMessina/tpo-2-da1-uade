import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { agradecerDevolucion, valorarDevolucion } from '../services/historial';
import { verificarConexion } from '../services/conexion';
import { mensajeErrorApi } from '../services/api';
import { useConexion } from '../context/ConexionContext';
import {
  Boton,
  Campo,
  GrupoOpciones,
  Separador,
  Tarjeta,
  Texto,
  espacio,
} from './ui';

function Bloque({ titulo, children }) {
  return (
    <>
      <Separador />
      <View style={styles.bloque}>
        <Texto variante="subtitulo">{titulo}</Texto>
        {children}
      </View>
    </>
  );
}

export default function CasoResuelto({ caso, navigation, onGuardar }) {
  const { hayConexion } = useConexion();
  const [positiva, setPositiva] = useState(null);
  const [comentario, setComentario] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(agradecimiento) {
    if (guardando) return;
    setGuardando(true);
    try {
      if (!(await verificarConexion())) {
        Alert.alert('Sin conexión', 'Se necesita conexión a internet para guardar tu respuesta.');
        return;
      }
      if (agradecimiento) {
        await agradecerDevolucion(caso.id, mensaje);
      } else {
        await valorarDevolucion(caso.id, positiva, comentario);
      }
      onGuardar();
    } catch (error) {
      Alert.alert('No se pudo guardar', mensajeErrorApi(error));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <View style={styles.datos}>
        <Texto variante="subtitulo">{caso.objeto.titulo}</Texto>
        <Texto variante="cuerpoChico" tono="secundario">
          {caso.objeto.categoria} · {caso.objeto.tipo === 'encontrado' ? 'Encontrado' : 'Perdido'}
        </Texto>
        <Texto variante="cuerpoChico" tono="secundario">
          Devolución: {new Date(caso.fecha).toLocaleDateString('es-AR')}
        </Texto>
        <Texto variante="cuerpoChico" tono="secundario">
          {caso.tipo === 'devolvi' ? 'Recuperó' : 'Devolvió'}: {caso.contraparte.name}
        </Texto>
      </View>

      <Boton
        titulo="Ver perfil"
        variante="terciario"
        chico
        ajustado
        onPress={() => navigation.navigate('PerfilPublico', { usuario: caso.contraparte.id })}
      />

      {caso.valoracion ? (
        <Bloque titulo={`Tu valoración: ${caso.valoracion.positiva ? 'Positiva' : 'Negativa'}`}>
          {!!caso.valoracion.comentario && (
            <Texto variante="cuerpoChico">{caso.valoracion.comentario}</Texto>
          )}
        </Bloque>
      ) : caso.puedeValorar ? (
        <Bloque titulo={`Valorar a ${caso.contraparte.name}`}>
          <Texto variante="cuerpoChico" tono="secundario">
            Hasta el {new Date(caso.limiteValoracion).toLocaleString('es-AR')}.
          </Texto>
          <GrupoOpciones
            opciones={[
              { valor: true, nombre: 'Positiva' },
              { valor: false, nombre: 'Negativa' },
            ]}
            valor={positiva}
            onChange={setPositiva}
            disabled={guardando}
          />
          <Campo
            accessibilityLabel="Comentario de la valoración"
            placeholder="Comentario opcional"
            value={comentario}
            onChangeText={setComentario}
            maxLength={500}
            multiline
            editable={!guardando}
          />
          <Boton
            titulo={guardando ? 'Guardando…' : 'Enviar valoración'}
            cargando={guardando}
            disabled={!hayConexion || positiva === null}
            onPress={() => guardar(false)}
          />
        </Bloque>
      ) : (
        <Texto variante="cuerpoChico" tono="secundario">
          Terminó el plazo de 7 días para valorar.
        </Texto>
      )}

      {caso.agradecimiento ? (
        <Bloque titulo="Tu agradecimiento público">
          <Texto variante="cuerpoChico">{caso.agradecimiento.mensaje}</Texto>
        </Bloque>
      ) : caso.tipo === 'recupere' && (
        <Bloque titulo="Agradecimiento público">
          <Texto variante="cuerpoChico" tono="secundario">
            Se verá en el perfil de {caso.contraparte.name}.
          </Texto>
          <Campo
            accessibilityLabel="Agradecimiento público"
            placeholder="Escribí tu agradecimiento"
            value={mensaje}
            onChangeText={setMensaje}
            maxLength={500}
            multiline
            editable={!guardando}
          />
          <Boton
            titulo="Publicar agradecimiento"
            variante="secundario"
            disabled={guardando || !hayConexion || !mensaje.trim()}
            onPress={() => Alert.alert('Publicar agradecimiento', 'El mensaje será público. ¿Querés publicarlo?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Publicar', onPress: () => guardar(true) },
            ])}
          />
        </Bloque>
      )}
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  datos: { gap: 2 },
  bloque: { gap: espacio.xs },
});
