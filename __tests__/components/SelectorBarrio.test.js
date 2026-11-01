import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SelectorBarrio from '../../components/SelectorBarrio';
import { ModalPantalla } from '../../components/ui';
import { restablecerCatalogo } from '../../services/catalogos';
import { simularConectividad } from '../hooks/entorno';
import { abrirSelectorBarrio, elegirBarrio } from './ayudas';

beforeEach(() => {
  restablecerCatalogo();
  simularConectividad(false);
});

const buscar = (texto) => fireEvent.changeText(screen.getByLabelText('Buscar barrio'), texto);

describe('SelectorBarrio', () => {
  test('muestra la etiqueta y el placeholder, y no abre la lista hasta tocarlo', () => {
    render(<SelectorBarrio etiqueta="Barrio" placeholder="Elegir barrio" valor="" onChange={jest.fn()} />);

    expect(screen.getByText('Barrio')).toBeTruthy();
    expect(screen.getByText('Elegir barrio')).toBeTruthy();
    expect(screen.queryByLabelText('Buscar barrio')).toBeNull();
  });

  test('muestra el valor, un error y el estado accesible', () => {
    render(<SelectorBarrio valor="Palermo" error="Elegí un barrio" onChange={jest.fn()} />);

    expect(screen.getByText('Palermo')).toBeTruthy();
    expect(screen.getByText('Elegí un barrio')).toBeTruthy();
    expect(screen.getByLabelText('Barrio')).toHaveAccessibilityValue({ text: 'Palermo' });
  });

  test('elegir un barrio de la lista llama a onChange con el nombre y cierra', () => {
    const onChange = jest.fn();
    render(<SelectorBarrio valor="" onChange={onChange} />);

    elegirBarrio('Palermo');

    expect(onChange).toHaveBeenCalledWith('Palermo');
    expect(screen.queryByLabelText('Buscar barrio')).toBeNull();
  });

  test('el buscador ignora tildes y mayúsculas, y avisa si nada coincide', () => {
    render(<SelectorBarrio valor="" onChange={jest.fn()} />);
    abrirSelectorBarrio();

    buscar('NUNEZ');
    expect(screen.getByText('Núñez')).toBeTruthy();
    expect(screen.queryByText('Palermo')).toBeNull();

    buscar('villa ortuzar');
    expect(screen.getByText('Villa Ortúzar')).toBeTruthy();

    buscar('ñu');
    expect(screen.getByText('Núñez')).toBeTruthy();

    buscar('zzz');
    expect(screen.getByText(/No hay barrios que coincidan/)).toBeTruthy();
  });

  test('sin permitirVaciar no ofrece «Sin barrio»; con permitirVaciar lo ofrece y devuelve vacío', () => {
    const onChange = jest.fn();
    const { rerender } = render(<SelectorBarrio valor="Palermo" onChange={onChange} />);
    abrirSelectorBarrio();
    expect(screen.queryByLabelText('Sin barrio')).toBeNull();

    rerender(<SelectorBarrio valor="Palermo" onChange={onChange} permitirVaciar />);
    fireEvent.press(screen.getByLabelText('Sin barrio'));

    expect(onChange).toHaveBeenCalledWith('');
  });

  test('marca el barrio actual como seleccionado', () => {
    render(<SelectorBarrio valor="Recoleta" onChange={jest.fn()} />);
    abrirSelectorBarrio();
    buscar('Recoleta');

    expect(screen.getByLabelText('Recoleta', { selected: true })).toBeTruthy();
  });

  test('un barrio viejo que no está en el catálogo se muestra tal cual y se puede reemplazar', () => {
    const onChange = jest.fn();
    render(<SelectorBarrio valor="Barrio Viejo" onChange={onChange} permitirVaciar />);

    expect(screen.getByText('Barrio Viejo')).toBeTruthy();
    elegirBarrio('Caballito');

    expect(onChange).toHaveBeenCalledWith('Caballito');
  });

  test('deshabilitado no abre la lista', () => {
    render(<SelectorBarrio valor="" onChange={jest.fn()} disabled />);
    fireEvent.press(screen.getByLabelText('Barrio'));

    expect(screen.queryByLabelText('Buscar barrio')).toBeNull();
  });

  test('usa la etiqueta accesible indicada', () => {
    render(<SelectorBarrio etiqueta="Barrio" accessibilityLabel="Barrio del reclamo" valor="" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Barrio del reclamo')).toBeTruthy();
  });

  test('funciona abierto desde dentro de un ModalPantalla', () => {
    function Dentro() {
      const [barrio, setBarrio] = useState('');
      return (
        <ModalPantalla visible titulo="Filtros" onCerrar={jest.fn()}>
          <SelectorBarrio valor={barrio} onChange={setBarrio} />
        </ModalPantalla>
      );
    }
    render(<Dentro />);

    elegirBarrio('Belgrano');

    expect(screen.getByText('Belgrano')).toBeTruthy();
    expect(screen.queryByLabelText('Buscar barrio')).toBeNull();
  });
});
