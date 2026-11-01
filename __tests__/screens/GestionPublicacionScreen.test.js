import { render, screen } from '@testing-library/react-native';
import GestionPublicacionScreen from '../../screens/GestionPublicacionScreen';
import useGestionPublicacion from '../../hooks/useGestionPublicacion';
import { useConexion } from '../../context/ConexionContext';
import { __navegacion as navegacion } from '@react-navigation/native';

jest.mock('../../hooks/useGestionPublicacion');
jest.mock('../../context/ConexionContext');
jest.mock('../../components/EncuentroReclamo', () => () => null);
jest.mock('../../components/EvidenciaReclamo', () => () => null);

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
  direccionExacta: 'Calle 1',
  ...extra,
});

function montar(extra) {
  jest.mocked(useGestionPublicacion).mockReturnValue({
    publicacion: publicacion(extra),
    reclamos: [],
    totalReclamos: 0,
    hayMasReclamos: false,
    loading: false,
    refrescando: false,
    cargandoMas: false,
    error: '',
    procesando: null,
    recargar: jest.fn(),
    cargarMasReclamos: jest.fn(),
    guardarCambios: jest.fn(),
    eliminar: jest.fn(),
    renovar: jest.fn(),
    aceptarReclamo: jest.fn(),
    rechazarReclamo: jest.fn(),
    confirmarDevolucion: jest.fn(),
  });
  jest.mocked(useConexion).mockReturnValue({ hayConexion: true });
  render(<GestionPublicacionScreen route={{ params: { publicacionId: 'p1' } }} navigation={navegacion} />);
}

describe('GestionPublicacionScreen: datos del suceso', () => {
  test('con hora la muestra junto a la fecha y conserva la franja', () => {
    montar({ hora: '18:30' });

    expect(screen.getByText('Llaves · Palermo · 30/10/2026 · 18:30 h · Tarde (12 a 19 h)')).toBeTruthy();
  });

  test('una publicación vieja sin hora muestra solo la franja', () => {
    montar({ hora: null });

    expect(screen.getByText('Llaves · Palermo · 30/10/2026 · Tarde (12 a 19 h)')).toBeTruthy();
  });
});
