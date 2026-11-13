import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import EscanerQrModal from '../../components/EscanerQrModal';
import { controlarAppState, restaurarAppState } from '../hooks/entorno';

jest.mock('expo-camera', () => ({
  useCameraPermissions: jest.fn(),
  CameraView: (props) => {
    const { View } = require('react-native');
    return <View testID="lector-qr" {...props} />;
  },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
const pedirPermiso = jest.fn();
const consultarPermiso = jest.fn();
let appState;
const codigo = 'hallado:devolucion:11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
  appState = controlarAppState();
  pedirPermiso.mockResolvedValue({ granted: true });
  consultarPermiso.mockResolvedValue({ granted: true });
  useCameraPermissions.mockReturnValue([{ granted: true }, pedirPermiso, consultarPermiso]);
});
afterEach(() => { restaurarAppState(); jest.restoreAllMocks(); });

function abrir(props = {}) {
  const onLeer = jest.fn(), onCerrar = jest.fn();
  render(<EscanerQrModal visible onLeer={onLeer} onCerrar={onCerrar} {...props} />);
  return { onLeer, onCerrar };
}

test('cerrado no abre la cámara', () => {
  abrir({ visible: false });
  expect(useCameraPermissions).not.toHaveBeenCalled();
});
test('lee solo QR y entrega una única lectura aunque la cámara repita el evento', () => {
  const { onLeer } = abrir();
  const camara = screen.getByTestId('lector-qr');
  expect(camara.props.barcodeScannerSettings).toEqual({ barcodeTypes: ['qr'] });
  fireEvent(camara, 'barcodeScanned', { data: codigo });
  fireEvent(camara, 'barcodeScanned', { data: codigo });
  expect(onLeer).toHaveBeenCalledTimes(1);
  expect(onLeer).toHaveBeenCalledWith(codigo);
});
test('un QR externo muestra error y permite escanear otro', () => {
  const { onLeer } = abrir();
  fireEvent(screen.getByTestId('lector-qr'), 'barcodeScanned', { data: 'https://example.com' });
  expect(onLeer).not.toHaveBeenCalled();
  expect(screen.getByText('Este QR no corresponde a una devolución de Hallado.')).toBeTruthy();
  fireEvent.press(screen.getByText('Volver a escanear'));
  fireEvent(screen.getByTestId('lector-qr'), 'barcodeScanned', { data: codigo });
  expect(onLeer).toHaveBeenCalledWith(codigo);
});
test('permiso denegado explica el uso y permite abrir ajustes sin confirmar nada', async () => {
  useCameraPermissions.mockReturnValue([{ granted: false, canAskAgain: false }, pedirPermiso, consultarPermiso]);
  const ajustes = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  const { onLeer, onCerrar } = abrir();
  expect(screen.queryByTestId('lector-qr')).toBeNull();
  expect(screen.queryByText('Permitir la cámara')).toBeNull();
  await act(async () => fireEvent.press(screen.getByText('Abrir ajustes')));
  expect(ajustes).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('Cancelar'));
  expect(onCerrar).toHaveBeenCalledTimes(1);
  expect(onLeer).not.toHaveBeenCalled();
});
test('solicita el permiso y maneja errores de cámara', async () => {
  useCameraPermissions.mockReturnValue([{ granted: false, canAskAgain: true }, pedirPermiso, consultarPermiso]);
  pedirPermiso.mockRejectedValueOnce(new Error('error'));
  abrir();
  await act(async () => fireEvent.press(screen.getByText('Permitir la cámara')));
  expect(screen.getByText('No pudimos abrir los permisos de cámara. Intentá nuevamente.')).toBeTruthy();
});
test('desmonta la cámara en segundo plano y consulta el permiso al volver', async () => {
  abrir();
  act(() => appState.emitir('background'));
  expect(screen.queryByTestId('lector-qr')).toBeNull();
  await act(async () => appState.emitir('active'));
  expect(consultarPermiso).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('lector-qr')).toBeTruthy();
});
