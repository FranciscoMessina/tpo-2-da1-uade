import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';
import MisReclamosScreen from '../../screens/MisReclamosScreen';
import { obtenerMisReclamos } from '../../services/publicaciones';
import { aceptarEncuentro, obtenerEncuentro } from '../../services/encuentros';
import { obtenerUltimosReclamos } from '../../services/cacheOffline';
import { __navegacion as navegacion } from '@react-navigation/native';
import { controlarAppState, diferida, restaurarAppState, simularConectividad } from '../hooks/entorno';

// Las APIs y la caché se reemplazan: ninguna prueba toca la red ni el dispositivo.
jest.mock('../../services/publicaciones');
jest.mock('../../services/encuentros');
jest.mock('../../services/cacheOffline');
jest.mock('../../services/historial');

// Cuenta y conexión que ve la pantalla: las pruebas las cambian y vuelven a renderizar.
let mockAuth;
let mockConexion;
jest.mock('../../hooks/useAuth', () => ({ __esModule: true, default: () => mockAuth }));
jest.mock('../../context/ConexionContext', () => ({ useConexion: () => mockConexion }));
jest.mock('../../context/SearchContext', () => ({
  useSearch: () => ({ novedadesPorReclamo: new Map() }),
}));
jest.mock('../../components/EvidenciaReclamo', () => {
  const { Text } = require('react-native');
  function EvidenciaDoble({ reclamo }) {
    return <Text>{reclamo.mensaje ?? ''}</Text>;
  }
  return EvidenciaDoble;
});

const nav = require('@react-navigation/native');

const publicacion = (extra = {}) => ({
  id: 'p1', tipo: 'encontrado', titulo: 'Llaves', categoria: 'Llaves', barrio: 'Palermo',
  estado: 'abierta', ...extra,
});
const reclamo = (id, extra = {}) => ({
  id, usuario: 'ana', estado: 'pendiente', intentos: 1, maxIntentos: 3,
  publicacion: publicacion({ id: `p${id}`, titulo: `Objeto ${id}` }), ...extra,
});
const encuentro = (direccion, extra = {}) => ({
  encuentro: { id: 'e1', estado: 'pendiente', direccion },
  puedeProponer: false, puedeResponder: true, intento: 1, ...extra,
});

// «Servidor» de la prueba: páginas de cada bandeja, que la prueba modifica entre ciclos.
let servidor;
function paginas(bandeja) {
  return servidor[bandeja];
}
function responder({ tipo, pagina = 1 }) {
  const lista = paginas(tipo);
  return Promise.resolve({
    items: lista[pagina - 1] ?? [],
    page: pagina,
    totalPages: lista.length,
    total: lista.flat().length,
  });
}

function pantalla() {
  return <MisReclamosScreen navigation={navegacion} />;
}

// Pedidos hechos a la API de reclamos desde la última vez, por bandeja.
function pedidos(tipo) {
  return obtenerMisReclamos.mock.calls.filter(([argumentos]) => argumentos.tipo === tipo);
}

async function avanzar(ms) {
  await act(async () => { jest.advanceTimersByTime(ms); });
}

let appState;
let enFoco;

beforeEach(() => {
  jest.useFakeTimers();
  appState = controlarAppState('active');
  simularConectividad(true);
  mockAuth = { usuario: { id: 'u1' } };
  mockConexion = { hayConexion: true };
  enFoco = true;
  jest.spyOn(nav, 'useIsFocused').mockImplementation(() => enFoco);
  servidor = { recibidos: [[reclamo('r1')]], enviados: [[]] };
  jest.mocked(obtenerMisReclamos).mockReset().mockImplementation(async (opciones) => responder(opciones));
  jest.mocked(obtenerEncuentro).mockReset();
  jest.mocked(aceptarEncuentro).mockReset();
  jest.mocked(obtenerUltimosReclamos).mockReset().mockResolvedValue(null);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  restaurarAppState();
});

describe('MisReclamosScreen: actualización con la pantalla visible', () => {
  test('muestra el cambio remoto en el siguiente ciclo de 20 s, no antes', async () => {
    render(pantalla());
    await act(async () => {});
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(pedidos('recibidos')).toHaveLength(1);

    // Otra cuenta rechaza el reclamo
    servidor.recibidos = [[reclamo('r1', { estado: 'rechazado' })]];
    await avanzar(19999);
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(pedidos('recibidos')).toHaveLength(1);

    await avanzar(1);
    expect(screen.getByText('Rechazado')).toBeTruthy();
    expect(screen.queryByText('Pendiente')).toBeNull();
    expect(pedidos('recibidos')).toHaveLength(2);
    expect(pedidos('enviados')).toHaveLength(2);
  });

  test('informa el vencimiento de 48 h que decide el backend', async () => {
    render(pantalla());
    await act(async () => {});
    expect(screen.queryByText(/Venció automáticamente/)).toBeNull();

    servidor.recibidos = [[reclamo('r1', { estado: 'vencido' })]];
    await avanzar(20000);

    expect(screen.getByText('Vencido (48 hs)')).toBeTruthy();
    expect(screen.getByText(/Venció automáticamente al cumplirse 48 hs/)).toBeTruthy();
  });

  test('mantiene los datos visibles mientras el refresco está en curso', async () => {
    render(pantalla());
    await act(async () => {});
    const pendiente = diferida();
    servidor.recibidos = [[reclamo('r1', { estado: 'aceptado' })]];
    obtenerMisReclamos.mockReturnValueOnce(pendiente.promesa); // enviados; recibidos responde ya

    await avanzar(20000);
    expect(pedidos('recibidos')).toHaveLength(2);
    // Mientras falta una respuesta, sigue la lista anterior y no hay indicador de carga ni error
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(screen.getByText('Objeto r1')).toBeTruthy();
    expect(screen.queryByText('Reintentar')).toBeNull();

    await act(async () => { pendiente.resolver({ items: [], page: 1, totalPages: 1, total: 0 }); });
    expect(screen.getByText('Aceptado')).toBeTruthy();
  });

  test('no superpone peticiones: con un refresco en curso los ciclos siguientes no piden nada', async () => {
    render(pantalla());
    await act(async () => {});
    const lento = diferida();
    obtenerMisReclamos.mockReturnValue(lento.promesa);

    await avanzar(20000);
    const iniciados = obtenerMisReclamos.mock.calls.length;
    await avanzar(60000);
    expect(obtenerMisReclamos.mock.calls).toHaveLength(iniciados);
  });

  test('un fallo del refresco periódico no tapa los datos que ya se veían', async () => {
    render(pantalla());
    await act(async () => {});
    obtenerMisReclamos.mockRejectedValue(new Error('sin respuesta'));

    await avanzar(20000);

    expect(screen.getByText('Objeto r1')).toBeTruthy();
    expect(screen.queryByText('Reintentar')).toBeNull();
  });
});

describe('MisReclamosScreen: foco, primer plano y conexión', () => {
  test('sin foco no hace peticiones y al recuperarlo vuelve a refrescar cada 20 s', async () => {
    const { rerender } = render(pantalla());
    await act(async () => {});
    const inicial = obtenerMisReclamos.mock.calls.length;

    enFoco = false;
    rerender(pantalla());
    await avanzar(120000);
    expect(obtenerMisReclamos.mock.calls).toHaveLength(inicial);

    enFoco = true;
    rerender(pantalla());
    servidor.recibidos = [[reclamo('r1', { estado: 'aceptado' })]];
    await avanzar(20000);
    expect(screen.getByText('Aceptado')).toBeTruthy();
  });

  test('en segundo plano no hace peticiones y al volver refresca de inmediato', async () => {
    render(pantalla());
    await act(async () => {});
    const inicial = obtenerMisReclamos.mock.calls.length;

    await act(async () => { appState.emitir('background'); });
    servidor.recibidos = [[reclamo('r1', { estado: 'rechazado' })]];
    await avanzar(120000);
    expect(obtenerMisReclamos.mock.calls).toHaveLength(inicial);
    expect(screen.getByText('Pendiente')).toBeTruthy();

    await act(async () => { appState.emitir('active'); });
    expect(screen.getByText('Rechazado')).toBeTruthy();
    expect(obtenerMisReclamos.mock.calls.length).toBeGreaterThan(inicial);
  });

  test('sin conexión no hace peticiones y al reconectar refresca de inmediato', async () => {
    const { rerender } = render(pantalla());
    await act(async () => {});
    const inicial = obtenerMisReclamos.mock.calls.length;

    mockConexion = { hayConexion: false };
    simularConectividad(false);
    rerender(pantalla());
    await avanzar(120000);
    expect(obtenerMisReclamos.mock.calls).toHaveLength(inicial);
    // Los datos ya cargados siguen visibles junto al aviso de modo sin conexión
    expect(screen.getByText('Modo sin conexión')).toBeTruthy();
    expect(screen.getByText('Objeto r1')).toBeTruthy();

    mockConexion = { hayConexion: true };
    simularConectividad(true);
    servidor.recibidos = [[reclamo('r1', { estado: 'aceptado' })]];
    rerender(pantalla());
    await act(async () => {});
    expect(screen.getByText('Aceptado')).toBeTruthy();
  });

  test('al desmontar cancela la petición en curso y deja de refrescar', async () => {
    const { unmount } = render(pantalla());
    await act(async () => {});
    const lento = diferida();
    obtenerMisReclamos.mockReturnValue(lento.promesa);
    await avanzar(20000);
    const enCurso = obtenerMisReclamos.mock.calls.at(-1)[0].signal;
    expect(enCurso.aborted).toBe(false);

    unmount();
    expect(enCurso.aborted).toBe(true);
    const total = obtenerMisReclamos.mock.calls.length;
    await avanzar(60000);
    expect(obtenerMisReclamos.mock.calls).toHaveLength(total);
  });
});

describe('MisReclamosScreen: cuentas y respuestas tardías', () => {
  test('cambiar de cuenta durante una petición descarta la respuesta de la cuenta anterior', async () => {
    const deUno = diferida();
    obtenerMisReclamos.mockReturnValueOnce(deUno.promesa).mockReturnValueOnce(deUno.promesa);
    const { rerender } = render(pantalla());
    const primera = obtenerMisReclamos.mock.calls[0][0].signal;

    mockAuth = { usuario: { id: 'u2' } };
    servidor.recibidos = [[reclamo('r9', { usuario: 'bruno' })]];
    rerender(pantalla());
    expect(primera.aborted).toBe(true);

    await act(async () => {
      deUno.resolver({ items: [reclamo('r1', { usuario: 'de-u1' })], page: 1, totalPages: 1, total: 1 });
    });
    await act(async () => {});

    expect(screen.queryByText('Objeto r1')).toBeNull();
    expect(screen.getByText('Objeto r9')).toBeTruthy();
  });

  test('al pasar a otra cuenta no queda a la vista lo cargado de la anterior', async () => {
    const { rerender } = render(pantalla());
    await act(async () => {});
    expect(screen.getByText('Objeto r1')).toBeTruthy();

    const deDos = diferida();
    obtenerMisReclamos.mockReturnValue(deDos.promesa);
    mockAuth = { usuario: { id: 'u2' } };
    rerender(pantalla());

    expect(screen.queryByText('Objeto r1')).toBeNull();
  });

  test('si la respuesta de un refresco llega después que la de uno posterior, queda la más nueva', async () => {
    render(pantalla());
    await act(async () => {});
    const vieja = diferida();
    const nueva = diferida();
    obtenerMisReclamos
      .mockReturnValueOnce(vieja.promesa) // enviados del ciclo periódico
      .mockReturnValueOnce(vieja.promesa) // recibidos del ciclo periódico
      .mockReturnValueOnce(nueva.promesa) // enviados del refresco manual
      .mockReturnValueOnce(nueva.promesa); // recibidos del refresco manual

    await avanzar(20000);
    await act(async () => { screen.UNSAFE_getByType(RefreshControl).props.onRefresh(); });

    await act(async () => {
      nueva.resolver({ items: [reclamo('r1', { estado: 'aceptado' })], page: 1, totalPages: 1, total: 1 });
    });
    await act(async () => {
      vieja.resolver({ items: [reclamo('r1', { estado: 'pendiente' })], page: 1, totalPages: 1, total: 1 });
    });

    expect(screen.getByText('Aceptado')).toBeTruthy();
    expect(screen.queryByText('Pendiente')).toBeNull();
  });
});

describe('MisReclamosScreen: paginación y estado de la pantalla', () => {
  const doble = () => ({
    recibidos: [[reclamo('r1'), reclamo('r2')], [reclamo('r3')]],
    enviados: [[]],
  });

  test('al refrescar reemplaza la primera página y reinicia el cursor sin mezclar páginas viejas', async () => {
    servidor = doble();
    render(pantalla());
    await act(async () => {});
    await act(async () => { fireEvent.press(screen.getByText('Cargar más reclamos')); });
    expect(screen.getByText('Objeto r3')).toBeTruthy();
    expect(pedidos('recibidos').at(-1)[0].pagina).toBe(2);
    expect(screen.queryByText('Cargar más reclamos')).toBeNull();

    // El servidor cambió: la primera página ahora trae un reclamo nuevo y r2 desapareció
    servidor.recibidos = [[reclamo('r7'), reclamo('r1')], [reclamo('r2'), reclamo('r3')]];
    await avanzar(20000);

    expect(screen.getByText('Objeto r7')).toBeTruthy();
    expect(screen.getByText('Objeto r1')).toBeTruthy();
    expect(screen.queryByText('Objeto r2')).toBeNull();
    expect(screen.queryByText('Objeto r3')).toBeNull();
    // El cursor vuelve a la página 1: se ofrece cargar la siguiente otra vez
    await act(async () => { fireEvent.press(screen.getByText('Cargar más reclamos')); });
    expect(pedidos('recibidos').at(-1)[0].pagina).toBe(2);
    expect(screen.getByText('Objeto r2')).toBeTruthy();
    expect(screen.getByText('Objeto r3')).toBeTruthy();
  });

  test('una página pedida antes del refresco y respondida después no se mezcla con la lista nueva', async () => {
    servidor = doble();
    render(pantalla());
    await act(async () => {});
    const segunda = diferida();
    obtenerMisReclamos.mockReturnValueOnce(segunda.promesa);
    await act(async () => { fireEvent.press(screen.getByText('Cargar más reclamos')); });

    servidor.recibidos = [[reclamo('r7')], [reclamo('r8')]];
    await avanzar(20000);
    await act(async () => {
      segunda.resolver({ items: [reclamo('r3')], page: 2, totalPages: 2, total: 3 });
    });

    expect(screen.getByText('Objeto r7')).toBeTruthy();
    expect(screen.queryByText('Objeto r3')).toBeNull();
    expect(screen.queryByText('Objeto r1')).toBeNull();
  });

  test('conserva la pestaña activa al refrescar', async () => {
    servidor = {
      recibidos: [[reclamo('r1')]],
      enviados: [[reclamo('e1', { usuario: 'yo' })]],
    };
    render(pantalla());
    await act(async () => {});
    fireEvent.press(screen.getByText(/Enviados/));
    expect(screen.getByText('Objeto e1')).toBeTruthy();

    servidor.enviados = [[reclamo('e1', { usuario: 'yo', estado: 'aceptado' })]];
    await avanzar(20000);

    expect(screen.getByText('Aceptado')).toBeTruthy();
    expect(screen.getByText('Objeto e1')).toBeTruthy();
    expect(screen.queryByText('Objeto r1')).toBeNull();
  });

  test('sin conexión desde el inicio muestra los reclamos guardados y el aviso', async () => {
    mockConexion = { hayConexion: false };
    simularConectividad(false);
    obtenerUltimosReclamos.mockResolvedValue({ enviados: [], recibidos: [reclamo('r5')] });

    render(pantalla());
    await act(async () => {});
    await avanzar(60000);

    expect(screen.getByText('Modo sin conexión')).toBeTruthy();
    expect(screen.getByText('Objeto r5')).toBeTruthy();
    expect(obtenerMisReclamos).not.toHaveBeenCalled();
  });

  test('el error de la primera carga se puede reintentar con el botón', async () => {
    obtenerMisReclamos.mockRejectedValue({ response: { data: { error: { message: 'Servicio caído' } } } });
    render(pantalla());
    await act(async () => {});
    expect(screen.getByText('Servicio caído')).toBeTruthy();

    obtenerMisReclamos.mockImplementation(async (opciones) => responder(opciones));
    await act(async () => { fireEvent.press(screen.getByText('Reintentar')); });

    expect(screen.queryByText('Servicio caído')).toBeNull();
    expect(screen.getByText('Objeto r1')).toBeTruthy();
  });
});

describe('MisReclamosScreen: encuentro de un reclamo aceptado', () => {
  const aceptado = (extra = {}) => reclamo('r1', {
    estado: 'aceptado',
    publicacion: publicacion({ id: 'p1', titulo: 'Objeto r1', estado: 'en_reclamo' }),
    ...extra,
  });
  const campo = () => screen.getByLabelText('Dirección y localidad del punto de encuentro');

  test('la aceptación remota hace aparecer el encuentro sin intervención manual', async () => {
    obtenerEncuentro.mockResolvedValue(encuentro('Plaza Italia'));
    render(pantalla());
    await act(async () => {});
    expect(obtenerEncuentro).not.toHaveBeenCalled();

    // La otra cuenta acepta el reclamo y la publicación pasa a «En reclamo»
    servidor.recibidos = [[aceptado()]];
    await avanzar(20000);

    expect(screen.getByText('Aceptado')).toBeTruthy();
    expect(screen.getByText('Plaza Italia')).toBeTruthy();
  });

  test('el encuentro se actualiza en el siguiente ciclo y conserva la contrapropuesta en edición', async () => {
    servidor.recibidos = [[aceptado()]];
    obtenerEncuentro.mockResolvedValue(encuentro('Plaza Italia'));
    render(pantalla());
    await act(async () => {});
    fireEvent.press(screen.getByText('Sugerir otro lugar'));
    fireEvent.changeText(campo(), 'Av. Corrientes 1234');

    obtenerEncuentro.mockResolvedValue({
      ...encuentro('Plaza Italia'),
      encuentro: { id: 'e1', estado: 'pendiente', direccion: 'Parque Centenario' },
    });
    await avanzar(20000);

    expect(screen.getByText('Parque Centenario')).toBeTruthy();
    expect(screen.queryByText('Plaza Italia')).toBeNull();
    expect(campo().props.value).toBe('Av. Corrientes 1234');
    // Y durante el refresco no se reemplazó el encuentro por un indicador de carga
    expect(screen.queryByLabelText('Cargando encuentro')).toBeNull();
  });

  test('una consulta del encuentro en camino no pisa lo que devuelve aceptarlo', async () => {
    servidor.recibidos = [[aceptado()]];
    obtenerEncuentro.mockResolvedValue(encuentro('Plaza Italia'));
    render(pantalla());
    await act(async () => {});

    const vieja = diferida();
    obtenerEncuentro.mockReturnValueOnce(vieja.promesa);
    await avanzar(20000);
    aceptarEncuentro.mockResolvedValue(
      encuentro('Plaza Italia', { encuentro: { id: 'e1', estado: 'aceptado', direccion: 'Plaza Italia' } })
    );
    await act(async () => { fireEvent.press(screen.getByText('Aceptar encuentro')); });
    expect(screen.getByText('Encuentro acordado')).toBeTruthy();

    // Responde tarde la consulta que salió antes de aceptar, con el estado anterior
    await act(async () => { vieja.resolver(encuentro('Plaza Italia')); });
    expect(screen.getByText('Encuentro acordado')).toBeTruthy();
    expect(screen.queryByText('Propuesta de encuentro')).toBeNull();
  });

  test('no superpone consultas del encuentro y un fallo del refresco conserva lo que se veía', async () => {
    servidor.recibidos = [[aceptado()]];
    obtenerEncuentro.mockResolvedValue(encuentro('Plaza Italia'));
    render(pantalla());
    await act(async () => {});
    expect(obtenerEncuentro).toHaveBeenCalledTimes(1);

    const lenta = diferida();
    obtenerEncuentro.mockReturnValue(lenta.promesa);
    await avanzar(60000);
    expect(obtenerEncuentro).toHaveBeenCalledTimes(2);

    await act(async () => { lenta.rechazar(new Error('sin respuesta')); });
    expect(screen.getByText('Plaza Italia')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('el encuentro no se pide mientras la app está en segundo plano', async () => {
    servidor.recibidos = [[aceptado()]];
    obtenerEncuentro.mockResolvedValue(encuentro('Plaza Italia'));
    render(pantalla());
    await act(async () => {});
    const inicial = obtenerEncuentro.mock.calls.length;

    await act(async () => { appState.emitir('background'); });
    await avanzar(120000);

    expect(obtenerEncuentro.mock.calls).toHaveLength(inicial);
  });
});
