import {
  guardarUltimosReclamos,
  obtenerUltimosReclamos,
} from '../services/cacheOffline';
import { useConexion } from '../context/ConexionContext';
import useAuth from '../hooks/useAuth';
import useActualizacionVisible from '../hooks/useActualizacionVisible';
import { useSearch } from '../context/SearchContext';
import { estaConectado, verificarConexion } from '../services/conexion';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import {
  obtenerMisReclamos,
  aceptarReclamo,
  rechazarReclamo,
} from '../services/publicaciones';
import { mensajeErrorApi } from '../services/api';
import EncuentroReclamo from '../components/EncuentroReclamo';
import EvidenciaReclamo from '../components/EvidenciaReclamo';
import { resolverPublicacion } from '../services/historial';
import {
  Aviso,
  AvisoSinConexion,
  Boton,
  Cargando,
  ESTADOS_RECLAMO,
  ErrorConReintento,
  EstadoVacio,
  Fila,
  Icono,
  InsigniaEstado,
  InsigniaTipo,
  NotaSinConexion,
  Pestanas,
  Separador,
  Tarjeta,
  Texto,
  Tocable,
  colores,
  espacio,
  estilosPantalla,
  radios,
} from '../components/ui';

const PAGINACION_INICIAL = {
  enviados: { pagina: 1, totalPaginas: 1, total: 0 },
  recibidos: { pagina: 1, totalPaginas: 1, total: 0 },
};

// `alcance` es la cuenta a la que pertenecen los datos: undefined hasta la primera carga.
const ESTADO_INICIAL = {
  alcance: undefined,
  cargando: true,
  error: '',
  enviados: [],
  recibidos: [],
  paginacion: PAGINACION_INICIAL,
};

// Paginación completa guardada en caché o con un solo grupo de resultados
const paginacionLocal = (lista) => ({
  pagina: 1,
  totalPaginas: 1,
  total: lista.length,
});
const paginacionServidor = (res, lista) => ({
  pagina: res.page || 1,
  totalPaginas: res.totalPages || 1,
  total: res.total ?? lista.length,
});
const hayCache = (cache) => !!cache && (cache.enviados.length > 0 || cache.recibidos.length > 0);

export default function MisReclamosScreen({ navigation }) {
  const { hayConexion } = useConexion();
  const { novedadesPorReclamo } = useSearch();
  const { usuario } = useAuth();
  const alcance = usuario?.id ?? null;
  const [tab, setTab] = useState('recibidos'); // 'recibidos' | 'enviados'
  const [datos, setDatos] = useState(ESTADO_INICIAL);
  const [procesandoId, setProcesandoId] = useState(null);
  const [actualizacion, setActualizacion] = useState(0);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorMas, setErrorMas] = useState('');
  // Cada recarga aplicada invalida las páginas adicionales que estaban en camino
  const versionCarga = useRef(0);
  // Solo vale la respuesta de la última recarga pedida; las anteriores se cancelan
  const ciclo = useRef({ solicitud: 0, controller: null, enCurso: false });

  // Lo cargado de otra cuenta no se muestra mientras llegan los datos de la actual
  const vigente = datos.alcance === alcance;
  const { cargando, error } = vigente ? datos : ESTADO_INICIAL;
  const reclamosEnviados = vigente ? datos.enviados : ESTADO_INICIAL.enviados;
  const reclamosRecibidos = vigente ? datos.recibidos : ESTADO_INICIAL.recibidos;
  const paginacion = vigente ? datos.paginacion : PAGINACION_INICIAL;

  /**
   * Recarga la primera página de ambas bandejas y reemplaza lo que se veía (las páginas
   * siguientes se descartan y el cursor vuelve a la página 1). Con `silencioso` es el
   * refresco periódico: no toca la pantalla hasta tener datos, no se superpone con otra
   * petición y, si falla, deja a la vista lo que ya había.
   */
  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (silencioso && ciclo.current.enCurso) return;
    ciclo.current.controller?.abort();
    const solicitud = ++ciclo.current.solicitud;
    const controller = new AbortController();
    ciclo.current.controller = controller;
    ciclo.current.enCurso = true;
    const vale = () => solicitud === ciclo.current.solicitud && !controller.signal.aborted;
    const mostrar = (nuevo) => {
      versionCarga.current += 1;
      setDatos((previo) => ({
        ...(previo.alcance === alcance ? previo : ESTADO_INICIAL),
        alcance,
        ...nuevo,
      }));
    };
    const mostrarCache = (cache) => {
      mostrar({
        cargando: false,
        error: '',
        enviados: cache.enviados,
        recibidos: cache.recibidos,
        paginacion: {
          enviados: paginacionLocal(cache.enviados),
          recibidos: paginacionLocal(cache.recibidos),
        },
      });
      setActualizacion((n) => n + 1);
    };

    try {
      if (!silencioso) {
        setErrorMas('');
        setDatos((previo) => (previo.alcance === alcance
          ? { ...previo, error: '' }
          : { ...ESTADO_INICIAL, alcance }));
      }
      if (!estaConectado()) {
        if (silencioso) return;
        const cache = await obtenerUltimosReclamos();
        if (!vale()) return;
        if (hayCache(cache)) {
          mostrarCache(cache);
        } else {
          mostrar({
            cargando: false,
            error: 'No hay conexión a internet y no hay reclamos guardados previamente en el dispositivo.',
          });
        }
        return;
      }

      try {
        const [resEnviados, resRecibidos] = await Promise.all([
          obtenerMisReclamos({ tipo: 'enviados', signal: controller.signal }),
          obtenerMisReclamos({ tipo: 'recibidos', signal: controller.signal }),
        ]);
        if (!vale()) return;
        const env = resEnviados.items || [];
        const rec = resRecibidos.items || [];
        mostrar({
          cargando: false,
          error: '',
          enviados: env,
          recibidos: rec,
          paginacion: {
            enviados: paginacionServidor(resEnviados, env),
            recibidos: paginacionServidor(resRecibidos, rec),
          },
        });
        // Solo las cargas pedidas por la persona hacen que cada encuentro se consulte de nuevo
        if (!silencioso) setActualizacion((n) => n + 1);
        // Guardar copia local para visualización sin conexión
        await guardarUltimosReclamos({ enviados: env, recibidos: rec });
      } catch (e) {
        if (!vale() || silencioso) return;
        const cache = await obtenerUltimosReclamos();
        if (!vale()) return;
        if (hayCache(cache)) {
          mostrarCache(cache);
        } else {
          mostrar({ cargando: false, error: mensajeErrorApi(e) });
        }
      }
    } finally {
      if (solicitud === ciclo.current.solicitud) ciclo.current.enCurso = false;
    }
  }, [alcance]);

  // Al salir de la pantalla o cambiar de cuenta se cancela lo pendiente y se descartan sus respuestas
  useFocusEffect(
    useCallback(() => {
      const actual = ciclo.current;
      cargar();
      return () => {
        actual.solicitud += 1;
        actual.enCurso = false;
        actual.controller?.abort();
        versionCarga.current += 1;
      };
    }, [cargar])
  );

  const actualizarEnSegundoPlano = useCallback(() => cargar({ silencioso: true }), [cargar]);
  useActualizacionVisible(actualizarEnSegundoPlano, { alcance });

  // Trae la siguiente página de la bandeja activa y la suma a la lista
  async function cargarMas() {
    const bandeja = tab;
    const { pagina, totalPaginas } = paginacion[bandeja];
    if (cargandoMas || pagina >= totalPaginas) return;

    const version = versionCarga.current;
    setCargandoMas(true);
    setErrorMas('');
    try {
      const res = await obtenerMisReclamos({ tipo: bandeja, pagina: pagina + 1 });
      // Si se recargó la pantalla mientras tanto, esta página ya no corresponde
      if (version !== versionCarga.current) return;

      const nuevos = res.items || [];
      const agregar = (previos) => {
        const ids = new Set(previos.map((r) => r.id));
        return [...previos, ...nuevos.filter((r) => !ids.has(r.id))];
      };
      setDatos((previo) => (previo.alcance !== alcance ? previo : {
        ...previo,
        [bandeja]: agregar(previo[bandeja]),
        paginacion: { ...previo.paginacion, [bandeja]: paginacionServidor(res, nuevos) },
      }));
    } catch (e) {
      if (version === versionCarga.current) setErrorMas(mensajeErrorApi(e));
    } finally {
      setCargandoMas(false);
    }
  }

  function manejarAceptar(reclamo) {
    Alert.alert(
      'Aceptar reclamo',
      `¿Querés aceptar el reclamo de ${reclamo.usuario}? La publicación pasará a estado "En reclamo" para coordinar la devolución.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: async () => {
            if (!(await verificarConexion())) {
              Alert.alert('Sin conexión', 'Se necesita conexión a internet para aceptar este reclamo.');
              return;
            }
            setProcesandoId(reclamo.id);
            try {
              await aceptarReclamo(reclamo.id);
              Alert.alert(
                'Reclamo aceptado',
                'El reclamo fue aceptado. Podés coordinar la entrega con la otra persona.'
              );
              cargar();
            } catch (err) {
              Alert.alert('No se pudo aceptar', mensajeErrorApi(err));
            } finally {
              setProcesandoId(null);
            }
          },
        },
      ]
    );
  }

  function manejarRechazar(reclamo) {
    Alert.alert(
      'Rechazar reclamo',
      `¿Querés rechazar el reclamo de ${reclamo.usuario}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            if (!(await verificarConexion())) {
              Alert.alert('Sin conexión', 'Se necesita conexión a internet para rechazar este reclamo.');
              return;
            }
            setProcesandoId(reclamo.id);
            try {
              await rechazarReclamo(reclamo.id);
              Alert.alert('Reclamo rechazado', 'El reclamo fue rechazado.');
              cargar();
            } catch (err) {
              Alert.alert('No se pudo rechazar', mensajeErrorApi(err));
            } finally {
              setProcesandoId(null);
            }
          },
        },
      ]
    );
  }

  function manejarResolver(reclamo) {
    Alert.alert('Confirmar devolución', '¿El objeto ya fue devuelto? El caso se cerrará y ambos podrán valorarse durante 7 días.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: async () => {
        if (!(await verificarConexion())) {
          Alert.alert('Sin conexión', 'Se necesita conexión a internet para confirmar la devolución.');
          return;
        }
        setProcesandoId(reclamo.id);
        try {
          await resolverPublicacion(reclamo.publicacion.id);
          await cargar();
          navigation.navigate('Historial');
        } catch (e) {
          Alert.alert('No se pudo confirmar', mensajeErrorApi(e));
        } finally {
          setProcesandoId(null);
        }
      } },
    ]);
  }

  const items = tab === 'recibidos' ? reclamosRecibidos : reclamosEnviados;

  function renderItem({ item }) {
    const pub = item.publicacion;
    const esRecibido = tab === 'recibidos';
    const sinLeer = novedadesPorReclamo.get(item.id);

    return (
      <Tarjeta>
        {/* Publicación vinculada */}
        {pub && (
          <>
            <Tocable
              radio={radios.chico}
              accessibilityLabel={`Ver publicación ${pub.titulo}`}
              onPress={() =>
                navigation.navigate('DetallePublicacion', {
                  publicacionId: pub.id,
                })
              }
              style={styles.publicacion}
            >
              <View style={styles.publicacionDatos}>
                <InsigniaTipo tipo={pub.tipo} />
                <Texto variante="subtitulo" numberOfLines={1}>{pub.titulo}</Texto>
                <Texto variante="cuerpoChico" tono="secundario">
                  {pub.categoria} · {pub.barrio}
                </Texto>
              </View>
              <Icono nombre="chevron-right" tamano={22} color={colores.textoTenue} />
            </Tocable>

            <Separador />
          </>
        )}

        {/* Datos del reclamo */}
        <View style={styles.reclamo}>
          <View style={styles.reclamoDatos}>
            <Texto variante="etiqueta">
              {esRecibido ? `De: ${item.usuario}` : 'Enviado por vos'}
            </Texto>
            <Texto variante="leyenda" tono="secundario">
              Intento {item.intentos || 1} de {item.maxIntentos || 3}
            </Texto>
          </View>
          <InsigniaEstado estado={item.estado} estados={ESTADOS_RECLAMO} />
        </View>

        {/* Mensaje y evidencia del reclamo (respuesta, barrio y foto de prueba) */}
        <EvidenciaReclamo
          reclamo={item}
          publicacion={pub}
          esDuenio={esRecibido}
        />

        {/* Teléfono compartido en caso de aceptación */}
        {item.estado === 'aceptado' && (
          <Aviso
            tono="exito"
            icono="phone-outline"
            mensaje={item.telefono
              ? `Teléfono de contacto: ${item.telefono}`
              : 'Esta persona prefiere comunicarse mediante la aplicación.'}
          />
        )}

        {item.estado === 'aceptado' && pub?.estado === 'en_reclamo' && (
          <EncuentroReclamo reclamoId={item.id} actualizacion={actualizacion} />
        )}

        {item.estado === 'aceptado' && (
          <Boton
            titulo={sinLeer ? `Mensajes (${sinLeer} sin leer)` : 'Mensajes'}
            icono="message-text-outline"
            variante="secundario"
            onPress={() => navigation.navigate('ConversacionReclamo', {
              reclamoId: item.id,
              contraparte: esRecibido ? item.usuario : pub?.publicador?.name,
              tituloPublicacion: pub?.titulo,
            })}
          />
        )}

        {esRecibido && item.estado === 'aceptado' && pub?.estado === 'en_reclamo' && (
          <>
            <Boton
              titulo={procesandoId === item.id ? 'Confirmando…' : 'Confirmar devolución'}
              cargando={procesandoId === item.id}
              disabled={procesandoId !== null || !hayConexion}
              onPress={() => manejarResolver(item)}
            />
            {!hayConexion && (
              <NotaSinConexion>Se necesita conexión para confirmar la devolución.</NotaSinConexion>
            )}
          </>
        )}

        {item.estado === 'aceptado' && pub?.estado === 'resuelta' && (
          <Boton
            titulo="Ver historial y valorar"
            variante="secundario"
            onPress={() => navigation.navigate('Historial')}
          />
        )}

        {/* Aviso de vencimiento */}
        {item.estado === 'vencido' && (
          <Aviso
            tono="peligro"
            icono="clock-outline"
            mensaje="Venció automáticamente al cumplirse 48 hs sin respuesta."
          />
        )}

        {/* Acciones para el publicador en reclamos recibidos */}
        {esRecibido && item.estado === 'pendiente' && pub?.estado === 'abierta' && (
          <>
            <Fila>
              <Boton
                titulo={procesandoId === item.id ? 'Aceptando…' : 'Aceptar'}
                flexible
                disabled={procesandoId === item.id || !hayConexion}
                onPress={() => manejarAceptar(item)}
              />
              <Boton
                titulo={procesandoId === item.id ? 'Rechazando…' : 'Rechazar'}
                variante="peligro"
                flexible
                disabled={procesandoId === item.id || !hayConexion}
                onPress={() => manejarRechazar(item)}
              />
            </Fila>
            {!hayConexion && (
              <NotaSinConexion>Se necesita conexión para aceptar o rechazar este reclamo.</NotaSinConexion>
            )}
          </>
        )}
      </Tarjeta>
    );
  }

  return (
    <View style={estilosPantalla.pantalla}>
      <Pestanas
        opciones={[
          { valor: 'recibidos', nombre: `Recibidos (${paginacion.recibidos.total})` },
          { valor: 'enviados', nombre: `Enviados (${paginacion.enviados.total})` },
        ]}
        valor={tab}
        onChange={setTab}
      />

      {!hayConexion && (
        <AvisoSinConexion
          style={styles.avisoSinConexion}
          mensaje="Mostrando los últimos reclamos cargados. Se necesita conexión a internet para aceptar o rechazar reclamos."
        />
      )}

      {cargando ? (
        <Cargando pantalla />
      ) : error ? (
        <View style={estilosPantalla.centrado}>
          <ErrorConReintento mensaje={error} onReintentar={() => cargar()} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={estilosPantalla.contenido}
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={cargando} onRefresh={() => cargar()} />
          }
          ListFooterComponent={
            paginacion[tab].pagina < paginacion[tab].totalPaginas ? (
              <View style={styles.cargarMas}>
                {errorMas !== '' && (
                  <Texto variante="cuerpoChico" tono="peligro" centrado>{errorMas}</Texto>
                )}
                <Boton
                  titulo={cargandoMas ? 'Cargando…' : 'Cargar más reclamos'}
                  variante="terciario"
                  cargando={cargandoMas}
                  disabled={!hayConexion}
                  onPress={cargarMas}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EstadoVacio
              icono={tab === 'recibidos' ? 'tray-arrow-down' : 'tray-arrow-up'}
              titulo={tab === 'recibidos' ? 'No recibiste reclamos' : 'No enviaste reclamos'}
              mensaje={tab === 'recibidos'
                ? 'Cuando alguien reclame un objeto en tus publicaciones, lo vas a ver acá.'
                : 'Cuando reclames un objeto perdido o encontrado, podrás seguir su estado acá.'}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avisoSinConexion: { marginHorizontal: espacio.md, marginTop: espacio.sm },
  publicacion: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  publicacionDatos: { flex: 1, gap: espacio.xxs },
  reclamo: { flexDirection: 'row', alignItems: 'center', gap: espacio.xs },
  reclamoDatos: { flex: 1 },
  cargarMas: { gap: espacio.xs },
});
