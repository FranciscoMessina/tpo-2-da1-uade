import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { isCancel } from 'axios';
import { enviarMensaje, obtenerMensajes } from '../services/mensajes';
import { mensajeErrorApi } from '../services/api';
import { useConexion } from '../context/ConexionContext';

const INTERVALO_ACTUALIZACION = 10000;

async function cargarMensajes(reclamoId, signal) {
  const mensajes = [];
  let pagina = 1;
  let datos;

  do {
    datos = await obtenerMensajes({ reclamoId, pagina, signal });
    mensajes.push(...datos.items);
    pagina += 1;
  } while (pagina <= datos.totalPages);

  return mensajes;
}

// Los mensajes nunca se borran: se une por id para no perder uno recién enviado
// si una consulta que ya estaba en curso responde sin él.
function unirMensajes(actuales, nuevos) {
  const porId = new Map();
  actuales.forEach((mensaje) => porId.set(mensaje.id, mensaje));
  nuevos.forEach((mensaje) => porId.set(mensaje.id, mensaje));
  return [...porId.values()].sort((a, b) => (
    a.creadaEn === b.creadaEn
      ? a.id.localeCompare(b.id)
      : a.creadaEn.localeCompare(b.creadaEn)
  ));
}

// Conversación de un reclamo aceptado. Se actualiza sola mientras la pantalla está
// enfocada y la app en primer plano, y no consulta ni envía sin conexión.
export default function useMensajesReclamo(reclamoId) {
  const { hayConexion } = useConexion();
  const [mensajes, setMensajes] = useState([]);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');
  const consultarActual = useRef(null);
  const enviandoAhora = useRef(false);

  useEffect(() => {
    setMensajes([]);
    setCargado(false);
    setError('');
    setErrorEnvio('');
  }, [reclamoId]);

  useFocusEffect(useCallback(() => {
    if (!hayConexion) {
      consultarActual.current = null;
      return undefined;
    }

    const controller = new AbortController();
    let consultando = false;
    let enPrimerPlano = AppState.currentState !== 'background'
      && AppState.currentState !== 'inactive';

    async function consultar() {
      if (consultando) return;
      consultando = true;
      try {
        const nuevos = await cargarMensajes(reclamoId, controller.signal);
        if (controller.signal.aborted) return;
        setMensajes((actuales) => unirMensajes(actuales, nuevos));
        setCargado(true);
        setError('');
      } catch (e) {
        if (controller.signal.aborted || isCancel(e)) return;
        setError(mensajeErrorApi(e));
      } finally {
        consultando = false;
      }
    }

    function actualizar() {
      if (enPrimerPlano) consultar();
    }

    consultarActual.current = consultar;
    consultar();
    const intervalo = setInterval(actualizar, INTERVALO_ACTUALIZACION);
    const suscripcion = AppState.addEventListener('change', (valor) => {
      enPrimerPlano = valor === 'active';
      if (enPrimerPlano) actualizar();
    });

    return () => {
      controller.abort();
      clearInterval(intervalo);
      suscripcion.remove();
      consultarActual.current = null;
    };
  }, [reclamoId, hayConexion]));

  const recargar = useCallback(async () => {
    if (!consultarActual.current) return;
    setError('');
    setRefrescando(true);
    try {
      await consultarActual.current();
    } finally {
      setRefrescando(false);
    }
  }, []);

  const enviar = useCallback(async (texto) => {
    const limpio = texto.trim();
    if (!limpio || enviandoAhora.current) return false;
    if (!hayConexion) {
      setErrorEnvio('Necesitás conexión a internet para enviar mensajes.');
      return false;
    }

    enviandoAhora.current = true;
    setEnviando(true);
    setErrorEnvio('');
    try {
      const mensaje = await enviarMensaje(reclamoId, limpio);
      setMensajes((actuales) => unirMensajes(actuales, [mensaje]));
      setCargado(true);
      return true;
    } catch (e) {
      setErrorEnvio(mensajeErrorApi(e));
      return false;
    } finally {
      enviandoAhora.current = false;
      setEnviando(false);
    }
  }, [reclamoId, hayConexion]);

  return {
    mensajes,
    cargando: hayConexion && !cargado && !error,
    cargado,
    error,
    refrescando,
    enviando,
    errorEnvio,
    recargar,
    enviar,
  };
}
