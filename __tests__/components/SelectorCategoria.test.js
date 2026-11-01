import { fireEvent, render, screen } from '@testing-library/react-native';
import SelectorCategoria from '../../components/SelectorCategoria';
import { CATEGORIAS } from '../../data/busqueda';
import { restablecerCatalogo } from '../../services/catalogos';
import { simularConectividad } from '../hooks/entorno';
import { elegirCategoria } from './ayudas';

beforeEach(() => {
  restablecerCatalogo();
  simularConectividad(false);
});

describe('SelectorCategoria', () => {
  test('muestra la etiqueta y el placeholder, y no abre la lista hasta tocarlo', () => {
    render(<SelectorCategoria valor="" onChange={jest.fn()} />);

    expect(screen.getByText('Categoría')).toBeTruthy();
    expect(screen.getByText('Elegir categoría')).toBeTruthy();
    expect(screen.queryByLabelText('Llaves')).toBeNull();
  });

  test('muestra el valor, un error y el estado accesible', () => {
    render(<SelectorCategoria valor="Ropa" error="Elegí una categoría" onChange={jest.fn()} />);

    expect(screen.getByText('Ropa')).toBeTruthy();
    expect(screen.getByText('Elegí una categoría')).toBeTruthy();
    expect(screen.getByLabelText('Categoría')).toHaveAccessibilityValue({ text: 'Ropa' });
  });

  test('al abrirlo lista todas las categorías del catálogo', () => {
    render(<SelectorCategoria valor="" onChange={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Categoría'));

    for (const nombre of CATEGORIAS) {
      expect(screen.getByLabelText(nombre)).toBeTruthy();
    }
  });

  test('elegir una categoría llama a onChange con el nombre y cierra la lista', () => {
    const onChange = jest.fn();
    render(<SelectorCategoria valor="" onChange={onChange} />);

    elegirCategoria('Llaves');

    expect(onChange).toHaveBeenCalledWith('Llaves');
    expect(screen.queryByLabelText('Mascotas')).toBeNull();
  });

  test('marca la categoría actual como seleccionada', () => {
    render(<SelectorCategoria valor="Mascotas" onChange={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Categoría'));

    expect(screen.getByLabelText('Mascotas', { selected: true })).toBeTruthy();
    expect(screen.getByLabelText('Ropa', { selected: false })).toBeTruthy();
  });

  test('cerrar sin elegir no llama a onChange', () => {
    const onChange = jest.fn();
    render(<SelectorCategoria valor="" onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('Categoría'));
    fireEvent.press(screen.getByLabelText('Cerrar'));

    expect(onChange).not.toHaveBeenCalled();
  });

  test('deshabilitado no abre la lista', () => {
    render(<SelectorCategoria valor="" onChange={jest.fn()} disabled />);

    fireEvent.press(screen.getByLabelText('Categoría'));

    expect(screen.queryByLabelText('Llaves')).toBeNull();
  });
});
