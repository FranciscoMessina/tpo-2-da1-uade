import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import EscanerDevolucionModal from '../../components/EscanerDevolucionModal';
import { confirmarDevolucionQr } from '../../services/historial';
import { diferida } from '../hooks/entorno';

jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  return {
    CameraView: (props) => <View testID="camara-qr" {...props} />,
    useCameraPermissions: jest.fn(),
    scanFromURLAsync: jest.fn(),
  };
});
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../../services/historial');
jest.mock('../../context/ConexionContext', () => ({ useConexion: () => ({ hayConexion: true }) }));

function abrir(granted) {
  useCameraPermissions.mockReturnValue([{ granted, canAskAgain: false }, jest.fn(), jest.fn()]);
  const onConfirmada = jest.fn();
  render(<EscanerDevolucionModal reclamoId="r1" onCerrar={jest.fn()} onConfirmada={onConfirmada} />);
  return onConfirmada;
}

beforeEach(() => jest.clearAllMocks());

test('varias lecturas del mismo QR esperan confirmación y envían un solo pedido', async () => {
  const onConfirmada = abrir(true);
  const respuesta = diferida();
  confirmarDevolucionQr.mockReturnValueOnce(respuesta.promesa);
  const lectura = screen.getByTestId('camara-qr').props.onBarcodeScanned;

  await act(async () => {
    lectura({ data: '{"reclamoId":"r1","codigo":"valido"}' });
    lectura({ data: '{"reclamoId":"r1","codigo":"valido"}' });
  });
  expect(confirmarDevolucionQr).not.toHaveBeenCalled();

  const botonConfirmar = screen.getByRole('button', { name: 'Confirmar recepción' });
  act(() => {
    fireEvent.press(botonConfirmar);
    fireEvent.press(botonConfirmar);
  });
  expect(confirmarDevolucionQr).toHaveBeenCalledTimes(1);
  expect(confirmarDevolucionQr).toHaveBeenCalledWith('r1', 'valido');
  expect(onConfirmada).not.toHaveBeenCalled();

  await act(async () => respuesta.resolver({}));
  expect(onConfirmada).toHaveBeenCalledTimes(1);
});

test('con la cámara bloqueada permite leer una imagen y rechaza el QR de otro reclamo', async () => {
  abrir(false);
  launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///qr.png' }] });
  scanFromURLAsync.mockResolvedValueOnce([{ data: '{"reclamoId":"r2","codigo":"valido"}' }]);

  expect(screen.queryByTestId('camara-qr')).toBeNull();
  expect(screen.getByText('Abrir ajustes')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Elegir imagen del QR')));

  expect(screen.getByText('El QR corresponde a otro reclamo.')).toBeTruthy();
  expect(screen.queryByText('Confirmar recepción')).toBeNull();
  expect(confirmarDevolucionQr).not.toHaveBeenCalled();
});
