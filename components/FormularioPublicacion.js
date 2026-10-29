import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  CATEGORIAS,
  ZONAS,
  fechaLocal,
  fechaValida,
} from '../data/searchDemo';
import useUbicacionActual from '../hooks/useUbicacionActual';
import { useConexion } from '../context/ConexionContext';
import { verificarConexion } from '../services/conexion';

const MAX_FOTOS = 5;

export const FRANJAS = [
  { valor: 'manana', nombre: 'Mañana (6 a 12)' },
  { valor: 'tarde', nombre: 'Tarde (12 a 19)' },
  { valor: 'noche', nombre: 'Noche (19 a 6)' },
];

function Opciones({ opciones, valor, onChange }) {
  return (
    <View style={styles.options}>
      {opciones.map((opcion) => (
        <Pressable
          key={opcion.valor}
          accessibilityRole="button"
          accessibilityState={{
            selected: valor === opcion.valor,
          }}
          onPress={() => onChange(opcion.valor)}
          style={({ pressed }) => [
            styles.option,
            valor === opcion.valor && styles.selected,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.optionText,
              valor === opcion.valor && styles.selectedText,
            ]}
          >
            {opcion.nombre}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ayer() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - 1);
  return fechaLocal(fecha);
}

/**
 * Convierte una publicación del servidor (detalle propio) en los valores iniciales del formulario.
 * Si el barrio no es uno de la lista (p. ej. «Ubicación actual») se usan las coordenadas guardadas.
 */
export function valoresDesdePublicacion(publicacion) {
  const esBarrioConocido = ZONAS.some((z) => z.nombre === publicacion.barrio);

  return {
    tipo: publicacion.tipo === 'encontrado' ? 'encontre' : 'perdi',
    titulo: publicacion.titulo,
    categoria: publicacion.categoria,
    descripcion: publicacion.descripcion,
    barrio: esBarrioConocido ? publicacion.barrio : '',
    coords:
      !esBarrioConocido && publicacion.ubicacion
        ? {
            latitud: publicacion.ubicacion.latitud,
            longitud: publicacion.ubicacion.longitud,
          }
        : null,
    fecha: publicacion.fecha,
    franja: publicacion.franja,
    direccionExacta: publicacion.direccionExacta || '',
    fotos: publicacion.fotos || [],
    preguntaVerificacion: publicacion.preguntaVerificacion || '',
    respuestaVerificacion: publicacion.respuestaVerificacion || '',
  };
}

/**
 * Formulario de publicación compartido por el alta y la edición.
 * `onEnviar(datos)` recibe los datos ya validados (ver `armarCuerpoPublicacion`
 * en services/publicaciones.js) y debe devolver una promesa; el padre decide qué hacer al terminar.
 * En modo «editar» el tipo no se puede cambiar.
 *
 * Solo para el alta (opcionales):
 *  - `onEncolar(datos)`: si hay, sin conexión el botón principal pasa a «Guardar para enviar después»
 *    (y se ofrece también tras un error de envío) en lugar de quedar bloqueado.
 *  - `alCambiar(valores)`: se llama con los valores actuales del formulario en cada cambio
 *    (la pantalla los usa para el borrador automático).
 *  - `copiarFoto(uri)`: convierte la URI que devuelve el selector en una copia propia de la app.
 *  - `alQuitarFoto(uri)`: se llama al quitar una foto, para borrar su copia.
 */
export default function FormularioPublicacion({
  modo = 'crear',
  valoresIniciales = {},
  enviando = false,
  errorEnvio = '',
  textoEnviar = undefined,
  onEnviar,
  onCancelar = undefined,
  tipoInicial = 'perdi',
  onEncolar = undefined,
  alCambiar = undefined,
  copiarFoto = undefined,
  alQuitarFoto = undefined,
}) {
  const editando = modo === 'editar';
  const puedeEncolar = !editando && typeof onEncolar === 'function';
  const { hayConexion } = useConexion();

  const [tipo, setTipo] = useState(valoresIniciales.tipo ?? tipoInicial);
  const [titulo, setTitulo] = useState(valoresIniciales.titulo ?? '');
  const [categoria, setCategoria] = useState(valoresIniciales.categoria ?? '');
  const [descripcion, setDescripcion] = useState(
    valoresIniciales.descripcion ?? ''
  );
  const [barrio, setBarrio] = useState(valoresIniciales.barrio ?? '');
  const [coords, setCoords] = useState(valoresIniciales.coords ?? null);
  const [direccionExacta, setDireccionExacta] = useState(
    valoresIniciales.direccionExacta ?? ''
  );
  const [fecha, setFecha] = useState(valoresIniciales.fecha ?? fechaLocal());
  const [franja, setFranja] = useState(valoresIniciales.franja ?? '');
  const [fotos, setFotos] = useState(valoresIniciales.fotos ?? []);
  const [pregunta, setPregunta] = useState(
    valoresIniciales.preguntaVerificacion ?? ''
  );
  const [respuesta, setRespuesta] = useState(
    valoresIniciales.respuestaVerificacion ?? ''
  );
  const [errores, setErrores] = useState({});
  const [errorFotos, setErrorFotos] = useState('');

  const {
    obtener,
    cargando: ubicando,
    error: errorUbicacion,
  } = useUbicacionActual();

  const esHallazgo = tipo === 'encontre';

  // Cada cambio se informa a la pantalla (borrador automático); el callback vive en una
  // ref para que cambiarlo no dispare el efecto
  const alCambiarRef = useRef(alCambiar);
  alCambiarRef.current = alCambiar;

  useEffect(() => {
    alCambiarRef.current?.({
      tipo,
      titulo,
      categoria,
      descripcion,
      barrio,
      coords,
      direccionExacta,
      fecha,
      franja,
      fotos,
      preguntaVerificacion: pregunta,
      respuestaVerificacion: respuesta,
    });
  }, [
    tipo,
    titulo,
    categoria,
    descripcion,
    barrio,
    coords,
    direccionExacta,
    fecha,
    franja,
    fotos,
    pregunta,
    respuesta,
  ]);

  // Los títulos de sección se numeran según las que se muestran
  let numeroSeccion = 0;
  const seccion = (texto) => `${++numeroSeccion}. ${texto}`;

  function limpiarError(campo) {
    setErrores((actuales) => ({ ...actuales, [campo]: '' }));
  }

  function elegirBarrio(nombre) {
    setBarrio(nombre);
    setCoords(null);
    limpiarError('lugar');
  }

  async function usarUbicacion() {
    const resultado = await obtener();

    if (resultado) {
      setCoords(resultado);
      setBarrio('');
      limpiarError('lugar');
    }
  }

  async function agregarUris(uris) {
    // Las URIs del selector pueden ser temporales: se copian a la app antes de usarlas
    const elegidas = uris.slice(0, Math.max(0, MAX_FOTOS - fotos.length));
    const propias = copiarFoto
      ? await Promise.all(elegidas.map((uri) => copiarFoto(uri)))
      : elegidas;

    setFotos((actuales) =>
      [...actuales, ...propias.filter((uri) => !actuales.includes(uri))].slice(
        0,
        MAX_FOTOS
      )
    );
  }

  async function agregarFotos() {
    setErrorFotos('');

    const disponibles = MAX_FOTOS - fotos.length;

    if (disponibles <= 0) {
      setErrorFotos(`Podés subir hasta ${MAX_FOTOS} fotos.`);
      return;
    }

    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: disponibles,
        quality: 0.7,
      });

      if (!resultado.canceled) {
        await agregarUris(resultado.assets.map((asset) => asset.uri));
      }
    } catch (e) {
      setErrorFotos('No pudimos abrir la galería.');
    }
  }

  async function sacarFoto() {
    setErrorFotos('');

    if (fotos.length >= MAX_FOTOS) {
      setErrorFotos(`Podés subir hasta ${MAX_FOTOS} fotos.`);
      return;
    }

    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();

      if (!permiso.granted) {
        setErrorFotos(
          permiso.canAskAgain
            ? 'Necesitamos tu permiso para usar la cámara. Podés elegir fotos de la galería.'
            : 'El permiso de la cámara está bloqueado. Habilitalo desde los ajustes del dispositivo o elegí fotos de la galería.'
        );
        return;
      }

      const resultado = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });

      if (!resultado.canceled && resultado.assets?.length) {
        await agregarUris([resultado.assets[0].uri]);
      }
    } catch (e) {
      setErrorFotos('No pudimos abrir la cámara.');
    }
  }

  function quitarFoto(uri) {
    setFotos((actuales) => actuales.filter((f) => f !== uri));
    alQuitarFoto?.(uri);
  }

  function validar() {
    const nuevos = {};

    if (titulo.trim().length < 3) {
      nuevos.titulo = 'Escribí un título de al menos 3 caracteres.';
    }

    if (!categoria) {
      nuevos.categoria = 'Elegí una categoría.';
    }

    if (descripcion.trim().length < 10) {
      nuevos.descripcion =
        'Describí el objeto con al menos 10 caracteres.';
    }

    if (!barrio && !coords) {
      nuevos.lugar = 'Elegí un barrio o usá tu ubicación actual.';
    }

    if (!fechaValida(fecha)) {
      nuevos.fecha = 'Ingresá una fecha válida (AAAA-MM-DD).';
    } else if (fecha > fechaLocal()) {
      nuevos.fecha = 'La fecha no puede ser futura.';
    }

    if (!franja) {
      nuevos.franja = 'Elegí una franja horaria.';
    }

    if (esHallazgo) {
      if (pregunta.trim().length < 3) {
        nuevos.pregunta =
          'Escribí una pregunta de verificación de al menos 3 caracteres.';
      }

      if (!respuesta.trim()) {
        nuevos.respuesta = 'Escribí la respuesta a tu pregunta.';
      }
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  function armarDatos() {
    const zona = ZONAS.find((z) => z.nombre === barrio);

    return {
      tipo,
      titulo: titulo.trim(),
      categoria,
      descripcion: descripcion.trim(),
      barrio,
      ubicacion: coords
        ? coords
        : zona
          ? { latitud: zona.latitud, longitud: zona.longitud }
          : null,
      direccionExacta: direccionExacta.trim(),
      fecha,
      franja,
      fotos,
      preguntaVerificacion: esHallazgo ? pregunta.trim() : '',
      respuestaVerificacion: esHallazgo ? respuesta.trim() : '',
    };
  }

  // Valida el formulario y lo guarda en la cola de envíos pendientes
  async function guardarParaDespues() {
    if (!validar()) {
      return;
    }

    await onEncolar(armarDatos());
  }

  async function enviar() {
    if (!validar()) {
      return;
    }

    if (!(await verificarConexion())) {
      if (puedeEncolar) {
        await onEncolar(armarDatos());
        return;
      }

      Alert.alert(
        'Sin conexión',
        'Se necesita conexión a internet para guardar la publicación.'
      );
      return;
    }

    await onEnviar(armarDatos());
  }

  const tituloBoton =
    textoEnviar ??
    (tipo === 'perdi' ? 'Publicar mi pérdida' : 'Publicar mi hallazgo');

  return (
    <>
      {!editando && (
        <View style={styles.section}>
          <Text style={styles.title}>{seccion('¿Qué querés publicar?')}</Text>

          <Opciones
            opciones={[
              { valor: 'perdi', nombre: 'Perdí algo' },
              { valor: 'encontre', nombre: 'Encontré algo' },
            ]}
            valor={tipo}
            onChange={setTipo}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.title}>{seccion('¿Qué es?')}</Text>

        <Text style={styles.label}>Título</Text>

        <TextInput
          accessibilityLabel="Título"
          style={styles.input}
          value={titulo}
          onChangeText={(valor) => {
            setTitulo(valor);
            limpiarError('titulo');
          }}
          placeholder="Por ejemplo: Llavero azul con 3 llaves"
          placeholderTextColor="#6B7280"
          maxLength={80}
        />
        {!!errores.titulo && (
          <Text style={styles.error}>{errores.titulo}</Text>
        )}

        <Text style={styles.label}>Categoría</Text>

        <Opciones
          opciones={CATEGORIAS.map((nombre) => ({
            valor: nombre,
            nombre,
          }))}
          valor={categoria}
          onChange={(valor) => {
            setCategoria(valor);
            limpiarError('categoria');
          }}
        />
        {!!errores.categoria && (
          <Text style={styles.error}>{errores.categoria}</Text>
        )}

        <Text style={styles.label}>Descripción</Text>

        <TextInput
          accessibilityLabel="Descripción"
          style={[styles.input, styles.multiline]}
          value={descripcion}
          onChangeText={(valor) => {
            setDescripcion(valor);
            limpiarError('descripcion');
          }}
          placeholder="Color, marca, señas particulares…"
          placeholderTextColor="#6B7280"
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
        {!!errores.descripcion && (
          <Text style={styles.error}>{errores.descripcion}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>{seccion('¿Dónde?')}</Text>

        <Opciones
          opciones={ZONAS.map(({ nombre }) => ({
            valor: nombre,
            nombre,
          }))}
          valor={barrio}
          onChange={elegirBarrio}
        />

        <Button
          title={
            ubicando
              ? 'Obteniendo ubicación…'
              : 'Usar mi ubicación actual'
          }
          disabled={ubicando}
          onPress={usarUbicacion}
        />

        {!!errorUbicacion && !coords && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorUbicacion}
          </Text>
        )}

        {coords && (
          <Text style={styles.help}>
            Ubicación actual: {coords.latitud.toFixed(4)},{' '}
            {coords.longitud.toFixed(4)}
          </Text>
        )}

        {!!errores.lugar && (
          <Text style={styles.error}>{errores.lugar}</Text>
        )}

        <Text style={styles.label}>Dirección exacta (opcional)</Text>

        <TextInput
          accessibilityLabel="Dirección exacta"
          style={styles.input}
          value={direccionExacta}
          onChangeText={setDireccionExacta}
          placeholder="Calle, altura o punto de referencia"
          placeholderTextColor="#6B7280"
          maxLength={250}
        />
        <Text style={styles.help}>
          Solo la ve la persona cuyo reclamo aceptes. El resto de los usuarios
          ve únicamente el barrio.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>{seccion('¿Cuándo?')}</Text>

        <Text style={styles.label}>Fecha (AAAA-MM-DD)</Text>

        <TextInput
          accessibilityLabel="Fecha del suceso"
          style={styles.input}
          value={fecha}
          onChangeText={(valor) => {
            setFecha(valor);
            limpiarError('fecha');
          }}
          placeholder={fechaLocal()}
          placeholderTextColor="#6B7280"
          maxLength={10}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />

        <Opciones
          opciones={[
            { valor: fechaLocal(), nombre: 'Hoy' },
            { valor: ayer(), nombre: 'Ayer' },
          ]}
          valor={fecha}
          onChange={(valor) => {
            setFecha(valor);
            limpiarError('fecha');
          }}
        />
        {!!errores.fecha && (
          <Text style={styles.error}>{errores.fecha}</Text>
        )}

        <Text style={styles.label}>Franja horaria</Text>

        <Opciones
          opciones={FRANJAS}
          valor={franja}
          onChange={(valor) => {
            setFranja(valor);
            limpiarError('franja');
          }}
        />
        {!!errores.franja && (
          <Text style={styles.error}>{errores.franja}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>{seccion('Fotos (opcional)')}</Text>

        <Text style={styles.help}>
          Hasta {MAX_FOTOS} fotos. {fotos.length} elegida(s).
        </Text>

        {fotos.length > 0 && (
          <View style={styles.photos}>
            {fotos.map((uri) => (
              <View key={uri} style={styles.photoBox}>
                <Image
                  source={{ uri }}
                  style={styles.photo}
                  accessibilityLabel="Foto elegida"
                />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quitar foto"
                  onPress={() => quitarFoto(uri)}
                  style={styles.remove}
                >
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Button
          title="Sacar una foto"
          disabled={fotos.length >= MAX_FOTOS}
          onPress={sacarFoto}
        />

        <Button
          title="Elegir de la galería"
          disabled={fotos.length >= MAX_FOTOS}
          onPress={agregarFotos}
        />

        {!!errorFotos && (
          <Text style={styles.error}>{errorFotos}</Text>
        )}
      </View>

      {esHallazgo && (
        <View style={styles.section}>
          <Text style={styles.title}>{seccion('Verificación del dueño')}</Text>

          <Text style={styles.help}>
            Quien diga que el objeto es suyo tendrá que responder tu pregunta.
            La respuesta nunca se muestra a otras personas: solo la ves vos y
            sirve para compararla con lo que conteste quien reclame.
          </Text>

          <Text style={styles.label}>Pregunta de verificación</Text>

          <TextInput
            accessibilityLabel="Pregunta de verificación"
            style={styles.input}
            value={pregunta}
            onChangeText={(valor) => {
              setPregunta(valor);
              limpiarError('pregunta');
            }}
            placeholder="Por ejemplo: ¿Qué figura en el llavero?"
            placeholderTextColor="#6B7280"
            maxLength={200}
          />
          {!!errores.pregunta && (
            <Text style={styles.error}>{errores.pregunta}</Text>
          )}

          <Text style={styles.label}>Respuesta (privada)</Text>

          <TextInput
            accessibilityLabel="Respuesta de verificación"
            style={styles.input}
            value={respuesta}
            onChangeText={(valor) => {
              setRespuesta(valor);
              limpiarError('respuesta');
            }}
            placeholder="La respuesta correcta"
            placeholderTextColor="#6B7280"
            maxLength={200}
          />
          {!!errores.respuesta && (
            <Text style={styles.error}>{errores.respuesta}</Text>
          )}
        </View>
      )}

      {Object.values(errores).some(Boolean) && (
        <Text accessibilityRole="alert" style={styles.error}>
          Revisá los campos marcados antes de {editando ? 'guardar' : 'publicar'}.
        </Text>
      )}

      {!!errorEnvio && (
        <Text accessibilityRole="alert" style={styles.error}>
          {errorEnvio}
        </Text>
      )}

      {!hayConexion && (
        <Text accessibilityRole="alert" style={styles.avisoOffline}>
          {puedeEncolar
            ? '⚠️ Sin conexión: podés guardar la publicación y se enviará sola cuando vuelva la conexión.'
            : `⚠️ Sin conexión: se necesita internet para ${
                editando ? 'guardar los cambios' : 'publicar'
              }.`}
        </Text>
      )}

      <Button
        title={
          enviando
            ? 'Guardando…'
            : !hayConexion && puedeEncolar
              ? 'Guardar para enviar después'
              : tituloBoton
        }
        disabled={enviando || (!hayConexion && !puedeEncolar)}
        onPress={enviar}
      />

      {puedeEncolar && hayConexion && !!errorEnvio && (
        <Button
          title="Guardar para enviar después"
          color="#6B7280"
          disabled={enviando}
          onPress={guardarParaDespues}
        />
      )}

      {onCancelar && (
        <Button
          title="Cancelar"
          color="#6B7280"
          disabled={enviando}
          onPress={onCancelar}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#1D4ED8',
  },
  pressed: {
    opacity: 0.7,
  },
  optionText: {
    fontSize: 15,
    color: '#374151',
  },
  selectedText: {
    color: '#1D4ED8',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    color: '#4B5563',
  },
  help: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 48,
  },
  multiline: {
    minHeight: 100,
  },
  error: {
    color: '#DC2626',
    fontSize: 15,
  },
  avisoOffline: {
    fontSize: 14,
    color: '#991B1B',
    fontWeight: '600',
    textAlign: 'center',
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoBox: {
    width: 90,
    height: 90,
  },
  photo: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
