import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import PublicationDetailScreen from '../../screens/PublicationDetailScreen';
import usePublicacion from '../../hooks/usePublicacion';
import { useConexion } from '../../context/ConexionContext';
import { __navegacion as navegacion } from '@react-navigation/native';
import { elegirBarrio } from '../components/ayudas';

// Hooks y contexto se reemplazan: la prueba no toca la red ni el servidor.
jest.mock('../../hooks/usePublicacion');
jest.mock('../../context/ConexionContext');
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../../components/ReputationCard', () => () => null);

const publicacion = (extra = {}) => ({
  id: 'p1',
  titulo: 'Llaves',
  descripcion: 'Un llavero',
  categoria: 'Llaves',
  barrio: 'Palermo',
  tipo: 'perdido',
  estado: 'abierta',
  fotos: [],
  fecha: '2026-10-30',
  franja: 'tarde',
  esPropia: false,
  publicador: { id: 'u2', name: 'Ana', avatarUrl: null, reputation: null },
  ...extra,
});

let reclamar;

function montar(extra, hook = {}) {
  reclamar = jest.fn().mockResolvedValue({ id: 'c1' });
  jest.mocked(usePublicacion).mockReturnValue({
    publicacion: publicacion(extra),
    loading: false,
    error: '',
    esPropia: false,
    siguiendo: false,
    guardandoSeguimiento: false,
    errorSeguimiento: '',
    recargarSeguimiento: jest.fn(),
    recargar: jest.fn(),
    toggleSeguir: jest.fn(),
    reclamar,
    ...hook,
  });
  jest.mocked(useConexion).mockReturnValue({ hayConexion: true });
  render(
    <PublicationDetailScreen route={{ params: { publicacionId: 'p1' } }} navigation={navegacion} />
  );
}

const enviar = async (titulo) => {
  await act(async () => { fireEvent.press(screen.getByText(titulo)); });
};

afterEach(() => jest.restoreAllMocks());

describe('PublicationDetailScreen: aviso «Lo encontré»', () => {
  beforeEach(() => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///foto.jpg' }],
    });
  });

  test('elige el barrio en el desplegable dentro del modal y no inventa un mensaje', async () => {
    montar();
    fireEvent.press(screen.getByText('Lo encontré'));

    expect(screen.getByText('Confirmar y enviar aviso')).toBeDisabled();

    elegirBarrio('Villa Crespo', 'Barrio donde lo encontraste');
    await act(async () => { fireEvent.press(screen.getByText('Adjuntar foto del objeto encontrado')); });
    await enviar('Confirmar y enviar aviso');

    expect(reclamar).toHaveBeenCalledWith({
      barrio: 'Villa Crespo',
      fotoUri: 'file:///foto.jpg',
      mensaje: '',
    });
  });

  test('envía el mensaje solo si la persona lo escribió', async () => {
    montar();
    fireEvent.press(screen.getByText('Lo encontré'));

    elegirBarrio('Almagro', 'Barrio donde lo encontraste');
    await act(async () => { fireEvent.press(screen.getByText('Adjuntar foto del objeto encontrado')); });
    fireEvent.changeText(
      screen.getByLabelText('Mensaje o información adicional (opcional)'),
      '  Lo tengo en el kiosco  '
    );
    await enviar('Confirmar y enviar aviso');

    expect(reclamar).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'Lo tengo en el kiosco' }));
  });
});

describe('PublicationDetailScreen: reclamo «Es mío»', () => {
  test('con pregunta de verificación, el mensaje es opcional y no se inventa uno', async () => {
    montar({ tipo: 'encontrado', preguntaVerificacion: '¿De qué color es el llavero?' });
    fireEvent.press(screen.getByText('Es mío'));

    expect(screen.getByText('Confirmar y enviar reclamo')).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText('Tu respuesta (obligatoria)'), 'Azul');
    await enviar('Confirmar y enviar reclamo');

    expect(reclamar).toHaveBeenCalledWith({ respuestaVerificacion: 'Azul', mensaje: '', fotoUri: null });
  });

  test('un hallazgo viejo sin pregunta sigue pidiendo detalles distintivos', async () => {
    montar({ tipo: 'encontrado', preguntaVerificacion: null });
    fireEvent.press(screen.getByText('Es mío'));
    const detalles = screen.getByLabelText('Detalles distintivos (obligatorio)');

    fireEvent.changeText(detalles, 'azul');
    expect(screen.getByText('Confirmar y enviar reclamo')).toBeDisabled();

    fireEvent.changeText(detalles, 'azul con un moño');
    expect(screen.getByText('Confirmar y enviar reclamo')).not.toBeDisabled();
    await enviar('Confirmar y enviar reclamo');

    expect(reclamar).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'azul con un moño' }));
  });
});

describe('PublicationDetailScreen: fecha, hora y dirección', () => {
  test('con hora, la muestra junto a la fecha del suceso y conserva la franja', () => {
    montar({ hora: '18:30' });

    expect(screen.getByText('30/10/2026 · 18:30 h')).toBeTruthy();
    expect(screen.getByText('Tarde (12 a 19 h)')).toBeTruthy();
  });

  test('una publicación vieja sin hora muestra solo la fecha y la franja', () => {
    montar({ hora: null });

    expect(screen.getByText('30/10/2026')).toBeTruthy();
    expect(screen.getByText('Tarde (12 a 19 h)')).toBeTruthy();
    expect(screen.queryByText(/ h$/)).toBeNull();
  });

  test('sin acceso, la dirección se muestra cuando el reclamo sea aceptado', () => {
    montar({ direccionExacta: null });

    expect(screen.getByText('Se muestra cuando el reclamo sea aceptado.')).toBeTruthy();
  });

  test('con el reclamo aceptado se ve la dirección', () => {
    montar({ direccionExacta: 'Av. Santa Fe 3000', miReclamo: { estado: 'aceptado', intentos: 1 } });
    expect(screen.getByText('Av. Santa Fe 3000')).toBeTruthy();
    expect(screen.queryByText('Se muestra cuando el reclamo sea aceptado.')).toBeNull();
  });

  test('con el reclamo aceptado y sin dirección dice «No informada»', () => {
    montar({ direccionExacta: null, miReclamo: { estado: 'aceptado', intentos: 1 } });

    expect(screen.getByText('No informada')).toBeTruthy();
    expect(screen.queryByText('Se muestra cuando el reclamo sea aceptado.')).toBeNull();
  });

  test('en una publicación propia sin dirección dice «No informada»', () => {
    montar({ direccionExacta: null }, { esPropia: true });

    expect(screen.getByText('No informada')).toBeTruthy();
    expect(screen.queryByText('Se muestra cuando el reclamo sea aceptado.')).toBeNull();
  });
});
