import { useState } from 'react';
import { Linking } from 'react-native';
import {
  Aviso,
  Boton,
  Campo,
  NotaSinConexion,
  Panel,
  Texto,
} from './ui';

export default function PuntoEncuentro({
  reclamoAceptado = false,
  encuentro = null,
  puedeProponer = false,
  puedeResponder = false,
  guardando = false,
  hayConexion = true,
  error = '',
  onProponer,
  onAceptar,
}) {
  const [direccion, setDireccion] = useState('');
  const [alternativa, setAlternativa] = useState(false);
  const [errorLocal, setErrorLocal] = useState('');
  const [enviando, setEnviando] = useState(false);

  const ocupado = guardando || enviando;
  const pendiente = encuentro?.estado === 'pendiente';
  const aceptado = encuentro?.estado === 'aceptado';
  const responder = pendiente && puedeResponder;
  const mostrarFormulario = (!encuentro && puedeProponer) || (responder && alternativa);

  async function proponer() {
    const texto = direccion.trim();
    if (ocupado || !mostrarFormulario || typeof onProponer !== 'function') return;
    if (!hayConexion) {
      setErrorLocal('Se necesita conexión a internet para proponer un punto de encuentro.');
      return;
    }
    if (!texto) {
      setErrorLocal('Ingresá la dirección del punto de encuentro.');
      return;
    }
    setErrorLocal('');
    setEnviando(true);
    try {
      const guardado = await onProponer(texto);
      if (guardado === true) {
        setDireccion('');
        setAlternativa(false);
      }
    } catch {
      setErrorLocal('No se pudo enviar la propuesta. Intentá nuevamente.');
    } finally {
      setEnviando(false);
    }
  }

  async function aceptar() {
    if (ocupado || !responder || typeof onAceptar !== 'function') return;
    if (!hayConexion) {
      setErrorLocal('Se necesita conexión a internet para aceptar el punto de encuentro.');
      return;
    }
    setErrorLocal('');
    setEnviando(true);
    try {
      await onAceptar();
    } catch {
      setErrorLocal('No se pudo aceptar el encuentro. Intentá nuevamente.');
    } finally {
      setEnviando(false);
    }
  }

  async function comoLlegar() {
    const destino = encuentro?.direccion?.trim();
    if (!destino) return;
    setErrorLocal('');
    try {
      await Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}&dir_action=navigate`
      );
    } catch {
      setErrorLocal('No se pudo abrir Maps. Podés copiar la dirección e intentar nuevamente.');
    }
  }

  if (!reclamoAceptado) {
    return (
      <Panel>
        <Texto variante="subtitulo">Punto de encuentro</Texto>
        <Texto variante="cuerpoChico" tono="secundario">
          Primero debe aceptarse el reclamo para coordinar la devolución.
        </Texto>
      </Panel>
    );
  }

  return (
    <Panel>
      <Texto variante="subtitulo">Punto de encuentro</Texto>

      {encuentro ? (
        <>
          <Texto variante="etiqueta" tono="secundario">
            {aceptado ? 'Encuentro acordado' : 'Propuesta de encuentro'}
          </Texto>
          <Texto selectable>{encuentro.direccion}</Texto>
          {pendiente && (
            <Texto variante="cuerpoChico" tono="secundario">
              {puedeResponder
                ? 'Podés aceptar este lugar o sugerir otro.'
                : 'Esperando la respuesta de la otra persona.'}
            </Texto>
          )}
          <Boton
            titulo="Cómo llegar"
            icono="map-marker-path"
            variante="secundario"
            chico
            onPress={comoLlegar}
            disabled={!encuentro.direccion?.trim()}
          />
        </>
      ) : (
        <Texto variante="cuerpoChico" tono="secundario">
          {puedeProponer
            ? 'Proponé un lugar para devolver el objeto.'
            : 'La persona que tiene el objeto debe proponer un lugar.'}
        </Texto>
      )}

      {responder && !alternativa && (
        <>
          <Boton
            titulo={ocupado ? 'Guardando…' : 'Aceptar encuentro'}
            chico
            cargando={ocupado}
            disabled={!hayConexion || typeof onAceptar !== 'function'}
            onPress={aceptar}
          />
          <Boton
            titulo="Sugerir otro lugar"
            variante="terciario"
            chico
            disabled={ocupado || !hayConexion || typeof onProponer !== 'function'}
            onPress={() => { setErrorLocal(''); setAlternativa(true); }}
          />
        </>
      )}

      {mostrarFormulario && (
        <>
          <Campo
            etiqueta="Dirección y localidad"
            accessibilityLabel="Dirección y localidad del punto de encuentro"
            value={direccion}
            onChangeText={(texto) => { setDireccion(texto); setErrorLocal(''); }}
            placeholder="Ej.: Av. Santa Fe 1234, CABA"
            maxLength={200}
            editable={!ocupado}
          />
          <Boton
            titulo={ocupado ? 'Enviando…' : 'Enviar propuesta'}
            chico
            cargando={ocupado}
            disabled={!hayConexion || typeof onProponer !== 'function'}
            onPress={proponer}
          />
          {alternativa && (
            <Boton
              titulo="Cancelar"
              variante="terciario"
              chico
              disabled={ocupado}
              onPress={() => { setAlternativa(false); setDireccion(''); setErrorLocal(''); }}
            />
          )}
        </>
      )}

      {!hayConexion && (responder || mostrarFormulario) && (
        <NotaSinConexion>
          Se necesita conexión a internet para coordinar el punto de encuentro.
        </NotaSinConexion>
      )}

      {!!(errorLocal || error) && (
        <Aviso tono="peligro" mensaje={errorLocal || error} accessibilityRole="alert" />
      )}
    </Panel>
  );
}
