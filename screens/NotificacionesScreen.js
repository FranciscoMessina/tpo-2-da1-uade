import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FlatList, StyleSheet, View } from 'react-native';
import { useConexion } from '../context/ConexionContext';
import { useSearch } from '../context/SearchContext';
import {
  marcarNotificacionLeida,
  marcarTodasLeidas,
  obtenerNotificaciones,
} from '../services/notificaciones';
import { mensajeErrorApi } from '../services/api';
import {
  Aviso,
  AvisoSinConexion,
  Boton,
  Cargando,
  ErrorConReintento,
  EstadoVacio,
  Icono,
  Insignia,
  Tarjeta,
  Texto,
  Tocable,
  espacio,
  estilosPantalla,
  irAPestana,
  radios,
  tonos,
} from '../components/ui';

export const TAMANO_PAGINA = 20;

// Cómo se presenta cada tipo de aviso que manda el servidor
const TIPOS = {
  coincidencia: { etiqueta: 'Alerta', icono: 'bell-outline' },
  publicacion: { etiqueta: 'Publicación seguida', icono: 'bookmark-outline' },
  reclamo: { etiqueta: 'Reclamo', icono: 'inbox-outline' },
  mensaje: { etiqueta: 'Mensaje', icono: 'message-text-outline' },
  encuentro: { etiqueta: 'Punto de encuentro', icono: 'map-marker-outline' },
  devolucion: { etiqueta: 'Devolución', icono: 'handshake-outline' },
  valoracion: { etiqueta: 'Valoración', icono: 'star-outline' },
};
const TIPO_GENERICO = { etiqueta: 'Aviso', icono: 'information-outline' };
const TIPOS_RECLAMO = new Set(['reclamo', 'mensaje', 'encuentro', 'devolucion']);

export function tipoNotificacion(tipo) {
  return TIPOS[tipo] ?? TIPO_GENERICO;
}

// Fecha legible: hora si es de hoy, «Ayer» o el día con hora para el resto
export function fechaNotificacion(iso, ahora = new Date()) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dia = (d) => d.toLocaleDateString('es-AR');
  if (dia(fecha) === dia(ahora)) return `Hoy, ${hora}`;
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (dia(fecha) === dia(ayer)) return `Ayer, ${hora}`;
  return `${fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${hora}`;
}

// Adónde lleva tocar un aviso: la publicación, el reclamo o el historial
function abrirDestino(navigation, notificacion) {
  if (TIPOS_RECLAMO.has(notificacion.tipo)) {
    irAPestana(navigation, 'MisReclamos');
  } else if (notificacion.tipo === 'valoracion') {
    navigation.navigate('Historial');
  } else if (notificacion.publicacionId) {
    navigation.navigate('DetallePublicacion', { publicacionId: notificacion.publicacionId });
  }
}

const ESTADO_INICIAL = {
  items: [],
  pagina: 0,
  totalPaginas: 0,
  sinLeer: 0,
  cargando: true,
  cargandoMas: false,
  error: '',
  errorMas: '',
};

// Agrega una página sin repetir avisos: si llegó uno nuevo, la página siguiente se corre un lugar.
function unirPaginas(actuales, nuevos) {
  const vistos = new Set(actuales.map((n) => n.id));
  return [...actuales, ...nuevos.filter((n) => !vistos.has(n.id))];
}

function FilaNotificacion({ notificacion, onPress }) {
  const sinLeer = !notificacion.leidaEn;
  const { etiqueta, icono } = tipoNotificacion(notificacion.tipo);
  const tono = sinLeer ? tonos.info : tonos.neutro;
  const fecha = fechaNotificacion(notificacion.creadaEn);

  return (
    <Tarjeta sinRelleno destacada={sinLeer}>
      <Tocable
        radio={radios.tarjeta}
        onPress={onPress}
        accessibilityLabel={`${sinLeer ? 'Sin leer. ' : 'Leída. '}${notificacion.mensaje}. ${etiqueta}. ${fecha}`}
        accessibilityHint="Abre el detalle relacionado"
        style={styles.fila}
      >
        <View style={[styles.medalla, { backgroundColor: tono.fondo }]}>
          <Icono nombre={icono} tamano={22} color={tono.texto} />
        </View>

        <View style={styles.datos}>
          <Texto
            variante={sinLeer ? 'subtitulo' : 'cuerpo'}
            tono={sinLeer ? 'principal' : 'secundario'}
          >
            {notificacion.mensaje}
          </Texto>
          <Texto variante="cuerpoChico" tono="secundario">
            {etiqueta} · {fecha}
          </Texto>
          {sinLeer && <Insignia tono="info" icono="circle-medium" texto="Sin leer" />}
        </View>
      </Tocable>
    </Tarjeta>
  );
}

export default function NotificacionesScreen({ navigation }) {
  const { hayConexion } = useConexion();
  const { recargarNovedades } = useSearch();
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');
  // Cada carga tiene su número: una respuesta de una carga anterior no pisa la actual.
  const consulta = useRef(0);

  const cargar = useCallback((pagina) => {
    const numero = ++consulta.current;
    setEstado((actual) => (pagina === 1
      ? { ...actual, cargando: true, error: '' }
      : { ...actual, cargandoMas: true, errorMas: '' }));

    obtenerNotificaciones({ pagina, tamanoPagina: TAMANO_PAGINA })
      .then((datos) => {
        if (numero !== consulta.current) return;
        const nuevos = datos?.items ?? [];
        setEstado((actual) => ({
          ...actual,
          items: pagina === 1 ? nuevos : unirPaginas(actual.items, nuevos),
          pagina,
          totalPaginas: datos?.totalPages ?? 0,
          sinLeer: datos?.sinLeer ?? 0,
          cargando: false,
          cargandoMas: false,
        }));
      })
      .catch((error) => {
        if (numero !== consulta.current) return;
        const mensaje = mensajeErrorApi(error);
        setEstado((actual) => (pagina === 1
          ? { ...actual, cargando: false, error: mensaje }
          : { ...actual, cargandoMas: false, errorMas: mensaje }));
      });
  }, []);

  const recargar = useCallback(() => {
    setErrorAccion('');
    cargar(1);
  }, [cargar]);

  useFocusEffect(useCallback(() => {
    recargar();
    // Al salir se descarta lo que siga en vuelo
    return () => { consulta.current += 1; };
  }, [recargar]));

  const hayMas = estado.pagina > 0 && estado.pagina < estado.totalPaginas;

  function cargarMas() {
    if (!hayMas || estado.cargando || estado.cargandoMas || estado.errorMas) return;
    cargar(estado.pagina + 1);
  }

  function cambiarLeida(id, leidaEn) {
    setEstado((actual) => {
      const previa = actual.items.find((n) => n.id === id);
      if (!previa || !previa.leidaEn === !leidaEn) return actual;
      return {
        ...actual,
        items: actual.items.map((n) => (n.id === id ? { ...n, leidaEn } : n)),
        sinLeer: Math.max(0, actual.sinLeer + (leidaEn ? -1 : 1)),
      };
    });
  }

  function abrir(notificacion) {
    if (!notificacion.leidaEn && hayConexion) {
      // Se ve leída enseguida; si el servidor no la marca, vuelve a sin leer.
      cambiarLeida(notificacion.id, new Date().toISOString());
      marcarNotificacionLeida(notificacion.id)
        .then(() => recargarNovedades())
        .catch(() => cambiarLeida(notificacion.id, null));
    }
    abrirDestino(navigation, notificacion);
  }

  async function marcarTodas() {
    setMarcandoTodas(true);
    setErrorAccion('');
    try {
      await marcarTodasLeidas();
      const ahora = new Date().toISOString();
      consulta.current += 1;
      setEstado((actual) => ({
        ...actual,
        items: actual.items.map((n) => (n.leidaEn ? n : { ...n, leidaEn: ahora })),
        sinLeer: 0,
        cargando: false,
        cargandoMas: false,
      }));
      recargarNovedades();
    } catch (error) {
      setErrorAccion(mensajeErrorApi(error));
    } finally {
      setMarcandoTodas(false);
    }
  }

  const { items, sinLeer, cargando, cargandoMas, error, errorMas } = estado;
  const vacio = items.length === 0;

  if (vacio && cargando) {
    return <Cargando pantalla etiqueta="Cargando notificaciones…" />;
  }

  if (vacio && error) {
    return (
      <View style={[estilosPantalla.pantalla, estilosPantalla.contenido]}>
        <ErrorConReintento mensaje={error} onReintentar={recargar} />
      </View>
    );
  }

  return (
    <FlatList
      style={estilosPantalla.pantalla}
      contentContainerStyle={estilosPantalla.contenido}
      data={items}
      keyExtractor={(item) => item.id}
      refreshing={cargando && !vacio}
      onRefresh={recargar}
      onEndReached={cargarMas}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={vacio ? null : (
        <View style={styles.encabezado}>
          {!hayConexion && (
            <AvisoSinConexion mensaje="Podés ver las notificaciones cargadas, pero no marcarlas como leídas hasta que vuelva la conexión." />
          )}
          {!!error && (
            <Aviso tono="peligro" mensaje={`No se pudo actualizar. ${error}`} accessibilityRole="alert" />
          )}
          {!!errorAccion && (
            <Aviso tono="peligro" mensaje={errorAccion} accessibilityRole="alert" />
          )}

          <View style={styles.resumen}>
            <Texto variante="cuerpoChico" tono="secundario" accessibilityLiveRegion="polite" style={styles.resumenTexto}>
              {sinLeer === 0 ? 'Todo leído'
                : sinLeer === 1 ? '1 sin leer' : `${sinLeer} sin leer`}
            </Texto>
            <Boton
              titulo="Marcar todas como leídas"
              icono="check-all"
              variante="terciario"
              chico
              ajustado
              requiereConexion
              cargando={marcandoTodas}
              disabled={sinLeer === 0 || marcandoTodas}
              onPress={marcarTodas}
            />
          </View>
        </View>
      )}
      renderItem={({ item }) => (
        <FilaNotificacion notificacion={item} onPress={() => abrir(item)} />
      )}
      ListFooterComponent={vacio ? null : (
        <View style={styles.pie}>
          {cargandoMas && <Cargando chico etiqueta="Cargando más…" />}
          {!!errorMas && (
            <>
              <Aviso tono="peligro" mensaje={errorMas} accessibilityRole="alert" />
              <Boton
                titulo="Reintentar"
                icono="refresh"
                variante="secundario"
                chico
                onPress={() => cargar(estado.pagina + 1)}
              />
            </>
          )}
          {hayMas && !cargandoMas && !errorMas && (
            <Boton titulo="Ver más" variante="secundario" chico onPress={cargarMas} />
          )}
        </View>
      )}
      ListEmptyComponent={(
        <EstadoVacio
          icono="bell-check-outline"
          titulo="No tenés notificaciones"
          mensaje="Acá vas a ver las coincidencias de tus alertas, las novedades de lo que seguís y los avisos de tus reclamos."
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  encabezado: { gap: espacio.xs, marginBottom: espacio.xxs },
  resumen: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio.xs,
  },
  resumenTexto: { flexShrink: 1 },
  fila: {
    flexDirection: 'row',
    gap: espacio.sm,
    padding: espacio.sm,
  },
  medalla: {
    width: 40,
    height: 40,
    borderRadius: radios.pastilla,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datos: { flex: 1, gap: espacio.xxs },
  pie: { gap: espacio.xs, marginTop: espacio.xxs },
});
