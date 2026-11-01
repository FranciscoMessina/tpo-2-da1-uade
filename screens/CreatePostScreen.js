import { useEffect, useState } from 'react';
import { View } from 'react-native';
import FormularioPublicacion, { FRANJAS } from '../components/FormularioPublicacion';
import useAuth from '../hooks/useAuth';
import useBorradorPublicacion from '../hooks/useBorradorPublicacion';
import useCrearPublicacion from '../hooks/useCrearPublicacion';
import { textoAntiguedad } from '../services/borradores';
import {
  ESTADOS,
  leerCola,
  valoresDesdeDatos,
} from '../services/colaPublicaciones';
import {
  Aviso,
  Boton,
  Cargando,
  EstadoVacio,
  Pantalla,
  Tarjeta,
  estilosPantalla,
} from '../components/ui';

export default function CreatePostScreen({ route, navigation }) {
  const { usuario } = useAuth();
  const uid = usuario?.id !== undefined && usuario?.id !== null ? String(usuario.id) : null;
  const pendienteId = route.params?.pendienteId ?? null;

  const [publicada, setPublicada] = useState(null);
  // Valores con los que arranca el formulario: los de un borrador retomado o los de un
  // ítem con error de la cola que se está editando (null = formulario en blanco)
  const [valoresIniciales, setValoresIniciales] = useState(null);
  // Al editar un ítem de la cola: 'cargando' | 'listo' | 'no-disponible'
  const [estadoPendiente, setEstadoPendiente] = useState(pendienteId ? 'cargando' : 'listo');

  const crear = useCrearPublicacion({
    pendienteId,
    alSubirFoto: () => borrador.guardarAhora(),
  });
  // El borrador automático solo aplica a la publicación nueva, no a la edición de un ítem de la cola
  const borrador = useBorradorPublicacion(pendienteId ? null : uid, {
    obtenerEnvio: crear.obtenerEnvio,
  });

  const { usarEnvio } = crear;

  useEffect(() => {
    if (!pendienteId || !uid) return undefined;

    let activo = true;
    leerCola(uid).then((cola) => {
      if (!activo) return;

      const item = cola.find((i) => i.id === pendienteId);
      if (!item || item.estado === ESTADOS.ENVIANDO) {
        setEstadoPendiente('no-disponible');
        return;
      }

      usarEnvio(item.clientId, item.fotosSubidas);
      setValoresIniciales(valoresDesdeDatos(item.datos));
      setEstadoPendiente('listo');
    });

    return () => {
      activo = false;
    };
  }, [pendienteId, uid, usarEnvio]);

  async function enviar(datos) {
    const resultado = await crear.publicar(datos);

    if (resultado) {
      await borrador.finalizar();
      setPublicada(resultado);
    }
  }

  async function guardarParaDespues(datos) {
    if (await crear.guardarParaDespues(datos)) {
      await borrador.finalizar();
    }
  }

  function retomarBorrador() {
    const registro = borrador.retomar();
    if (!registro) return;

    usarEnvio(registro.clientId, registro.fotosSubidas);
    setValoresIniciales(registro.valores);
  }

  if (publicada) {
    const franja = FRANJAS.find((f) => f.valor === publicada.franja)?.nombre;
    const lugar = publicada.barrio || 'Ubicación actual';
    const fecha = publicada.fecha.split('-').reverse().join('/');

    return (
      <Pantalla>
        <Tarjeta>
          <EstadoVacio
            icono="check-circle-outline"
            tono="exito"
            titulo={publicada.tipo === 'perdido' ? '¡Pérdida publicada!' : '¡Hallazgo publicado!'}
            mensaje={`Tu publicación "${publicada.titulo}" ya está registrada. Te avisaremos si aparece una coincidencia.

${publicada.categoria} · ${lugar} · ${fecha} · ${franja}

${publicada.fotos.length} foto(s) adjunta(s).`}
          >
            <Boton
              titulo="Ver mi publicación"
              onPress={() =>
                navigation.replace('GestionPublicacion', {
                  publicacionId: publicada.id,
                })
              }
            />

            <Boton
              titulo="Volver al buscador"
              variante="terciario"
              onPress={() => navigation.popToTop()}
            />
          </EstadoVacio>
        </Tarjeta>
      </Pantalla>
    );
  }

  if (crear.encolada) {
    return (
      <Pantalla>
        <Tarjeta>
          <EstadoVacio
            icono="tray-arrow-down"
            titulo="Publicación guardada"
            mensaje={'Quedó guardada en tu dispositivo y se enviará sola cuando haya conexión. Te avisamos cuando se publique. Podés seguir el estado en "Publicaciones pendientes".'}
          >
            <Boton
              titulo="Ver publicaciones pendientes"
              onPress={() => navigation.replace('PublicacionesPendientes')}
            />

            <Boton
              titulo="Volver al buscador"
              variante="terciario"
              onPress={() => navigation.popToTop()}
            />
          </EstadoVacio>
        </Tarjeta>
      </Pantalla>
    );
  }

  if (estadoPendiente === 'cargando' || (!pendienteId && borrador.cargando)) {
    return <Cargando pantalla />;
  }

  if (estadoPendiente === 'no-disponible') {
    return (
      <View style={estilosPantalla.centrado}>
        <EstadoVacio
          icono="tray-remove"
          mensaje="Esta publicación ya no está en la lista de pendientes o se está enviando."
        >
          <Boton titulo="Volver" variante="secundario" onPress={() => navigation.goBack()} />
        </EstadoVacio>
      </View>
    );
  }

  if (borrador.existente) {
    const { valores, guardadoAt } = borrador.existente;
    const titulo = valores.titulo.trim() ? `"${valores.titulo.trim()}" · ` : '';
    const fotos = valores.fotos.length > 0 ? ` · ${valores.fotos.length} foto(s)` : '';

    return (
      <Pantalla>
        <Tarjeta>
          <EstadoVacio
            icono="file-document-edit-outline"
            titulo="Tenés un borrador sin publicar"
            mensaje={`${titulo}guardado ${textoAntiguedad(guardadoAt)}${fotos}`}
          >
            <Boton titulo="Retomar borrador" onPress={retomarBorrador} />

            <Boton
              titulo="Descartar y empezar de nuevo"
              variante="peligro"
              onPress={borrador.descartar}
            />
          </EstadoVacio>
        </Tarjeta>
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      {pendienteId && (
        <Aviso
          tono="info"
          mensaje="Editá la publicación y volvé a guardarla: se enviará con la próxima conexión disponible."
        />
      )}

      <FormularioPublicacion
        tipoInicial={route.params?.tipo === 'encontre' ? 'encontre' : 'perdi'}
        valoresIniciales={valoresIniciales ?? undefined}
        enviando={crear.enviando}
        errorEnvio={crear.error}
        onEnviar={enviar}
        onEncolar={guardarParaDespues}
        alCambiar={borrador.guardar}
        copiarFoto={borrador.copiarFoto}
        alQuitarFoto={borrador.quitarFoto}
      />
    </Pantalla>
  );
}
