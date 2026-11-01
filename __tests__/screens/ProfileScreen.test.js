import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ProfileScreen from '../../screens/ProfileScreen';
import usePerfil from '../../hooks/usePerfil';
import useAuth from '../../hooks/useAuth';
import { useConexion } from '../../context/ConexionContext';
import { __navegacion as navegacion } from '@react-navigation/native';
import { simularConectividad } from '../hooks/entorno';
import { elegirBarrio } from '../components/ayudas';

// Hooks y contexto se reemplazan: la prueba no toca la red ni el servidor.
jest.mock('../../hooks/usePerfil');
jest.mock('../../hooks/useAuth');
jest.mock('../../context/ConexionContext');
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

// Componentes con datos propios que no son objeto de estas pruebas.
jest.mock('../../components/ReputationCard', () => () => null);
jest.mock('../../components/BadgesCard', () => () => null);

const GUARDAR = 'Guardar cambios';
const AVISO = /Sin conexión: no se puede guardar el perfil/;

const perfil = {
  id: 'u1',
  name: 'Ana Pérez',
  zone: 'Palermo',
  phone: '1155550000',
  avatarUrl: null,
  sharePhone: false,
  reputation: null,
  badges: [],
};

let estadoPerfil;
let cerrarSesion;

beforeEach(() => {
  cerrarSesion = jest.fn();
  estadoPerfil = {
    perfil,
    loading: false,
    guardando: false,
    error: '',
    guardarPerfil: jest.fn().mockResolvedValue(true),
    recargarPerfil: jest.fn(),
  };
  jest.mocked(usePerfil).mockImplementation(() => estadoPerfil);
  jest.mocked(useAuth).mockReturnValue({ cerrarSesion, loading: false });
  jest.mocked(useConexion).mockReturnValue({ hayConexion: true });
  simularConectividad(true);
});

afterEach(() => jest.restoreAllMocks());

const pantalla = () => <ProfileScreen navigation={navegacion} />;

function editar() {
  const vista = render(pantalla());
  fireEvent.press(screen.getByText('Editar perfil'));
  return vista;
}

describe('ProfileScreen — guardar el perfil sin conexión', () => {
  test('con conexión guarda los cambios', async () => {
    editar();

    expect(screen.getByText(GUARDAR)).not.toBeDisabled();
    expect(screen.queryByText(AVISO)).toBeNull();

    await act(async () => { fireEvent.press(screen.getByText(GUARDAR)); });

    expect(estadoPerfil.guardarPerfil).toHaveBeenCalledTimes(1);
  });

  test('sin conexión deshabilita guardar, lo explica y no llama a la API', () => {
    jest.mocked(useConexion).mockReturnValue({ hayConexion: false });
    simularConectividad(false);
    editar();

    expect(screen.getByText(GUARDAR)).toBeDisabled();
    expect(screen.getByText(AVISO)).toBeTruthy();

    fireEvent.press(screen.getByText(GUARDAR));
    expect(estadoPerfil.guardarPerfil).not.toHaveBeenCalled();
  });

  test('al volver la conexión se habilita y guarda', async () => {
    jest.mocked(useConexion).mockReturnValue({ hayConexion: false });
    const vista = editar();
    expect(screen.getByText(GUARDAR)).toBeDisabled();

    jest.mocked(useConexion).mockReturnValue({ hayConexion: true });
    vista.rerender(pantalla());

    expect(screen.getByText(GUARDAR)).not.toBeDisabled();
    expect(screen.queryByText(AVISO)).toBeNull();

    await act(async () => { fireEvent.press(screen.getByText(GUARDAR)); });
    expect(estadoPerfil.guardarPerfil).toHaveBeenCalledTimes(1);
  });

  test('si la conexión cae entre el render y el toque, no llama a la API y avisa', async () => {
    editar();
    simularConectividad(false);

    await act(async () => { fireEvent.press(screen.getByText(GUARDAR)); });

    expect(estadoPerfil.guardarPerfil).not.toHaveBeenCalled();
    expect(screen.getByText(AVISO)).toBeTruthy();
    // La edición sigue abierta con los datos ingresados
    expect(screen.getByDisplayValue('Ana Pérez')).toBeTruthy();
  });

  test('sin conexión se puede seguir editando y cancelar la edición', () => {
    jest.mocked(useConexion).mockReturnValue({ hayConexion: false });
    editar();

    fireEvent.changeText(screen.getByDisplayValue('Ana Pérez'), 'Ana María');
    expect(screen.getByDisplayValue('Ana María')).toBeTruthy();
    expect(screen.getByText('Cancelar')).not.toBeDisabled();
    expect(screen.getByText('Cambiar foto')).not.toBeDisabled();

    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.getByText('Editar perfil')).toBeTruthy();
  });
});

describe('ProfileScreen — acciones que siguen disponibles sin conexión', () => {
  beforeEach(() => {
    jest.mocked(useConexion).mockReturnValue({ hayConexion: false });
    simularConectividad(false);
  });

  test('lectura, navegación y edición local no se bloquean', () => {
    render(pantalla());

    expect(screen.getByText('Editar perfil')).not.toBeDisabled();
    expect(screen.queryByText(AVISO)).toBeNull();

    fireEvent.press(screen.getByText('Mis publicaciones'));
    expect(navegacion.navigate).toHaveBeenCalledWith('MisPublicaciones');

    fireEvent.press(screen.getByText('Historial de devoluciones'));
    expect(navegacion.navigate).toHaveBeenCalledWith('Historial');

    fireEvent.press(screen.getByText('Configuración'));
    expect(navegacion.navigate).toHaveBeenCalledWith('Configuracion');
  });

  test('cerrar sesión no se bloquea: cierra localmente aunque no haya red', () => {
    render(pantalla());

    expect(screen.getByText('Cerrar sesión')).not.toBeDisabled();
    fireEvent.press(screen.getByText('Cerrar sesión'));

    expect(cerrarSesion).toHaveBeenCalledTimes(1);
  });

  test('reintentar la carga del perfil sigue habilitado', () => {
    estadoPerfil.perfil = null;
    estadoPerfil.error = 'No se pudo cargar el perfil.';
    render(pantalla());

    expect(screen.getByText('Reintentar')).not.toBeDisabled();
    fireEvent.press(screen.getByText('Reintentar'));
    expect(estadoPerfil.recargarPerfil).toHaveBeenCalled();
  });
});

describe('ProfileScreen — barrio', () => {
  test('se elige de la lista y se guarda su nombre', async () => {
    editar();

    elegirBarrio('Caballito');
    await act(async () => { fireEvent.press(screen.getByText(GUARDAR)); });

    expect(estadoPerfil.guardarPerfil).toHaveBeenCalledWith(expect.objectContaining({ zone: 'Caballito' }));
  });

  test('se puede dejar sin barrio', async () => {
    editar();

    elegirBarrio('Sin barrio');
    await act(async () => { fireEvent.press(screen.getByText(GUARDAR)); });

    expect(estadoPerfil.guardarPerfil).toHaveBeenCalledWith(expect.objectContaining({ zone: '' }));
  });

  test('un barrio viejo fuera del catálogo se muestra y se guarda tal cual si no se cambia', async () => {
    estadoPerfil.perfil = { ...perfil, zone: 'Barrio Viejo' };
    editar();

    expect(screen.getAllByText('Barrio Viejo').length).toBeGreaterThan(0);
    await act(async () => { fireEvent.press(screen.getByText(GUARDAR)); });

    expect(estadoPerfil.guardarPerfil).toHaveBeenCalledWith(expect.objectContaining({ zone: 'Barrio Viejo' }));
  });

  test('un barrio viejo se puede reemplazar por uno del catálogo', async () => {
    estadoPerfil.perfil = { ...perfil, zone: 'Barrio Viejo' };
    editar();

    elegirBarrio('Almagro');
    await act(async () => { fireEvent.press(screen.getByText(GUARDAR)); });

    expect(estadoPerfil.guardarPerfil).toHaveBeenCalledWith(expect.objectContaining({ zone: 'Almagro' }));
  });
});
