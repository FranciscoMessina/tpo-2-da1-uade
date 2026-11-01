import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Image, Keyboard, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { conActividadExterna } from '../services/actividadExterna';
import CamaraModal from './CamaraModal';
import SelectorBarrio from './SelectorBarrio';
import SelectorFecha from './SelectorFecha';
import { fechaLocal, fechaValida } from '../data/busqueda';
import useUbicacionActual from '../hooks/useUbicacionActual';
import { useConexion } from '../context/ConexionContext';
import { verificarConexion } from '../services/conexion';
import {
  buscarZona,
  catalogoActual,
  coordenadasPropias,
  iniciarCatalogo,
  suscribirCatalogo,
} from '../services/catalogos';
import { describirUbicacion } from '../services/ubicacion';
import {
  Aviso,
  Boton,
  Campo,
  Fila,
  GrupoOpciones,
  Icono,
  IndicadorPasos,
  Seccion,
  Tocable,
  colores,
  espacio,
  radios,
} from './ui';

const MAX_FOTOS = 5;

// Títulos de los pasos del asistente, en el orden de la consigna. «tipo» no aparece al editar y
// «verificacion» solo en los hallazgos.
const TITULOS_PASO = {
  tipo: '¿Qué querés publicar?',
  fotos: 'Fotos (opcional)',
  datos: '¿Qué es y cuándo pasó?',
  ubicacion: '¿Dónde fue?',
  verificacion: 'Verificación del dueño',
};

// Campos (claves de `errores`) que valida cada paso
const CAMPOS_PASO = {
  tipo: [],
  fotos: [],
  datos: ['titulo', 'categoria', 'descripcion', 'fecha', 'hora'],
  ubicacion: ['barrio', 'direccion'],
  verificacion: ['pregunta', 'respuesta'],
};

const MENSAJE_HORA_FUTURA = 'La hora no puede ser futura: el suceso es de hoy.';

const dos = (n) => String(n).padStart(2, '0');

function horaActual() {
  const ahora = new Date();
  return `${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;
}

// Si el suceso es de hoy, la hora no puede ser posterior a la actual
function esHoraFutura(fecha, hora) {
  return Boolean(hora) && fecha === fechaLocal() && hora > horaActual();
}

function ayer() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - 1);
  return fechaLocal(fecha);
}

/**
 * Convierte una publicación del servidor (detalle propio) en los valores iniciales del formulario.
 * Un barrio que ya no es uno de la lista (p. ej. el antiguo «Ubicación actual») queda vacío para
 * que se elija uno; sus coordenadas guardadas se conservan.
 */
export function valoresDesdePublicacion(publicacion) {
  // El barrio guardado puede estar escrito con otra grafía: se reconoce y se usa su nombre canónico.
  const zona = buscarZona(publicacion.barrio);

  return {
    tipo: publicacion.tipo === 'encontrado' ? 'encontre' : 'perdi',
    titulo: publicacion.titulo,
    categoria: publicacion.categoria,
    descripcion: publicacion.descripcion,
    barrio: zona ? zona.nombre : '',
    coords: coordenadasPropias(publicacion.barrio, publicacion.ubicacion),
    fecha: publicacion.fecha,
    hora: publicacion.hora || '',
    direccionExacta: publicacion.direccionExacta || '',
    fotos: publicacion.fotos || [],
    preguntaVerificacion: publicacion.preguntaVerificacion || '',
    respuestaVerificacion: publicacion.respuestaVerificacion || '',
  };
}

/**
 * Formulario de publicación compartido por el alta y la edición, como asistente de pasos: tipo,
 * fotos, datos, ubicación y verificación (solo hallazgos).
 * `onEnviar(datos)` recibe los datos ya validados (ver `armarCuerpoPublicacion`
 * en services/publicaciones.js) y debe devolver una promesa; el padre decide qué hacer al terminar.
 * En modo «editar» el tipo no se puede cambiar y no hay paso de tipo.
 *
 * Opcional:
 *  - `alCambiarPaso()`: se llama al cambiar de paso; la pantalla vuelve el desplazamiento al inicio.
 *
 * Solo para el alta (opcionales):
 *  - `onEncolar(datos)`: si hay, sin conexión el botón principal del último paso pasa a
 *    «Guardar para enviar después» (y se ofrece también tras un error de envío) en lugar de quedar bloqueado.
 *  - `alCambiar(valores)`: se llama con los valores actuales del formulario, incluido el `paso`, en cada
 *    cambio (la pantalla los usa para el borrador automático). `valoresIniciales.paso` retoma ese paso.
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
  alCambiarPaso = undefined,
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
  const [fecha, setFecha] = useState(valoresIniciales.fecha || fechaLocal());
  const [hora, setHora] = useState(valoresIniciales.hora ?? '');
  const [fotos, setFotos] = useState(valoresIniciales.fotos ?? []);
  const [pregunta, setPregunta] = useState(
    valoresIniciales.preguntaVerificacion ?? ''
  );
  const [respuesta, setRespuesta] = useState(
    valoresIniciales.respuestaVerificacion ?? ''
  );
  const [paso, setPaso] = useState(
    Number.isInteger(valoresIniciales.paso) ? valoresIniciales.paso : 1
  );
  const [errores, setErrores] = useState({});
  const [errorFotos, setErrorFotos] = useState('');
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  // Qué completó «Usar mi ubicación actual»: { barrio, direccion, faltaBarrio, faltaDireccion }
  const [resultadoGps, setResultadoGps] = useState(null);
  const [describiendo, setDescribiendo] = useState(false);

  const {
    obtener,
    cargando: ubicando,
    error: errorUbicacion,
  } = useUbicacionActual();

  const esHallazgo = tipo === 'encontre';

  // Pasos que aplican hoy. Si el paso guardado ya no existe (p. ej. un borrador viejo o el tipo
  // cambió a «perdí»), se acota al último.
  const pasos = [
    ...(editando ? [] : ['tipo']),
    'fotos',
    'datos',
    'ubicacion',
    ...(esHallazgo ? ['verificacion'] : []),
  ];
  const pasoActual = Math.min(Math.max(paso, 1), pasos.length);
  const idPaso = pasos[pasoActual - 1];
  const esUltimo = pasoActual === pasos.length;

  // Los callbacks del padre viven en refs para que cambiarlos no dispare los efectos
  const alCambiarRef = useRef(alCambiar);
  alCambiarRef.current = alCambiar;
  const alCambiarPasoRef = useRef(alCambiarPaso);
  alCambiarPasoRef.current = alCambiarPaso;

  // Cada cambio se informa a la pantalla (borrador automático)
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
      hora,
      fotos,
      preguntaVerificacion: pregunta,
      respuestaVerificacion: respuesta,
      paso: pasoActual,
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
    hora,
    fotos,
    pregunta,
    respuesta,
    pasoActual,
  ]);

  // Al cambiar de paso: se cierra el teclado y la pantalla vuelve al inicio
  const primerPaso = useRef(true);
  useEffect(() => {
    if (primerPaso.current) {
      primerPaso.current = false;
      return;
    }

    Keyboard.dismiss();
    alCambiarPasoRef.current?.();
  }, [pasoActual]);

  // Dirección que completó el GPS (si el campo todavía la tiene, se puede volver a completar)
  const direccionAutocompletada = useRef('');
  const direccionRef = useRef(direccionExacta);
  direccionRef.current = direccionExacta;
  const ubicacionEnCurso = useRef(false);

  function limpiarError(campo) {
    setErrores((actuales) => ({ ...actuales, [campo]: '' }));
  }

  function elegirBarrio(nombre) {
    setBarrio(nombre);
    setCoords(null);
    setResultadoGps(null);
    limpiarError('barrio');
  }

  async function usarUbicacion() {
    if (ubicacionEnCurso.current) return;
    ubicacionEnCurso.current = true;

    try {
      const resultado = await obtener();

      if (!resultado) return;

      setCoords(resultado);
      setResultadoGps(null);
      setDescribiendo(true);

      const { barrio: barrioCercano, direccion } = await describirUbicacion(resultado);

      if (barrioCercano) {
        setBarrio(barrioCercano);
        limpiarError('barrio');
      }

      // Nunca se pisa lo que escribió la persona: solo un campo vacío o con la dirección que puso el GPS
      const actual = direccionRef.current.trim();
      const puedeCompletar =
        !!direccion && (actual === '' || actual === direccionAutocompletada.current);

      if (puedeCompletar) {
        direccionAutocompletada.current = direccion;
        setDireccionExacta(direccion);
        limpiarError('direccion');
      }

      setResultadoGps({
        barrio: barrioCercano,
        direccion: puedeCompletar,
        faltaBarrio: !barrioCercano && !barrio,
        faltaDireccion: !puedeCompletar && actual === '',
      });
    } finally {
      setDescribiendo(false);
      ubicacionEnCurso.current = false;
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

  // Errores de los campos de un paso (vacío si está todo bien)
  function erroresDelPaso(id) {
    const nuevos = {};

    if (id === 'datos') {
      if (titulo.trim().length < 3) {
        nuevos.titulo = 'Escribí un título de al menos 3 caracteres.';
      }

      if (!categoria) {
        nuevos.categoria = 'Elegí una categoría.';
      }

      if (descripcion.trim().length < 10) {
        nuevos.descripcion = 'Describí el objeto con al menos 10 caracteres.';
      }

      if (!fechaValida(fecha)) {
        nuevos.fecha = 'Elegí la fecha del suceso.';
      } else if (fecha > fechaLocal()) {
        nuevos.fecha = 'La fecha no puede ser futura.';
      }

      if (!hora) {
        nuevos.hora = 'Elegí la hora del suceso.';
      } else if (esHoraFutura(fecha, hora)) {
        nuevos.hora = MENSAJE_HORA_FUTURA;
      }
    }

    if (id === 'ubicacion') {
      if (!buscarZona(barrio)) {
        nuevos.barrio = 'Elegí el barrio.';
      }

      if (!direccionExacta.trim()) {
        nuevos.direccion = 'Escribí la dirección exacta.';
      }
    }

    if (id === 'verificacion') {
      if (pregunta.trim().length < 3) {
        nuevos.pregunta =
          'Escribí una pregunta de verificación de al menos 3 caracteres.';
      }

      if (!respuesta.trim()) {
        nuevos.respuesta = 'Escribí la respuesta a tu pregunta.';
      }
    }

    return nuevos;
  }

  function irAPaso(numero) {
    setPaso(Math.min(Math.max(numero, 1), pasos.length));
  }

  function siguiente() {
    const nuevos = erroresDelPaso(idPaso);

    setErrores((actuales) => ({
      ...actuales,
      ...Object.fromEntries(CAMPOS_PASO[idPaso].map((campo) => [campo, nuevos[campo] ?? ''])),
    }));

    if (Object.keys(nuevos).length === 0) {
      irAPaso(pasoActual + 1);
    }
  }

  function atras() {
    irAPaso(pasoActual - 1);
  }

  // Valida todos los pasos; si alguno falla, vuelve al primero con errores
  function validar() {
    const nuevos = {};
    let primeroConError = 0;

    pasos.forEach((id, indice) => {
      const delPaso = erroresDelPaso(id);

      if (!primeroConError && Object.keys(delPaso).length > 0) {
        primeroConError = indice + 1;
      }

      Object.assign(nuevos, delPaso);
    });

    setErrores(nuevos);

    if (primeroConError) {
      irAPaso(primeroConError);
      return false;
    }

    return true;
  }

  function armarDatos() {
    const zona = buscarZona(barrio);

    return {
      tipo,
      titulo: titulo.trim(),
      categoria,
      descripcion: descripcion.trim(),
      barrio: zona ? zona.nombre : barrio,
      ubicacion: coords
        ? coords
        : zona
          ? { latitud: zona.latitud, longitud: zona.longitud }
          : null,
      direccionExacta: direccionExacta.trim(),
      fecha,
      hora,
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

  // La hora futura también se avisa apenas se elige o se cambia la fecha a hoy
  const errorHora = errores.hora || (esHoraFutura(fecha, hora) ? MENSAJE_HORA_FUTURA : '');
  const hayErroresEnPaso = CAMPOS_PASO[idPaso].some(
    (campo) => (campo === 'hora' ? errorHora : errores[campo])
  );

  return (
    <>
      <IndicadorPasos paso={pasoActual} total={pasos.length} />

      {idPaso === 'tipo' && (
        <Seccion titulo={TITULOS_PASO.tipo}>
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

      {idPaso === 'fotos' && (
        <Seccion
          titulo={TITULOS_PASO.fotos}
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
      )}

      {idPaso === 'datos' && (
        <Seccion titulo={TITULOS_PASO.datos}>
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

          <SelectorFecha
            modo="date"
            etiqueta="Fecha del suceso"
            accessibilityLabel="Fecha del suceso"
            valor={fecha}
            maximo={fechaLocal()}
            onChange={(valor) => {
              setFecha(valor);
              limpiarError('fecha');
              limpiarError('hora');
            }}
            error={errores.fecha}
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
              limpiarError('hora');
            }}
          />

          <SelectorFecha
            modo="time"
            etiqueta="Hora del suceso"
            accessibilityLabel="Hora del suceso"
            valor={hora}
            onChange={(valor) => {
              setHora(valor);
              limpiarError('hora');
            }}
            error={errorHora}
          />
        </Seccion>
      )}

      {idPaso === 'ubicacion' && (
        <Seccion titulo={TITULOS_PASO.ubicacion}>
          <SelectorBarrio
            etiqueta="Barrio"
            accessibilityLabel="Barrio"
            valor={barrio}
            onChange={elegirBarrio}
            error={errores.barrio}
          />

          <Boton
            titulo={
              ubicando
                ? 'Obteniendo ubicación…'
                : describiendo
                  ? 'Buscando barrio y dirección…'
                  : 'Usar mi ubicación actual'
            }
            icono="crosshairs-gps"
            variante="secundario"
            cargando={ubicando || describiendo}
            onPress={usarUbicacion}
          />

          {!!errorUbicacion && !coords && (
            <Aviso tono="peligro" mensaje={errorUbicacion} accessibilityRole="alert" />
          )}

          {resultadoGps && (
            <Aviso
              tono={resultadoGps.faltaBarrio || resultadoGps.faltaDireccion ? 'aviso' : 'info'}
              icono="map-marker-check-outline"
              mensaje={mensajeUbicacion(resultadoGps)}
            />
          )}

          {coords && !resultadoGps && (
            <Aviso
              tono="info"
              icono="map-marker-check-outline"
              mensaje="Se guarda también la ubicación del GPS junto con el barrio."
            />
          )}

          <Campo
            etiqueta="Dirección exacta"
            accessibilityLabel="Dirección exacta"
            ayuda="Solo la ve la persona cuyo reclamo aceptes. El resto de los usuarios ve únicamente el barrio."
            value={direccionExacta}
            onChangeText={(valor) => {
              setDireccionExacta(valor);
              limpiarError('direccion');
            }}
            error={errores.direccion}
            placeholder="Calle, altura o punto de referencia"
            maxLength={250}
          />
        </Seccion>
      )}

      {idPaso === 'verificacion' && (
        <Seccion
          titulo={TITULOS_PASO.verificacion}
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

      {hayErroresEnPaso && (
        <Aviso
          tono="peligro"
          mensaje={`Revisá los campos marcados antes de ${
            esUltimo ? (editando ? 'guardar' : 'publicar') : 'seguir'
          }.`}
          accessibilityRole="alert"
        />
      )}

      {esUltimo && !!errorEnvio && (
        <Aviso tono="peligro" mensaje={errorEnvio} accessibilityRole="alert" />
      )}

      {esUltimo && !hayConexion && (
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

      {esUltimo ? (
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
      ) : (
        <Boton titulo="Siguiente" onPress={siguiente} />
      )}

      {esUltimo && puedeEncolar && hayConexion && !!errorEnvio && (
        <Boton
          titulo="Guardar para enviar después"
          variante="secundario"
          disabled={enviando}
          onPress={guardarParaDespues}
        />
      )}

      {pasoActual > 1 && (
        <Boton titulo="Atrás" variante="secundario" disabled={enviando} onPress={atras} />
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

// Texto del aviso que explica qué completó «Usar mi ubicación actual» y qué falta
function mensajeUbicacion({ barrio, direccion, faltaBarrio, faltaDireccion }) {
  const completado = [barrio && `el barrio (${barrio})`, direccion && 'la dirección'].filter(Boolean);
  const partes = [];

  if (completado.length > 0) {
    partes.push(`Completamos ${completado.join(' y ')} con tu ubicación. Revisalo: podés corregirlo.`);
  }

  if (faltaBarrio) {
    partes.push('No encontramos un barrio cerca: elegilo de la lista.');
  }

  if (faltaDireccion) {
    partes.push('No pudimos obtener la dirección: escribila vos.');
  }

  return partes.join(' ') || 'Guardamos tu ubicación. Revisá el barrio y la dirección.';
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
