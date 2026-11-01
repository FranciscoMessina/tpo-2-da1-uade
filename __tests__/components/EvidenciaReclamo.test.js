import { render, screen } from '@testing-library/react-native';
import EvidenciaReclamo from '../../components/EvidenciaReclamo';

const reclamo = (extra = {}) => ({ id: 'c1', mensaje: '', ...extra });

describe('EvidenciaReclamo: mensaje opcional', () => {
  test('un reclamo sin mensaje ni evidencia no dibuja filas vacías', () => {
    const { toJSON } = render(<EvidenciaReclamo reclamo={reclamo()} />);

    expect(screen.queryByText(/Respuesta|Barrio|Foto/)).toBeNull();
    // Solo queda el contenedor vacío
    expect(toJSON().children ?? []).toHaveLength(0);
  });

  test('un mensaje en blanco tampoco muestra el panel', () => {
    const { toJSON } = render(
      <EvidenciaReclamo reclamo={reclamo({ mensaje: '   ', respuestaVerificacion: 'Azul' })} />
    );

    expect(screen.getByText('Azul')).toBeTruthy();
    expect(JSON.stringify(toJSON())).not.toContain('"   "');
  });

  test('con mensaje lo muestra', () => {
    render(<EvidenciaReclamo reclamo={reclamo({ mensaje: 'Lo tengo yo' })} />);

    expect(screen.getByText('Lo tengo yo')).toBeTruthy();
  });
});
