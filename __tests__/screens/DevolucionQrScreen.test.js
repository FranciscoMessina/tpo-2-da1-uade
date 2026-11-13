import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import DevolucionQrScreen from '../../screens/DevolucionQrScreen';
import { generarQrDevolucion, obtenerDevolucion } from '../../services/devoluciones';
import { confirmarDevolucionQr } from '../../services/historial';
import { useConexion } from '../../context/ConexionContext';

jest.mock('../../hooks/useActualizacionVisible', () => () => {});
jest.mock('../../services/devoluciones', () => ({
  obtenerDevolucion: jest.fn(), generarQrDevolucion: jest.fn(),
}));
jest.mock('../../services/api', () => ({ mensajeErrorApi: (e) => e.message, motivoSinConexion: () => null }));
jest.mock('../../context/ConexionContext', () => ({ useConexion: jest.fn() }));
jest.mock('../../services/historial', () => ({ confirmarDevolucionQr: jest.fn() }));
jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  return {
    CameraView: (props) => <View testID="camara-qr" {...props} />,
    useCameraPermissions: () => [{ granted: true }, jest.fn(), jest.fn()],
    scanFromURLAsync: jest.fn(),
  };
});
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
const comprobarConexion = jest.fn();
const navegar = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  comprobarConexion.mockResolvedValue(true);
  useConexion.mockReturnValue({ hayConexion: true, comprobarConexion });
  obtenerDevolucion.mockResolvedValue({ titulo: 'Llaves azules', rol: 'recupera', estado: 'en_reclamo' });
  confirmarDevolucionQr.mockResolvedValue({ estado: 'resuelta' });
});
async function abrir() {
  render(<DevolucionQrScreen route={{ params: { reclamoId: 'reclamo-1' } }} navigation={{ navigate: navegar }} />);
  await screen.findByText('Llaves azules');
}
async function leer() {
  fireEvent.press(screen.getByText('Escanear QR'));
  await act(async () => screen.getByTestId('camara-qr').props.onBarcodeScanned({
    data: JSON.stringify({ reclamoId: 'reclamo-1', codigo: 'hallado:devolucion:prueba' }),
  }));
}
test('escaneo requiere confirmación explícita y recién después muestra el historial', async () => {
  await abrir();
  await leer();
  expect(confirmarDevolucionQr).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(screen.getByText('Confirmar recepción')));
  expect(confirmarDevolucionQr).toHaveBeenCalledWith('reclamo-1', 'hallado:devolucion:prueba');
  fireEvent.press(screen.getByText('Ver historial y valorar'));
  expect(navegar).toHaveBeenCalledWith('Historial');
});
test('si el backend falla conserva la lectura para reintentar y no muestra éxito', async () => {
  confirmarDevolucionQr.mockRejectedValueOnce(new Error('No se pudo conectar'));
  await abrir(); await leer();
  await act(async () => fireEvent.press(screen.getByText('Confirmar recepción')));
  expect(screen.getByText('No se pudo conectar')).toBeTruthy();
  expect(screen.queryByText('Ver historial y valorar')).toBeNull();
  await act(async () => fireEvent.press(screen.getByText('Confirmar recepción')));
  expect(screen.getByText('Ver historial y valorar')).toBeTruthy();
});
test('comprueba conectividad antes de generar el QR', async () => {
  obtenerDevolucion.mockResolvedValue({ titulo: 'Llaves azules', rol: 'devuelve', estado: 'en_reclamo' });
  await abrir();
  comprobarConexion.mockResolvedValue(false);
  await act(async () => fireEvent.press(screen.getByText('Mostrar QR de entrega')));
  expect(generarQrDevolucion).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('QR de la devolución')).toBeNull();
});
test('quien devuelve muestra QR y no puede escanear ni cerrar desde esta pantalla', async () => {
  obtenerDevolucion.mockResolvedValue({ titulo: 'Llaves azules', rol: 'devuelve', estado: 'en_reclamo' });
  generarQrDevolucion.mockResolvedValue({ imagen: 'data:image/png;base64,abc', expiresAt: '2026-12-01T23:00:00Z' });
  await abrir();
  fireEvent.press(screen.getByText('Mostrar QR de entrega'));
  await waitFor(() => expect(screen.getByLabelText('QR de la devolución')).toBeTruthy());
  expect(screen.queryByText('Escanear QR')).toBeNull();
  expect(screen.queryByText('Confirmar recepción')).toBeNull();
});
test('descartar una lectura no confirma la devolución', async () => {
  await abrir(); await leer();
  fireEvent.press(screen.getByText('Escanear otro QR'));
  expect(screen.getByTestId('camara-qr')).toBeTruthy();
  expect(confirmarDevolucionQr).not.toHaveBeenCalled();
});
