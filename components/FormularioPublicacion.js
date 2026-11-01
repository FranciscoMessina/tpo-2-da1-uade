import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { conActividadExterna } from '../services/actividadExterna';
import CamaraModal from './CamaraModal';
import {
  fechaLocal,
  fechaValida,
} from '../data/searchDemo';
import useUbicacionActual from '../hooks/useUbicacionActual';
import { useConexion } from '../context/ConexionContext';
import { verificarConexion } from '../services/conexion';
import {
  buscarZona,
  catalogoActual,
  iniciarCatalogo,
  opcionesZona,
  suscribirCatalogo,
} from '../services/catalogos';
import {
  Aviso,
  Boton,
  Campo,
  Fila,
  GrupoOpciones,
  Icono,
  Seccion,
  Tocable,
  colores,
  espacio,
  radios,
} from './ui';

const MAX_FOTOS = 5;

export const FRANJAS = [
  { valor: 'manana', nombre: 'Mañana (6 a 12)' },
  { valor: 'tarde', nombre: 'Tarde (12 a 19)' },
  { valor: 'noche', nombre: 'Noche (19 a 6)' },
];

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
  // El barrio guardado puede estar escrito con otra grafía: se reconoce y se usa su nombre canónico.
  const zona = buscarZona(publicacion.barrio);
  const esBarrioConocido = Boolean(zona);

  return {
    tipo: publicacion.tipo === 'encontrado' ? 'encontre' : 'perdi',
    titulo: publicacion.titulo,
    categoria: publicacion.categoria,
    descripcion: publicacion.descripcion,
    barrio: zona ? zona.nombre : '',
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
  // Mismo catálogo que el formulario de búsqueda; sin conexión, el último válido (no bloquea publicar).
  const catalogo = useSyncExternalStore(suscribirCatalogo, catalogoActual);

  useEffect(() => {
    iniciarCatalogo();
  }, []);

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
  const [camaraAbierta, setCamaraAbierta] = useState(false);

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
      const resultado = await conActividadExterna(() => ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: disponibles,
        quality: 0.7,
      }));

      if (!resultado.canceled) {
        await agregarUris(resultado.assets.map((asset) => asset.uri));
      }
    } catch (e) {
      setErrorFotos('No pudimos abrir la galería.');
    }
  }

  function abrirCamara() {
    setErrorFotos('');

    if (fotos.length >= MAX_FOTOS) {
      setErrorFotos(`Podés subir hasta ${MAX_FOTOS} fotos.`);
      return;
    }

    setCamaraAbierta(true);
  }

  async function usarFotoDeCamara(uri) {
    setCamaraAbierta(false);

    try {
      await agregarUris([uri]);
    } catch {
      setErrorFotos('No pudimos guardar la foto. Probá de nuevo.');
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
    const zona = buscarZona(barrio);

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
        <Seccion titulo={seccion('¿Qué querés publicar?')}>
          <GrupoOpciones
            opciones={[
              { valor: 'perdi', nombre: 'Perdí algo' },
              { valor: 'encontre', nombre: 'Encontré algo' },
            ]}
            valor={tipo}
            onChange={setTipo}
          />
        </Seccion>
      )}

      <Seccion titulo={seccion('¿Qué es?')}>
        <Campo
          etiqueta="Título"
          value={titulo}
          onChangeText={(valor) => {
            setTitulo(valor);
            limpiarError('titulo');
          }}
          error={errores.titulo}
          placeholder="Por ejemplo: Llavero azul con 3 llaves"
          maxLength={80}
        />

        <GrupoOpciones
          etiqueta="Categoría"
          error={errores.categoria}
          opciones={catalogo.categorias.map((nombre) => ({
            valor: nombre,
            nombre,
          }))}
          valor={categoria}
          onChange={(valor) => {
            setCategoria(valor);
            limpiarError('categoria');
          }}
        />

        <Campo
          etiqueta="Descripción"
          value={descripcion}
          onChangeText={(valor) => {
            setDescripcion(valor);
            limpiarError('descripcion');
          }}
          error={errores.descripcion}
          placeholder="Color, marca, señas particulares…"
          multiline
          maxLength={500}
        />
      </Seccion>

      <Seccion titulo={seccion('¿Dónde?')}>
        <GrupoOpciones
          etiqueta="Barrio"
          error={errores.lugar}
          opciones={opcionesZona(catalogo, barrio).map(({ nombre }) => ({
            valor: nombre,
            nombre,
          }))}
          valor={barrio}
          onChange={elegirBarrio}
        />

        <Boton
          titulo={ubicando ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}
          icono="crosshairs-gps"
          variante="secundario"
          cargando={ubicando}
          onPress={usarUbicacion}
        />

        {!!errorUbicacion && !coords && (
          <Aviso tono="peligro" mensaje={errorUbicacion} accessibilityRole="alert" />
        )}

        {coords && (
          <Aviso
            tono="info"
            icono="map-marker-check-outline"
            mensaje={`Ubicación actual: ${coords.latitud.toFixed(4)}, ${coords.longitud.toFixed(4)}`}
          />
        )}

        <Campo
          etiqueta="Dirección exacta (opcional)"
          accessibilityLabel="Dirección exacta"
          ayuda="Solo la ve la persona cuyo reclamo aceptes. El resto de los usuarios ve únicamente el barrio."
          value={direccionExacta}
          onChangeText={setDireccionExacta}
          placeholder="Calle, altura o punto de referencia"
          maxLength={250}
        />
      </Seccion>

      <Seccion titulo={seccion('¿Cuándo?')}>
        <Campo
          etiqueta="Fecha (AAAA-MM-DD)"
          accessibilityLabel="Fecha del suceso"
          value={fecha}
          onChangeText={(valor) => {
            setFecha(valor);
            limpiarError('fecha');
          }}
          error={errores.fecha}
          placeholder={fechaLocal()}
          maxLength={10}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />

        <GrupoOpciones
          chico
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

        <GrupoOpciones
          etiqueta="Franja horaria"
          error={errores.franja}
          opciones={FRANJAS}
          valor={franja}
          onChange={(valor) => {
            setFranja(valor);
            limpiarError('franja');
          }}
        />
      </Seccion>

      <Seccion
        titulo={seccion('Fotos (opcional)')}
        descripcion={`Hasta ${MAX_FOTOS} fotos. ${fotos.length} elegida(s).`}
      >
        {fotos.length > 0 && (
          <Fila>
            {fotos.map((uri) => (
              <View key={uri} style={styles.foto}>
                <Image
                  source={{ uri }}
                  style={styles.imagen}
                  accessibilityLabel="Foto elegida"
                />

                <Tocable
                  radio={radios.pastilla}
                  accessibilityLabel="Quitar foto"
                  colorOnda={colores.ondaInversa}
                  hitSlop={8}
                  onPress={() => quitarFoto(uri)}
                  estiloContenedor={styles.quitar}
                  style={styles.quitarInterior}
                >
                  <Icono nombre="close" tamano={18} color={colores.textoInverso} />
                </Tocable>
              </View>
            ))}
          </Fila>
        )}

        <Boton
          titulo="Sacar una foto"
          icono="camera-outline"
          variante="secundario"
          disabled={fotos.length >= MAX_FOTOS}
          onPress={abrirCamara}
        />
        <Boton
          titulo="Elegir de la galería"
          icono="image-outline"
          variante="secundario"
          disabled={fotos.length >= MAX_FOTOS}
          onPress={agregarFotos}
        />

        {!!errorFotos && <Aviso tono="peligro" mensaje={errorFotos} />}

        <CamaraModal
          visible={camaraAbierta}
          onCerrar={() => setCamaraAbierta(false)}
          onFoto={usarFotoDeCamara}
        />
      </Seccion>

      {esHallazgo && (
        <Seccion
          titulo={seccion('Verificación del dueño')}
          descripcion="Quien diga que el objeto es suyo tendrá que responder tu pregunta. La respuesta nunca se muestra a otras personas: solo la ves vos y sirve para compararla con lo que conteste quien reclame."
        >
          <Campo
            etiqueta="Pregunta de verificación"
            value={pregunta}
            onChangeText={(valor) => {
              setPregunta(valor);
              limpiarError('pregunta');
            }}
            error={errores.pregunta}
            placeholder="Por ejemplo: ¿Qué figura en el llavero?"
            maxLength={200}
          />

          <Campo
            etiqueta="Respuesta (privada)"
            accessibilityLabel="Respuesta de verificación"
            value={respuesta}
            onChangeText={(valor) => {
              setRespuesta(valor);
              limpiarError('respuesta');
            }}
            error={errores.respuesta}
            placeholder="La respuesta correcta"
            maxLength={200}
          />
        </Seccion>
      )}

      {Object.values(errores).some(Boolean) && (
        <Aviso
          tono="peligro"
          mensaje={`Revisá los campos marcados antes de ${editando ? 'guardar' : 'publicar'}.`}
          accessibilityRole="alert"
        />
      )}

      {!!errorEnvio && (
        <Aviso tono="peligro" mensaje={errorEnvio} accessibilityRole="alert" />
      )}

      {!hayConexion && (
        <Aviso
          tono="aviso"
          icono="wifi-off"
          accessibilityRole="alert"
          mensaje={
            puedeEncolar
              ? 'Sin conexión: podés guardar la publicación y se enviará sola cuando vuelva la conexión.'
              : `Sin conexión: se necesita internet para ${
                  editando ? 'guardar los cambios' : 'publicar'
                }.`
          }
        />
      )}

      <Boton
        titulo={
          enviando
            ? 'Guardando…'
            : !hayConexion && puedeEncolar
              ? 'Guardar para enviar después'
              : tituloBoton
        }
        cargando={enviando}
        disabled={!hayConexion && !puedeEncolar}
        onPress={enviar}
      />

      {puedeEncolar && hayConexion && !!errorEnvio && (
        <Boton
          titulo="Guardar para enviar después"
          variante="secundario"
          disabled={enviando}
          onPress={guardarParaDespues}
        />
      )}

      {onCancelar && (
        <Boton
          titulo="Cancelar"
          variante="terciario"
          disabled={enviando}
          onPress={onCancelar}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  foto: { width: 96, height: 96 },
  imagen: {
    width: 96,
    height: 96,
    borderRadius: radios.control,
    backgroundColor: colores.primarioSuave,
  },
  quitar: { position: 'absolute', top: espacio.xxs, right: espacio.xxs },
  quitarInterior: {
    width: 28,
    height: 28,
    backgroundColor: colores.velo,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
