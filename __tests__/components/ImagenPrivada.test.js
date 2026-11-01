import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ImagenPrivada from '../../components/ImagenPrivada';
import { api } from '../../services/api';

const RUTA = '/uploads/pruebas/b7bbc0af-a114-4d40-b24b-ab7705ea6258.jpg';
const ETIQUETA = 'Foto de prueba del reclamo';
const BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const BASE64 = '/9j/4AAQ';

const imagen = (data = BYTES.buffer, tipo = 'image/jpeg') => ({
  data,
  headers: { 'content-type': tipo },
});

async function montar(ruta = RUTA) {
  render(<ImagenPrivada ruta={ruta} accessibilityLabel={ETIQUETA} />);
  // deja resolver la petición simulada
  await act(async () => {});
}

beforeEach(() => {
  api.defaults.headers.common.Authorization = 'Bearer token-de-prueba';
});

afterEach(() => {
  delete api.defaults.headers.common.Authorization;
  jest.restoreAllMocks();
});

describe('ImagenPrivada — pruebas privadas', () => {
  test('descarga la imagen con el cliente de la API y la muestra desde memoria', async () => {
    const get = jest.spyOn(api, 'get').mockResolvedValue(imagen());

    await montar();

    expect(get).toHaveBeenCalledWith(RUTA, { responseType: 'arraybuffer' });
    const fuente = screen.getByLabelText(ETIQUETA).props.source;
    expect(fuente).toEqual({ uri: `data:image/jpeg;base64,${BASE64}` });
  });

  test('acepta la ruta como URL absoluta de la propia API', async () => {
    const get = jest.spyOn(api, 'get').mockResolvedValue(imagen());

    await montar(`${api.defaults.baseURL}${RUTA}`);

    expect(get).toHaveBeenCalledWith(RUTA, { responseType: 'arraybuffer' });
  });

  test('si la petición falla avisa y reintentar vuelve a pedirla', async () => {
    const get = jest.spyOn(api, 'get')
      .mockRejectedValueOnce(new Error('403'))
      .mockResolvedValueOnce(imagen());

    await montar();
    expect(screen.getByText('No pudimos cargar la imagen.')).toBeTruthy();
    expect(screen.queryByLabelText(ETIQUETA)).toBeNull();

    fireEvent.press(screen.getByText('Reintentar'));
    await act(async () => {});

    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('No pudimos cargar la imagen.')).toBeNull();
    expect(screen.getByLabelText(ETIQUETA)).toBeTruthy();
  });

  test('una respuesta que no es una imagen cuenta como fallo', async () => {
    jest.spyOn(api, 'get').mockResolvedValue(imagen(new TextEncoder().encode('{}').buffer, 'application/json'));

    await montar();

    expect(screen.getByText('No pudimos cargar la imagen.')).toBeTruthy();
  });

  test('sin sesión no pide nada y pide iniciar sesión', async () => {
    delete api.defaults.headers.common.Authorization;
    const get = jest.spyOn(api, 'get');

    await montar();

    expect(get).not.toHaveBeenCalled();
    expect(screen.getByText('Iniciá sesión para ver esta imagen.')).toBeTruthy();
  });
});

describe('ImagenPrivada — imágenes públicas', () => {
  test('se cargan directo, sin pasar por la API ni enviar credenciales', async () => {
    const get = jest.spyOn(api, 'get');

    await montar('/uploads/0ad99ba9-f177-47b1-ab51-837a35f05cd2.jpg');

    expect(get).not.toHaveBeenCalled();
    const fuente = screen.getByLabelText(ETIQUETA).props.source;
    expect(fuente.uri).toMatch(/\/uploads\/0ad99ba9-f177-47b1-ab51-837a35f05cd2\.jpg$/);
    expect(fuente.headers).toBeUndefined();
  });

  test('rutas ajenas a /uploads no muestran nada', async () => {
    await montar('https://otro.sitio/foto.jpg');

    expect(screen.queryByLabelText(ETIQUETA)).toBeNull();
  });
});
