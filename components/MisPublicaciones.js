import PublicacionesPendientes from './PublicacionesPendientes';
import TarjetaPublicacion from './TarjetaPublicacion';
import useMisPublicaciones from '../hooks/useMisPublicaciones';
import { DIAS_AVISO_VENCIMIENTO, diasParaVencer } from '../services/publicaciones';
import {
  Aviso,
  Boton,
  Cargando,
  ErrorConReintento,
  EstadoVacio,
  GrupoOpciones,
  Seccion,
  Texto,
} from './ui';

const FILTROS = [
  { valor: '', nombre: 'Todas' },
  { valor: 'abierta', nombre: 'Abiertas' },
  { valor: 'en_reclamo', nombre: 'En reclamo' },
  { valor: 'resuelta', nombre: 'Resueltas' },
  { valor: 'vencida', nombre: 'Vencidas' },
];

function formatearFecha(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-AR') : '';
}

// Aviso de vigencia: fecha si ya venció, o días restantes si falta poco (null si no corresponde)
function vigencia(publicacion) {
  if (publicacion.estado === 'vencida') {
    return `Venció el ${formatearFecha(publicacion.venceAt)}`;
  }

  const dias = diasParaVencer(publicacion.venceAt);
  if (
    ['abierta', 'en_reclamo'].includes(publicacion.estado) &&
    dias !== null &&
    dias <= DIAS_AVISO_VENCIMIENTO
  ) {
    return dias <= 0
      ? 'Vence hoy'
      : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'} (${formatearFecha(publicacion.venceAt)})`;
  }

  return null;
}

// Listado de las publicaciones propias; cada una abre su gestión.
export default function MisPublicaciones({ navigation }) {
  const {
    publicaciones,
    estado,
    cambiarEstado,
    total,
    hayMas,
    loading,
    refrescando,
    cargandoMas,
    error,
    errorMas,
    recargar,
    cargarMas,
  } = useMisPublicaciones();

  const porVencer = publicaciones.filter(
    (p) => p.estado !== 'vencida' && vigencia(p)
  ).length;

  return (
    <>
      <PublicacionesPendientes navigation={navigation} />

      <Seccion titulo="Mis publicaciones">
        <GrupoOpciones chico opciones={FILTROS} valor={estado} onChange={cambiarEstado} />

        {porVencer > 0 && (
          <Aviso
            tono="aviso"
            icono="clock-alert-outline"
            mensaje={
              porVencer === 1
                ? 'Tenés 1 publicación por vencer. Abrila para renovarla.'
                : `Tenés ${porVencer} publicaciones por vencer. Abrilas para renovarlas.`
            }
          />
        )}
      </Seccion>

      {(loading || refrescando) && <Cargando chico />}

      {error !== '' && <ErrorConReintento mensaje={error} onReintentar={recargar} />}

      {!loading && error === '' && publicaciones.length === 0 && (
        <EstadoVacio
          icono="file-document-outline"
          mensaje={
            estado === ''
              ? 'Todavía no publicaste nada.'
              : 'No tenés publicaciones en este estado.'
          }
        />
      )}

      {publicaciones.map((p) => {
        const aviso = vigencia(p);

        return (
          <TarjetaPublicacion
            key={p.id}
            publicacion={p}
            mostrarEstado
            onPress={() => navigation.navigate('GestionPublicacion', { publicacionId: p.id })}
          >
            {aviso && <Texto variante="etiqueta" tono="aviso">{aviso}</Texto>}
          </TarjetaPublicacion>
        );
      })}

      {errorMas !== '' && <Aviso tono="peligro" mensaje={errorMas} accessibilityRole="alert" />}

      {hayMas && (
        <Boton
          titulo={cargandoMas ? 'Cargando…' : `Ver más (${publicaciones.length} de ${total})`}
          variante="secundario"
          cargando={cargandoMas}
          onPress={cargarMas}
        />
      )}
    </>
  );
}
