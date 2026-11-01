import { act, fireEvent, render, screen } from '@testing-library/react-native';
import TarjetaPublicacion from '../../components/TarjetaPublicacion';

let mockHayConexion = true;

jest.mock('../../context/ConexionContext', () => ({
  useConexion: () => ({ hayConexion: mockHayConexion, sinInternet: !mockHayConexion }),
}));

const publicacion = (cambios = {}) => ({
  id: 7,
  tipo: 'perdido',
  estado: 'activa',
  titulo: 'Mochila azul',
  categoria: 'Mochila',
  barrio: 'Palermo',
  fecha: '2026-10-30',
  fotos: ['https://fotos.test/a.jpg'],
  ...cambios,
});

const tarjeta = (pub) => <TarjetaPublicacion publicacion={pub} onPress={jest.fn()} />;
const foto = () => screen.queryByLabelText('Foto de Mochila');
const placeholderRoto = () => screen.queryByLabelText('No se pudo cargar la foto');

beforeEach(() => {
  mockHayConexion = true;
});

describe('miniatura de TarjetaPublicacion', () => {
  test('con foto muestra la imagen', () => {
    render(tarjeta(publicacion()));

    expect(foto().props.source).toEqual({ uri: 'https://fotos.test/a.jpg' });
    expect(placeholderRoto()).toBeNull();
  });

  test('sin foto muestra el placeholder de la categoría', () => {
    render(tarjeta(publicacion({ fotos: [] })));

    expect(foto()).toBeNull();
    expect(screen.getByLabelText('Sin foto de Mochila')).toBeTruthy();
  });

  test('si la foto falla muestra el placeholder de error', () => {
    render(tarjeta(publicacion()));

    fireEvent(foto(), 'error');

    expect(foto()).toBeNull();
    expect(placeholderRoto()).toBeTruthy();
  });

  test('tras un error, una publicación con otra foto vuelve a intentar con la nueva', () => {
    const vista = render(tarjeta(publicacion()));
    fireEvent(foto(), 'error');
    expect(placeholderRoto()).toBeTruthy();

    vista.rerender(tarjeta(publicacion({ fotos: ['https://fotos.test/b.jpg'] })));

    expect(foto().props.source).toEqual({ uri: 'https://fotos.test/b.jpg' });
    expect(placeholderRoto()).toBeNull();
  });

  test('el error tardío de la foto anterior no oculta la nueva', () => {
    const vista = render(tarjeta(publicacion()));
    // Callback que la imagen de A ya tenía registrado cuando cambia la foto
    const errorViejo = foto().props.onError;

    vista.rerender(tarjeta(publicacion({ fotos: ['https://fotos.test/b.jpg'] })));
    act(() => errorViejo());

    expect(foto().props.source).toEqual({ uri: 'https://fotos.test/b.jpg' });
    expect(placeholderRoto()).toBeNull();
  });

  test('si la foto nueva también falla, queda el placeholder', () => {
    const vista = render(tarjeta(publicacion()));
    fireEvent(foto(), 'error');
    vista.rerender(tarjeta(publicacion({ fotos: ['https://fotos.test/b.jpg'] })));

    fireEvent(foto(), 'error');

    expect(placeholderRoto()).toBeTruthy();
  });

  test('una publicación que pierde la foto pasa al placeholder sin foto', () => {
    const vista = render(tarjeta(publicacion()));
    fireEvent(foto(), 'error');

    vista.rerender(tarjeta(publicacion({ fotos: [] })));

    expect(placeholderRoto()).toBeNull();
    expect(screen.getByLabelText('Sin foto de Mochila')).toBeTruthy();
  });

  test('al volver la conexión reintenta una vez la misma foto que había fallado', () => {
    mockHayConexion = false;
    const vista = render(tarjeta(publicacion()));
    fireEvent(foto(), 'error');
    expect(placeholderRoto()).toBeTruthy();

    mockHayConexion = true;
    vista.rerender(tarjeta(publicacion()));
    expect(foto().props.source).toEqual({ uri: 'https://fotos.test/a.jpg' });

    // Si vuelve a fallar no reintenta hasta que haya otra transición real
    fireEvent(foto(), 'error');
    vista.rerender(tarjeta(publicacion()));
    expect(placeholderRoto()).toBeTruthy();
    expect(foto()).toBeNull();
  });

  test('un fallo con conexión estable no se reintenta solo', () => {
    const vista = render(tarjeta(publicacion()));
    fireEvent(foto(), 'error');

    vista.rerender(tarjeta(publicacion()));
    vista.rerender(tarjeta(publicacion({ titulo: 'Mochila azul grande' })));

    expect(placeholderRoto()).toBeTruthy();
  });

  test('un nuevo corte y reconexión permite otro reintento', () => {
    const vista = render(tarjeta(publicacion()));
    fireEvent(foto(), 'error');

    mockHayConexion = false;
    vista.rerender(tarjeta(publicacion()));
    expect(placeholderRoto()).toBeTruthy();

    mockHayConexion = true;
    vista.rerender(tarjeta(publicacion()));
    expect(foto()).toBeTruthy();
  });
});
