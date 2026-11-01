import { act, fireEvent, render, screen } from '@testing-library/react-native';
import FormularioPublicacion, {
  valoresDesdePublicacion,
} from '../../components/FormularioPublicacion';
import { fechaLocal } from '../../data/busqueda';
import * as conexion from '../../services/conexion';
import { describirUbicacion } from '../../services/ubicacion';
import { diferida } from '../hooks/entorno';
import { elegirBarrio, elegirCategoria, elegirHora } from './ayudas';

// Asistente de publicación por pasos: se prueba el formulario solo, con el GPS y el geocodificador
// reemplazados. Los recorridos completos con borrador y cola están en screens/CreatePostScreen.test.js.

let mockHayConexion = true;
const mockObtener = jest.fn();

jest.mock('../../context/ConexionContext', () => ({
  useConexion: () => ({ hayConexion: mockHayConexion }),
}));

jest.mock('../../hooks/useUbicacionActual', () => ({
  __esModule: true,
  default: () => ({ obtener: mockObtener, cargando: false, error: '' }),
}));

jest.mock('../../services/ubicacion', () => ({ describirUbicacion: jest.fn() }));

const PALERMO = { latitud: -34.5889, longitud: -58.4306 };
const GPS = { latitud: -34.6, longitud: -58.41 };

const cambiar = (etiqueta, valor) => fireEvent.changeText(screen.getByLabelText(etiqueta), valor);
const tocar = (texto) => fireEvent.press(screen.getByText(texto));
const presionar = (texto) => act(async () => { fireEvent.press(screen.getByText(texto)); });
const hay = (texto) => screen.queryByText(texto) !== null;
const valorDe = (etiqueta) => screen.getByLabelText(etiqueta).props.accessibilityValue.text;

const montar = (props = {}) => {
  const onEnviar = props.onEnviar ?? jest.fn().mockResolvedValue(undefined);
  render(<FormularioPublicacion {...props} onEnviar={onEnviar} />);
  return onEnviar;
};

const textosDeDatos = () => {
  cambiar('Título', 'Llavero azul');
  elegirCategoria('Llaves');
  cambiar('Descripción', 'Tres llaves con un llavero azul.');
  elegirHora('00:00');
};

beforeEach(() => {
  mockHayConexion = true;
  mockObtener.mockReset();
  jest.mocked(describirUbicacion).mockReset();
  jest.spyOn(conexion, 'verificarConexion').mockResolvedValue(true);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('pasos del asistente', () => {
  test('una pérdida tiene cuatro pasos, en el orden de la consigna', () => {
    montar();

    expect(screen.getByText('Paso 1 de 4')).toBeTruthy();
    expect(hay('¿Qué querés publicar?')).toBe(true);
    expect(hay('Atrás')).toBe(false);
    expect(hay('Publicar mi pérdida')).toBe(false);

    tocar('Siguiente');
    expect(screen.getByText('Paso 2 de 4')).toBeTruthy();
    expect(hay('Fotos (opcional)')).toBe(true);
    expect(hay('Sacar una foto')).toBe(true);

    tocar('Siguiente');
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
    expect(hay('¿Qué es y cuándo pasó?')).toBe(true);

    textosDeDatos();
    tocar('Siguiente');
    expect(screen.getByText('Paso 4 de 4')).toBeTruthy();
    expect(hay('¿Dónde fue?')).toBe(true);
    expect(hay('Siguiente')).toBe(false);
    expect(hay('Publicar mi pérdida')).toBe(true);
    expect(hay('Atrás')).toBe(true);
  });

  test('un hallazgo suma el paso de verificación al final', () => {
    montar({ tipoInicial: 'encontre', valoresIniciales: { paso: 4, barrio: 'Palermo' } });

    expect(screen.getByText('Paso 4 de 5')).toBeTruthy();
    expect(hay('Publicar mi hallazgo')).toBe(false);
    cambiar('Dirección exacta', 'Calle 1');
    tocar('Siguiente');

    expect(screen.getByText('Paso 5 de 5')).toBeTruthy();
    expect(hay('Verificación del dueño')).toBe(true);
    expect(hay('Publicar mi hallazgo')).toBe(true);
  });

  test('Siguiente valida solo el paso actual y no deja avanzar con errores', () => {
    montar({ valoresIniciales: { paso: 3 } });

    tocar('Siguiente');

    expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
    expect(hay('Escribí un título de al menos 3 caracteres.')).toBe(true);
    expect(hay('Elegí una categoría.')).toBe(true);
    expect(hay('Describí el objeto con al menos 10 caracteres.')).toBe(true);
    expect(hay('Elegí la hora del suceso.')).toBe(true);
    expect(hay('Revisá los campos marcados antes de seguir.')).toBe(true);
    // No muestra errores de pasos que todavía no se completaron
    expect(hay('Elegí el barrio.')).toBe(false);
  });

  test('los pasos de tipo y fotos no exigen nada', () => {
    montar();

    tocar('Siguiente');
    tocar('Siguiente');

    expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
  });

  test('Atrás no valida ni descarta lo escrito', () => {
    montar({ valoresIniciales: { paso: 3 } });
    cambiar('Título', 'Llavero azul');

    tocar('Atrás');
    expect(screen.getByText('Paso 2 de 4')).toBeTruthy();
    expect(hay('Escribí un título de al menos 3 caracteres.')).toBe(false);
    expect(hay('Elegí una categoría.')).toBe(false);

    tocar('Siguiente');
    expect(screen.getByLabelText('Título').props.value).toBe('Llavero azul');
  });

  test('al enviar valida todo y vuelve al primer paso con error', async () => {
    const onEnviar = montar({
      valoresIniciales: { paso: 4, barrio: 'Palermo', direccionExacta: 'Calle 1' },
    });

    await presionar('Publicar mi pérdida');

    expect(onEnviar).not.toHaveBeenCalled();
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
    expect(hay('Escribí un título de al menos 3 caracteres.')).toBe(true);
    expect(hay('Elegí la hora del suceso.')).toBe(true);
  });

  test('cambiar a «perdí» saca el paso de verificación sin borrar lo escrito', () => {
    montar({ tipoInicial: 'encontre', valoresIniciales: { paso: 1, preguntaVerificacion: '¿Qué figura?', respuestaVerificacion: 'Un ancla' } });

    expect(screen.getByText('Paso 1 de 5')).toBeTruthy();
    tocar('Perdí algo');
    expect(screen.getByText('Paso 1 de 4')).toBeTruthy();

    tocar('Encontré algo');
    expect(screen.getByText('Paso 1 de 5')).toBeTruthy();
    for (let i = 0; i < 4; i += 1) {
      // Se completan los pasos intermedios para llegar a la verificación
      if (i === 2) { textosDeDatos(); }
      if (i === 3) { elegirBarrio('Palermo'); cambiar('Dirección exacta', 'Calle 1'); }
      tocar('Siguiente');
    }
    expect(screen.getByLabelText('Pregunta de verificación').props.value).toBe('¿Qué figura?');
    expect(screen.getByLabelText('Respuesta de verificación').props.value).toBe('Un ancla');
  });

  test('un paso que ya no existe se acota al último', () => {
    montar({ tipoInicial: 'perdi', valoresIniciales: { paso: 5 } });

    expect(screen.getByText('Paso 4 de 4')).toBeTruthy();
  });

  test.each([[0], [-3], [undefined], ['dos'], [null], [2.5]])(
    'un borrador con paso inválido (%p) empieza en el primer paso o se acota sin romper',
    (paso) => {
      montar({ valoresIniciales: { paso } });

      expect(screen.getByText(/^Paso \d de 4$/)).toBeTruthy();
    }
  );

  test('informa el paso en cada cambio para el borrador y avisa para volver al inicio', () => {
    const alCambiar = jest.fn();
    const alCambiarPaso = jest.fn();
    montar({ alCambiar, alCambiarPaso });

    expect(alCambiar).toHaveBeenLastCalledWith(expect.objectContaining({ paso: 1, hora: '' }));
    expect(alCambiar.mock.lastCall[0]).not.toHaveProperty('franja');
    expect(alCambiarPaso).not.toHaveBeenCalled();

    tocar('Siguiente');
    expect(alCambiar).toHaveBeenLastCalledWith(expect.objectContaining({ paso: 2 }));
    expect(alCambiarPaso).toHaveBeenCalledTimes(1);

    tocar('Atrás');
    expect(alCambiarPaso).toHaveBeenCalledTimes(2);
  });

  test('la fecha y la hora sirven para un borrador viejo con franja pero sin hora: pide la hora al validar', () => {
    montar({ valoresIniciales: { paso: 3, franja: 'tarde', titulo: 'Llavero azul', categoria: 'Llaves', descripcion: 'Tres llaves con un llavero azul.' } });

    tocar('Siguiente');

    expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
    expect(hay('Elegí la hora del suceso.')).toBe(true);
    expect(hay('Escribí un título de al menos 3 caracteres.')).toBe(false);
  });
});

describe('fecha y hora', () => {
  const congelarHoy = (hora, minutos = 0) => {
    jest.useFakeTimers({
      now: new Date(2026, 10, 1, hora, minutos),
      doNotFake: [
        'nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout',
        'clearTimeout', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
        'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime',
      ],
    });
  };

  test('la fecha arranca en hoy y la hora hay que elegirla', () => {
    congelarHoy(15);
    montar({ valoresIniciales: { paso: 3 } });

    expect(valorDe('Fecha del suceso')).toBe('01/11/2026');
    expect(valorDe('Hora del suceso')).toBe('Elegir hora');
    expect(screen.queryByLabelText('Franja horaria')).toBeNull();
    expect(hay('Mañana (6 a 12)')).toBe(false);
  });

  test('no se puede elegir una hora futura si el suceso es de hoy', () => {
    congelarHoy(15);
    montar({ valoresIniciales: { paso: 3 } });

    elegirHora('18:00');

    expect(hay('La hora no puede ser futura: el suceso es de hoy.')).toBe(true);
    tocar('Siguiente');
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy();

    elegirHora('14:59');
    expect(hay('La hora no puede ser futura: el suceso es de hoy.')).toBe(false);
  });

  test('una hora igual a la actual es válida', () => {
    congelarHoy(15, 30);
    montar({ valoresIniciales: { paso: 3 } });

    elegirHora('15:30');

    expect(hay('La hora no puede ser futura: el suceso es de hoy.')).toBe(false);
  });

  test('con una fecha anterior cualquier hora vale, y si después vuelven a hoy aparece el aviso', () => {
    congelarHoy(15);
    montar({ valoresIniciales: { paso: 3 } });

    tocar('Ayer');
    elegirHora('23:00');
    expect(hay('La hora no puede ser futura: el suceso es de hoy.')).toBe(false);

    tocar('Hoy');
    expect(hay('La hora no puede ser futura: el suceso es de hoy.')).toBe(true);

    tocar('Ayer');
    expect(hay('La hora no puede ser futura: el suceso es de hoy.')).toBe(false);
  });

  test('el selector de fecha no permite fechas futuras', () => {
    congelarHoy(15);
    montar({ valoresIniciales: { paso: 3 } });

    fireEvent.press(screen.getByLabelText('Fecha del suceso'));

    expect(screen.getByTestId('datetimepicker').props.maximumDate.getDate()).toBe(1);
    expect(screen.getByTestId('datetimepicker').props.mode).toBe('date');
  });

  test('envía la hora elegida', async () => {
    const onEnviar = montar({
      valoresIniciales: {
        paso: 4, titulo: 'Llavero azul', categoria: 'Llaves', descripcion: 'Tres llaves con un llavero azul.',
        hora: '10:15', fecha: '2026-10-01', barrio: 'Palermo', direccionExacta: 'Calle 1',
      },
    });

    await presionar('Publicar mi pérdida');

    expect(onEnviar).toHaveBeenCalledWith(expect.objectContaining({ fecha: '2026-10-01', hora: '10:15' }));
    expect(onEnviar.mock.calls[0][0]).not.toHaveProperty('franja');
  });
});

describe('barrio y dirección', () => {
  test('la dirección ya no es opcional y mantiene la ayuda de privacidad', () => {
    montar({ valoresIniciales: { paso: 4 } });

    expect(hay('Dirección exacta (opcional)')).toBe(false);
    expect(hay('Solo la ve la persona cuyo reclamo aceptes. El resto de los usuarios ve únicamente el barrio.')).toBe(true);

  });

  test('sin barrio ni dirección no se puede publicar', async () => {
    const onEnviar = montar({
      valoresIniciales: { paso: 4, titulo: 'Llavero azul', categoria: 'Llaves', descripcion: 'Tres llaves con un llavero azul.', hora: '00:00' },
    });

    await presionar('Publicar mi pérdida');

    expect(onEnviar).not.toHaveBeenCalled();
    expect(hay('Elegí el barrio.')).toBe(true);
    expect(hay('Escribí la dirección exacta.')).toBe(true);
  });

  test('un barrio guardado que ya no está en la lista hay que volver a elegirlo', async () => {
    const onEnviar = montar({
      valoresIniciales: { ...valoresDesdePublicacion({ tipo: 'perdido', barrio: 'Ubicación actual', direccionExacta: 'Calle 1' }), paso: 4 },
    });

    await presionar('Publicar mi pérdida');

    expect(onEnviar).not.toHaveBeenCalled();
    expect(screen.getByText('Paso 3 de 4')).toBeTruthy();
  });

  test('envía el barrio siempre y la ubicación con el centro del barrio elegido a mano', async () => {
    const onEnviar = montar({
      valoresIniciales: {
        paso: 4, titulo: 'Llavero azul', categoria: 'Llaves', descripcion: 'Tres llaves con un llavero azul.',
        hora: '00:00',
      },
    });
    elegirBarrio('Palermo');
    cambiar('Dirección exacta', '  Calle 1 ');

    await presionar('Publicar mi pérdida');

    expect(onEnviar).toHaveBeenCalledWith(expect.objectContaining({
      barrio: 'Palermo', direccionExacta: 'Calle 1', ubicacion: PALERMO,
    }));
  });
});

describe('Usar mi ubicación actual', () => {
  const abrirUbicacion = (extra = {}) => montar({
    valoresIniciales: {
      paso: 4, titulo: 'Llavero azul', categoria: 'Llaves', descripcion: 'Tres llaves con un llavero azul.',
      hora: '00:00', ...extra,
    },
  });
  const usarGps = () => presionar('Usar mi ubicación actual');

  test('guarda las coordenadas, selecciona el barrio, completa la dirección y lo avisa', async () => {
    mockObtener.mockResolvedValue(GPS);
    jest.mocked(describirUbicacion).mockResolvedValue({ barrio: 'Belgrano', direccion: 'Av. Cabildo 2000, Buenos Aires' });
    const onEnviar = abrirUbicacion();

    await usarGps();

    expect(describirUbicacion).toHaveBeenCalledWith(GPS);
    expect(valorDe('Barrio')).toBe('Belgrano');
    expect(screen.getByLabelText('Dirección exacta').props.value).toBe('Av. Cabildo 2000, Buenos Aires');
    expect(hay('Completamos el barrio (Belgrano) y la dirección con tu ubicación. Revisalo: podés corregirlo.')).toBe(true);

    await presionar('Publicar mi pérdida');
    expect(onEnviar).toHaveBeenCalledWith(expect.objectContaining({
      barrio: 'Belgrano', ubicacion: GPS, direccionExacta: 'Av. Cabildo 2000, Buenos Aires',
    }));
  });

  test('muestra un estado de carga mientras busca el barrio y la dirección', async () => {
    mockObtener.mockResolvedValue(GPS);
    const espera = diferida();
    jest.mocked(describirUbicacion).mockReturnValue(espera.promesa);
    abrirUbicacion();

    await usarGps();
    expect(hay('Buscando barrio y dirección…')).toBe(true);

    await act(async () => { espera.resolver({ barrio: 'Belgrano', direccion: null }); });
    expect(hay('Buscando barrio y dirección…')).toBe(false);
    expect(hay('Usar mi ubicación actual')).toBe(true);
  });

  test('nunca pisa la dirección que escribió la persona', async () => {
    mockObtener.mockResolvedValue(GPS);
    jest.mocked(describirUbicacion).mockResolvedValue({ barrio: 'Belgrano', direccion: 'Av. Cabildo 2000' });
    abrirUbicacion({ direccionExacta: 'Detrás del kiosco' });

    await usarGps();

    expect(screen.getByLabelText('Dirección exacta').props.value).toBe('Detrás del kiosco');
    expect(valorDe('Barrio')).toBe('Belgrano');
    expect(hay('Completamos el barrio (Belgrano) con tu ubicación. Revisalo: podés corregirlo.')).toBe(true);
  });

  test('puede volver a completar una dirección que había puesto el propio autocompletado', async () => {
    mockObtener.mockResolvedValue(GPS);
    jest.mocked(describirUbicacion).mockResolvedValueOnce({ barrio: 'Belgrano', direccion: 'Av. Cabildo 2000' });
    abrirUbicacion();
    await usarGps();
    expect(screen.getByLabelText('Dirección exacta').props.value).toBe('Av. Cabildo 2000');

    jest.mocked(describirUbicacion).mockResolvedValueOnce({ barrio: 'Palermo', direccion: 'Av. Santa Fe 3000' });
    await usarGps();
    expect(screen.getByLabelText('Dirección exacta').props.value).toBe('Av. Santa Fe 3000');

    // Si después la persona la edita, ya no se toca
    cambiar('Dirección exacta', 'Av. Santa Fe 3000, piso 2');
    jest.mocked(describirUbicacion).mockResolvedValueOnce({ barrio: 'Palermo', direccion: 'Otra calle 1' });
    await usarGps();
    expect(screen.getByLabelText('Dirección exacta').props.value).toBe('Av. Santa Fe 3000, piso 2');
  });

  test('si no hay barrio cercano pide elegirlo y no borra el que había', async () => {
    mockObtener.mockResolvedValue(GPS);
    jest.mocked(describirUbicacion).mockResolvedValue({ barrio: null, direccion: 'Ruta 9 km 40' });
    abrirUbicacion();

    await usarGps();

    expect(valorDe('Barrio')).toBe('Elegir barrio');
    expect(hay('Completamos la dirección con tu ubicación. Revisalo: podés corregirlo. No encontramos un barrio cerca: elegilo de la lista.')).toBe(true);

  });

  test('si no hay dirección (por ejemplo sin red) pide escribirla', async () => {
    mockObtener.mockResolvedValue(GPS);
    jest.mocked(describirUbicacion).mockResolvedValue({ barrio: 'Belgrano', direccion: null });
    const onEnviar = abrirUbicacion();

    await usarGps();

    expect(valorDe('Barrio')).toBe('Belgrano');
    expect(screen.getByLabelText('Dirección exacta').props.value).toBe('');
    expect(hay('Completamos el barrio (Belgrano) con tu ubicación. Revisalo: podés corregirlo. No pudimos obtener la dirección: escribila vos.')).toBe(true);

    await presionar('Publicar mi pérdida');
    expect(onEnviar).not.toHaveBeenCalled();
    expect(hay('Escribí la dirección exacta.')).toBe(true);
  });

  test('sin permiso o sin GPS no cambia nada', async () => {
    mockObtener.mockResolvedValue(null);
    abrirUbicacion({ barrio: 'Palermo' });

    await usarGps();

    expect(describirUbicacion).not.toHaveBeenCalled();
    expect(valorDe('Barrio')).toBe('Palermo');
  });

  test('elegir otro barrio a mano limpia las coordenadas y usa el centro del barrio', async () => {
    mockObtener.mockResolvedValue(GPS);
    jest.mocked(describirUbicacion).mockResolvedValue({ barrio: 'Belgrano', direccion: 'Av. Cabildo 2000' });
    const onEnviar = abrirUbicacion();
    await usarGps();

    elegirBarrio('Palermo');
    expect(hay('Completamos el barrio (Belgrano) y la dirección con tu ubicación. Revisalo: podés corregirlo.')).toBe(false);

    await presionar('Publicar mi pérdida');
    expect(onEnviar).toHaveBeenCalledWith(expect.objectContaining({
      barrio: 'Palermo', ubicacion: PALERMO, direccionExacta: 'Av. Cabildo 2000',
    }));
  });
});

describe('edición', () => {
  const publicacion = {
    tipo: 'perdido', titulo: 'Llavero azul', categoria: 'Llaves', descripcion: 'Tres llaves con un llavero azul.',
    barrio: 'Palermo', fecha: '2026-10-01', hora: '18:30', franja: 'tarde', direccionExacta: 'Calle 1',
    fotos: [], ubicacion: PALERMO,
  };

  test('no tiene el paso de tipo y empieza por las fotos', () => {
    montar({ modo: 'editar', valoresIniciales: valoresDesdePublicacion(publicacion), textoEnviar: 'Guardar cambios' });

    expect(screen.getByText('Paso 1 de 3')).toBeTruthy();
    expect(hay('Fotos (opcional)')).toBe(true);
    expect(hay('Perdí algo')).toBe(false);
  });

  test('carga la hora y no trata el centro del barrio como coordenadas propias', async () => {
    expect(valoresDesdePublicacion(publicacion)).toMatchObject({ hora: '18:30', coords: null, direccionExacta: 'Calle 1' });

    const onEnviar = montar({
      modo: 'editar', valoresIniciales: { ...valoresDesdePublicacion(publicacion), paso: 3 }, textoEnviar: 'Guardar cambios',
    });
    await presionar('Guardar cambios');

    expect(onEnviar).toHaveBeenCalledWith(expect.objectContaining({
      hora: '18:30', barrio: 'Palermo', ubicacion: PALERMO, direccionExacta: 'Calle 1',
    }));
  });

  test('una publicación vieja sin hora ni dirección las pide al guardar', async () => {
    const vieja = { ...publicacion, hora: null, direccionExacta: null };
    const onEnviar = montar({
      modo: 'editar', valoresIniciales: { ...valoresDesdePublicacion(vieja), paso: 3 }, textoEnviar: 'Guardar cambios',
    });

    await presionar('Guardar cambios');

    expect(onEnviar).not.toHaveBeenCalled();
    expect(screen.getByText('Paso 2 de 3')).toBeTruthy();
    expect(hay('Elegí la hora del suceso.')).toBe(true);

    elegirHora('09:00');
    tocar('Siguiente');
    await presionar('Guardar cambios');
    expect(onEnviar).not.toHaveBeenCalled();
    expect(hay('Escribí la dirección exacta.')).toBe(true);

    cambiar('Dirección exacta', 'Calle 2');
    await presionar('Guardar cambios');
    expect(onEnviar).toHaveBeenCalledWith(expect.objectContaining({ hora: '09:00', direccionExacta: 'Calle 2' }));
  });
});

describe('sin conexión', () => {
  test('se pueden completar todos los pasos y el último ofrece guardar para después', async () => {
    mockHayConexion = false;
    jest.mocked(conexion.verificarConexion).mockResolvedValue(false);
    const onEncolar = jest.fn().mockResolvedValue(undefined);
    const onEnviar = montar({ onEncolar });

    expect(hay('Sin conexión: podés guardar la publicación y se enviará sola cuando vuelva la conexión.')).toBe(false);
    tocar('Siguiente');
    tocar('Siguiente');
    textosDeDatos();
    tocar('Siguiente');
    elegirBarrio('Palermo');
    cambiar('Dirección exacta', 'Calle 1');

    expect(hay('Sin conexión: podés guardar la publicación y se enviará sola cuando vuelva la conexión.')).toBe(true);
    await presionar('Guardar para enviar después');

    expect(onEnviar).not.toHaveBeenCalled();
    expect(onEncolar).toHaveBeenCalledWith(expect.objectContaining({
      hora: '00:00', barrio: 'Palermo', direccionExacta: 'Calle 1', fecha: fechaLocal(),
    }));
  });
});
