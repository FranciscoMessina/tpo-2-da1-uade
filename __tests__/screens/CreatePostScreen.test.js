import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AxiosError } from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as archivosLocales from '../../services/archivosLocales';
import CreatePostScreen from '../../screens/CreatePostScreen';
import { api } from '../../services/api';
import { claveBorrador, leerBorrador } from '../../services/borradores';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fechaLocal } from '../../data/busqueda';
import { ESTADOS, leerCola } from '../../services/colaPublicaciones';
import * as conexion from '../../services/conexion';
import { procesarCola } from '../../services/procesadorCola';
import { __navegacion as navegacion } from '@react-navigation/native';
import { diferida, simularConectividad } from '../hooks/entorno';
import { elegirBarrio, elegirCategoria, elegirHora } from '../components/ayudas';

// Recorridos de la pantalla de alta con la cola, el borrador y el servicio de publicaciones reales.
// Solo se reemplazan los bordes: la sesión, el GPS, el contexto que dispara el procesador y la red
// (api.post / api.get), que se sustituye por un servidor simulado con la misma idempotencia por
// clientId que el backend (tests/app.test.ts, «clientId hace idempotente el alta por usuario»).

let mockUsuario = { id: 'cuenta-a' };
let mockHayConexion = true;
const mockProcesarAhora = jest.fn();

jest.mock('../../hooks/useAuth', () => ({
  __esModule: true,
  default: () => ({ usuario: mockUsuario, sesionOffline: false }),
}));

jest.mock('../../context/ColaPublicacionesContext', () => ({
  useColaPublicaciones: () => ({ procesarAhora: mockProcesarAhora }),
}));

jest.mock('../../context/ConexionContext', () => ({
  useConexion: () => ({ hayConexion: mockHayConexion, comprobarConexion: async () => mockHayConexion }),
}));

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

jest.mock('../../hooks/useUbicacionActual', () => ({
  __esModule: true,
  default: () => ({ obtener: jest.fn(), cargando: false, error: '' }),
}));

// El backend guarda y devuelve «perdido» / «encontrado» aunque reciba «perdi» / «encontre».
const TIPO_API = { perdi: 'perdido', encontre: 'encontrado' };

const errorDeRed = () => new AxiosError('Network Error', 'ERR_NETWORK');

/**
 * Servidor simulado: guarda una publicación por (cuenta, clientId) y devuelve la ya creada si el
 * cliente reintenta. `perderRespuesta` hace que la próxima alta se guarde pero el cliente no
 * reciba la respuesta (corte de red justo después de crear).
 */
function servidor() {
  const publicaciones = new Map();
  const llamadas = [];
  const estado = { perderRespuesta: 0, caido: false, cuenta: 'cuenta-a' };

  jest.spyOn(api, 'get').mockImplementation(async () => {
    throw errorDeRed();
  });
  jest.spyOn(api, 'post').mockImplementation(async (ruta, cuerpo) => {
    if (ruta !== '/publicaciones') throw new Error(`Ruta inesperada en la prueba: ${ruta}`);
    llamadas.push({ cuenta: estado.cuenta, clientId: cuerpo.clientId, cuerpo });
    if (estado.caido) throw errorDeRed();

    const clave = `${estado.cuenta}/${cuerpo.clientId}`;
    if (!publicaciones.has(clave)) {
      publicaciones.set(clave, { id: `pub-${publicaciones.size + 1}`, estado: 'abierta', fotos: [], ...cuerpo, tipo: TIPO_API[cuerpo.tipo] });
    }
    if (estado.perderRespuesta > 0) {
      estado.perderRespuesta -= 1;
      throw errorDeRed();
    }
    return { data: publicaciones.get(clave) };
  });

  return { publicaciones, llamadas, estado };
}

const cambiar = (etiqueta, valor) => fireEvent.changeText(screen.getByLabelText(etiqueta), valor);
const tocar = (texto) => fireEvent.press(screen.getByText(texto));
const presionar = (texto) => act(async () => { fireEvent.press(screen.getByText(texto)); });

/**
 * Recorre los pasos del asistente (tipo, fotos, datos, ubicación) y deja la pantalla en el último
 * paso de una pérdida: la ubicación. Para un hallazgo, 'Siguiente' lleva a la verificación.
 */
function completarFormulario(titulo = 'Llavero azul con tres llaves') {
  tocar('Siguiente');
  tocar('Siguiente');
  cambiar('Título', titulo);
  elegirCategoria('Llaves');
  cambiar('Descripción', 'Tres llaves con un llavero de color azul.');
  elegirHora('10:30');
  tocar('Siguiente');
  elegirBarrio('Palermo');
  cambiar('Dirección exacta', 'Av. Santa Fe 3000');
}

function montar(params = {}) {
  navegacion.replace.mockClear();
  return render(<CreatePostScreen route={{ params }} navigation={navegacion} />);
}

/** Espera a que el borrador de la cuenta termine de cargarse (el formulario o el aviso de borrador). */
const cargado = () => act(async () => {});

beforeEach(() => {
  mockUsuario = { id: 'cuenta-a' };
  mockHayConexion = true;
  mockProcesarAhora.mockReset();
  simularConectividad(true);
});

afterEach(() => jest.restoreAllMocks());

describe('CreatePostScreen: borrador', () => {
  test('al salir de la pantalla conserva lo escrito y al volver a abrirla ofrece retomarlo con los mismos datos', async () => {
    servidor();
    const primera = montar();
    await cargado();
    completarFormulario();
    primera.unmount();
    await cargado();

    const guardado = await leerBorrador('cuenta-a');
    expect(guardado.valores).toMatchObject({
      titulo: 'Llavero azul con tres llaves', categoria: 'Llaves', barrio: 'Palermo', hora: '10:30',
      direccionExacta: 'Av. Santa Fe 3000', paso: 4,
    });
    expect(guardado.valores).not.toHaveProperty('franja');

    // «Reiniciar la app»: se monta una pantalla nueva y la persona decide qué hacer con el borrador.
    montar();
    await cargado();
    expect(screen.getByText('Tenés un borrador sin publicar')).toBeTruthy();
    expect(screen.getByText(/Llavero azul con tres llaves/)).toBeTruthy();

    await presionar('Retomar borrador');
    // Vuelve al paso donde se estaba, con los mismos datos en los pasos anteriores.
    expect(screen.getByText('Paso 4 de 4')).toBeTruthy();
    expect(screen.getByLabelText('Dirección exacta').props.value).toBe('Av. Santa Fe 3000');
    expect(screen.getByLabelText('Barrio').props.accessibilityValue.text).toBe('Palermo');
    tocar('Atrás');
    expect(screen.getByLabelText('Título').props.value).toBe('Llavero azul con tres llaves');
    expect(screen.getByLabelText('Descripción').props.value).toBe('Tres llaves con un llavero de color azul.');
    expect(screen.getByLabelText('Hora del suceso').props.accessibilityValue.text).toBe('10:30');
  });

  test('descartar el borrador lo elimina y deja el formulario vacío', async () => {
    servidor();
    const primera = montar();
    await cargado();
    completarFormulario();
    primera.unmount();
    await cargado();
    expect(await leerBorrador('cuenta-a')).not.toBeNull();

    montar();
    await cargado();
    await presionar('Descartar y empezar de nuevo');

    expect(await leerBorrador('cuenta-a')).toBeNull();
    expect(screen.getByText('Paso 1 de 4')).toBeTruthy();
    tocar('Siguiente');
    tocar('Siguiente');
    expect(screen.getByLabelText('Título').props.value).toBe('');
  });

  test('el borrador es de cada cuenta: otra cuenta en el mismo dispositivo no lo ve ni lo pisa', async () => {
    servidor();
    const deA = montar();
    await cargado();
    completarFormulario('Llavero de la cuenta A');
    deA.unmount();
    await cargado();

    mockUsuario = { id: 'cuenta-b' };
    const deB = montar();
    await cargado();
    expect(screen.queryByText('Tenés un borrador sin publicar')).toBeNull();
    completarFormulario('Mochila de la cuenta B');
    deB.unmount();
    await cargado();

    expect((await leerBorrador('cuenta-a')).valores.titulo).toBe('Llavero de la cuenta A');
    expect((await leerBorrador('cuenta-b')).valores.titulo).toBe('Mochila de la cuenta B');

    // Al volver la cuenta A, el borrador que se ofrece es el suyo.
    mockUsuario = { id: 'cuenta-a' };
    montar();
    await cargado();
    expect(screen.getByText(/Llavero de la cuenta A/)).toBeTruthy();
    expect(screen.queryByText(/Mochila de la cuenta B/)).toBeNull();
  });
});

describe('CreatePostScreen: borrador por pasos', () => {
  test('retoma el paso en el que se estaba, con las fotos y los datos de los pasos anteriores', async () => {
    servidor();
    jest.spyOn(archivosLocales, 'existeArchivo').mockReturnValue(true);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///galeria/llavero.jpg' }],
    });
    const primera = montar();
    await cargado();
    tocar('Siguiente');
    await presionar('Elegir de la galería');
    expect(screen.getAllByLabelText('Foto elegida')).toHaveLength(1);
    tocar('Siguiente');
    cambiar('Título', 'Llavero con foto');
    primera.unmount();
    await cargado();

    const guardado = await leerBorrador('cuenta-a');
    expect(guardado.valores).toMatchObject({ paso: 3, titulo: 'Llavero con foto' });
    expect(guardado.valores.fotos).toHaveLength(1);

    montar();
    await cargado();
    await presionar('Retomar borrador');

    expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
    expect(screen.getByLabelText('Título').props.value).toBe('Llavero con foto');
    tocar('Atrás');
    expect(screen.getAllByLabelText('Foto elegida')).toHaveLength(1);
  });

  test('un borrador de una versión anterior (con franja, sin hora ni paso) se retoma y pide la hora', async () => {
    servidor();
    await AsyncStorage.setItem(claveBorrador('cuenta-a'), JSON.stringify({
      version: 1,
      guardadoAt: Date.now(),
      clientId: 'app-viejo',
      fotosSubidas: {},
      valores: {
        tipo: 'perdi', titulo: 'Llavero viejo', categoria: 'Llaves', descripcion: 'Tres llaves con un llavero azul.',
        barrio: 'Palermo', fecha: fechaLocal(), franja: 'tarde', direccionExacta: 'Calle 1', fotos: [],
        preguntaVerificacion: '', respuestaVerificacion: '',
      },
    }));
    montar();
    await cargado();
    await presionar('Retomar borrador');

    expect(screen.getByText('Paso 1 de 4')).toBeTruthy();
    tocar('Siguiente');
    tocar('Siguiente');
    tocar('Siguiente');
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
    expect(screen.getByText('Elegí la hora del suceso.')).toBeTruthy();
  });
});

describe('CreatePostScreen: sin conexión y reintento', () => {
  test('sin conexión la publicación queda en la cola de la cuenta, sin llamar al servidor, y el borrador se cierra', async () => {
    const { llamadas } = servidor();
    mockHayConexion = false;
    simularConectividad(false);
    montar();
    await cargado();
    completarFormulario();

    expect(screen.getByText(/Sin conexión: podés guardar la publicación/)).toBeTruthy();
    await presionar('Guardar para enviar después');

    expect(screen.getByText('Publicación guardada')).toBeTruthy();
    expect(llamadas).toHaveLength(0);
    expect(mockProcesarAhora).toHaveBeenCalledTimes(1);
    const cola = await leerCola('cuenta-a');
    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({ estado: ESTADOS.PENDIENTE, datos: {
        titulo: 'Llavero azul con tres llaves', tipo: 'perdi', barrio: 'Palermo', hora: '10:30', direccionExacta: 'Av. Santa Fe 3000',
      },
    });
    expect(await leerBorrador('cuenta-a')).toBeNull();
    // Otra cuenta del mismo dispositivo no ve la cola ajena.
    expect(await leerCola('cuenta-b')).toEqual([]);
  });

  test('al volver la conexión la cola publica una sola vez, aun si se pierde la respuesta del primer envío', async () => {
    const { llamadas, publicaciones, estado } = servidor();
    mockHayConexion = false;
    simularConectividad(false);
    montar();
    await cargado();
    completarFormulario();
    await presionar('Guardar para enviar después');
    const [item] = await leerCola('cuenta-a');

    // Vuelve la red, pero el servidor guarda la alta y la respuesta nunca llega.
    simularConectividad(true);
    estado.perderRespuesta = 1;
    const primero = await procesarCola('cuenta-a', { ignorarEspera: true });
    expect(primero.motivo).toBe('sin-conexion');
    expect(publicaciones.size).toBe(1);
    expect((await leerCola('cuenta-a'))[0]).toMatchObject({ id: item.id, estado: ESTADOS.PENDIENTE });

    // El reintento reutiliza el mismo clientId: el servidor devuelve la misma publicación y la cola se vacía.
    simularConectividad(true);
    const segundo = await procesarCola('cuenta-a', { ignorarEspera: true });
    expect(segundo).toMatchObject({ enviadas: 1, motivo: 'vacia' });
    expect(publicaciones.size).toBe(1);
    expect(new Set(llamadas.map((l) => l.clientId)).size).toBe(1);
    expect(llamadas).toHaveLength(2);
    expect(await leerCola('cuenta-a')).toEqual([]);
    // Con la cola vacía, un procesamiento más no vuelve a publicar.
    await procesarCola('cuenta-a', { ignorarEspera: true });
    expect(publicaciones.size).toBe(1);
  });

  test('una cuenta solo procesa su propia cola', async () => {
    const { publicaciones, estado } = servidor();
    mockHayConexion = false;
    simularConectividad(false);
    montar();
    await cargado();
    completarFormulario();
    await presionar('Guardar para enviar después');

    simularConectividad(true);
    estado.cuenta = 'cuenta-b';
    expect(await procesarCola('cuenta-b', { ignorarEspera: true })).toMatchObject({ enviadas: 0, motivo: 'vacia' });
    expect(publicaciones.size).toBe(0);
    expect(await leerCola('cuenta-a')).toHaveLength(1);

    estado.cuenta = 'cuenta-a';
    expect(await procesarCola('cuenta-a', { ignorarEspera: true })).toMatchObject({ enviadas: 1 });
    expect([...publicaciones.keys()].every((clave) => clave.startsWith('cuenta-a/'))).toBe(true);
  });

  test('publicar en línea reintentando tras un corte envía el mismo clientId y crea una sola publicación', async () => {
    const { llamadas, publicaciones, estado } = servidor();
    montar();
    await cargado();
    completarFormulario();

    estado.perderRespuesta = 1;
    await presionar('Publicar mi pérdida');
    expect(screen.queryByText('¡Pérdida publicada!')).toBeNull();
    expect(screen.getByText(/No pudimos conectar con el servidor/)).toBeTruthy();

    await presionar('Publicar mi pérdida');
    expect(screen.getByText('¡Pérdida publicada!')).toBeTruthy();
    expect(screen.getByText(/Llaves · Palermo · \d\d\/\d\d\/\d{4} · 10:30 h/)).toBeTruthy();
    expect(llamadas).toHaveLength(2);
    expect(llamadas[1].clientId).toBe(llamadas[0].clientId);
    expect(publicaciones.size).toBe(1);
    expect(await leerBorrador('cuenta-a')).toBeNull();
    // El cuerpo lleva barrio, dirección y hora; la franja la deriva el servidor.
    expect(llamadas[0].cuerpo).toMatchObject({ barrio: 'Palermo', direccionExacta: 'Av. Santa Fe 3000', hora: '10:30' });
    expect(llamadas[0].cuerpo).not.toHaveProperty('franja');
  });

  test('un segundo toque mientras se envía no dispara otra alta', async () => {
    const { llamadas } = servidor();
    const espera = diferida();
    api.post.mockImplementation(async (ruta, cuerpo) => {
      llamadas.push({ clientId: cuerpo.clientId });
      await espera.promesa;
      return { data: { id: 'pub-1', estado: 'abierta', fotos: [], ...cuerpo, tipo: TIPO_API[cuerpo.tipo] } };
    });
    jest.spyOn(conexion, 'verificarConexion').mockResolvedValue(true);
    montar();
    await cargado();
    completarFormulario();

    await presionar('Publicar mi pérdida');
    // El botón pasa a «Guardando…» y queda deshabilitado mientras responde el servidor.
    const boton = screen.getByText('Guardando…');
    fireEvent.press(boton);
    fireEvent.press(boton);
    await act(async () => { espera.resolver(); });

    expect(llamadas).toHaveLength(1);
    expect(screen.getByText('¡Pérdida publicada!')).toBeTruthy();
  });

  test('tras publicar, un formulario nuevo es otra publicación con otro clientId', async () => {
    const { llamadas, publicaciones } = servidor();
    const primera = montar();
    await cargado();
    completarFormulario('Primera publicación');
    await presionar('Publicar mi pérdida');
    expect(screen.getByText('¡Pérdida publicada!')).toBeTruthy();
    primera.unmount();

    montar();
    await cargado();
    completarFormulario('Segunda publicación');
    await presionar('Publicar mi pérdida');

    expect(llamadas).toHaveLength(2);
    expect(llamadas[1].clientId).not.toBe(llamadas[0].clientId);
    expect(publicaciones.size).toBe(2);
  });
});
