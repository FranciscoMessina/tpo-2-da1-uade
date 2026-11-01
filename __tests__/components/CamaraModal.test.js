import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import CamaraModal from '../../components/CamaraModal';

// El módulo nativo de la cámara se reemplaza: la vista previa es un componente vacío y el
// disparo devuelve la URI que fije cada prueba.
const mockSacarFoto = jest.fn();

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    useCameraPermissions: jest.fn(),
    CameraView: React.forwardRef(function CameraView({ onCameraReady, ...props }, ref) {
      React.useImperativeHandle(ref, () => ({ takePictureAsync: mockSacarFoto }));
      React.useEffect(() => {
        onCameraReady?.();
      }, [onCameraReady]);
      return <View testID="vista-camara" {...props} />;
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const pedirPermiso = jest.fn();

function permiso(estado) {
  jest.mocked(useCameraPermissions).mockReturnValue([estado, pedirPermiso]);
}

function abrir(props = {}) {
  const onCerrar = jest.fn();
  const onFoto = jest.fn();
  render(<CamaraModal visible onCerrar={onCerrar} onFoto={onFoto} {...props} />);
  return { onCerrar, onFoto };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSacarFoto.mockResolvedValue({ uri: 'file:///cache/foto.jpg' });
  pedirPermiso.mockResolvedValue({ granted: true });
});

describe('CamaraModal', () => {
  test('cerrado no monta la cámara ni pide el permiso', () => {
    permiso({ granted: true });
    abrir({ visible: false });

    expect(useCameraPermissions).not.toHaveBeenCalled();
    expect(screen.queryByTestId('vista-camara')).toBeNull();
  });

  test('con permiso muestra la cámara trasera sin flash', () => {
    permiso({ granted: true });
    abrir();

    const vista = screen.getByTestId('vista-camara');
    expect(vista.props.facing).toBe('back');
    expect(vista.props.flash).toBe('off');
  });

  test('sacar una foto la muestra para confirmarla y «Usar esta foto» la entrega', async () => {
    permiso({ granted: true });
    const { onFoto } = abrir();

    await act(async () => fireEvent.press(screen.getByLabelText('Sacar foto')));

    expect(mockSacarFoto).toHaveBeenCalledWith({ quality: 0.7 });
    expect(onFoto).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Foto sacada')).toBeTruthy();

    fireEvent.press(screen.getByText('Usar esta foto'));
    expect(onFoto).toHaveBeenCalledWith('file:///cache/foto.jpg');
  });

  test('«Sacar otra» descarta la foto y vuelve a la cámara', async () => {
    permiso({ granted: true });
    const { onFoto } = abrir();

    await act(async () => fireEvent.press(screen.getByLabelText('Sacar foto')));
    fireEvent.press(screen.getByText('Sacar otra'));

    expect(screen.getByTestId('vista-camara')).toBeTruthy();
    expect(onFoto).not.toHaveBeenCalled();
  });

  test('si falla el disparo avisa y deja volver a intentar', async () => {
    permiso({ granted: true });
    mockSacarFoto.mockRejectedValueOnce(new Error('sin memoria'));
    abrir();

    await act(async () => fireEvent.press(screen.getByLabelText('Sacar foto')));

    expect(screen.getByText('No pudimos sacar la foto. Probá de nuevo.')).toBeTruthy();
    expect(screen.getByLabelText('Sacar foto')).toBeTruthy();
  });

  test('el flash y el cambio de cámara se reflejan en la vista previa', () => {
    permiso({ granted: true });
    abrir();

    fireEvent.press(screen.getByLabelText('Encender el flash'));
    expect(screen.getByTestId('vista-camara').props.flash).toBe('on');

    fireEvent.press(screen.getByLabelText('Cambiar de cámara'));
    expect(screen.getByTestId('vista-camara').props.facing).toBe('front');
    // La frontal no ofrece flash y queda apagado
    expect(screen.getByTestId('vista-camara').props.flash).toBe('off');
    expect(screen.queryByLabelText('Encender el flash')).toBeNull();
  });

  test('cerrar la cámara avisa a quien la abrió', () => {
    permiso({ granted: true });
    const { onCerrar } = abrir();

    fireEvent.press(screen.getByLabelText('Cerrar la cámara'));
    expect(onCerrar).toHaveBeenCalled();
  });

  test('sin permiso lo pide con un botón y no muestra la cámara', async () => {
    permiso({ granted: false, canAskAgain: true });
    abrir();

    expect(screen.queryByTestId('vista-camara')).toBeNull();

    await act(async () => fireEvent.press(screen.getByText('Permitir la cámara')));
    expect(pedirPermiso).toHaveBeenCalledTimes(1);
  });

  test('con el permiso bloqueado ofrece abrir los ajustes', () => {
    permiso({ granted: false, canAskAgain: false });
    const abrirAjustes = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    abrir();

    expect(screen.queryByText('Permitir la cámara')).toBeNull();
    fireEvent.press(screen.getByText('Abrir ajustes'));
    expect(abrirAjustes).toHaveBeenCalled();
  });
});
