import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  armarBorrador,
  borradorVacio,
  claveBorrador,
  descartarBorrador,
  guardarBorrador,
  interpretarBorrador,
  leerBorrador,
  normalizarValores,
} from '../../services/borradores';

const FOTO = 'file:///documentos/hallado/borradores/u1/foto.jpg';
const siempre = () => true;

const valores = (extra = {}) => ({
  tipo: 'encontre',
  titulo: 'Llaves con llavero rojo',
  categoria: 'Llaves',
  descripcion: 'Cerca del subte',
  barrio: 'Palermo',
  coords: { latitud: -34.6, longitud: -58.4 },
  direccionExacta: 'Calle 1',
  fecha: '2026-10-01',
  hora: '09:15',
  paso: 3,
  fotos: [FOTO],
  preguntaVerificacion: '¿Cuántas llaves?',
  respuestaVerificacion: 'Tres',
  ...extra,
});

describe('normalizarValores', () => {
  test('con basura devuelve el formulario vacío con la forma esperada', () => {
    expect(normalizarValores(null)).toEqual({
      tipo: 'perdi',
      titulo: '',
      categoria: '',
      descripcion: '',
      barrio: '',
      coords: null,
      direccionExacta: '',
      fecha: '',
      hora: '',
      paso: 1,
      fotos: [],
      preguntaVerificacion: '',
      respuestaVerificacion: '',
    });
  });

  test('los campos de texto que no son string quedan vacíos', () => {
    const n = normalizarValores({ titulo: 123, descripcion: { x: 1 }, barrio: null });
    expect(n.titulo).toBe('');
    expect(n.descripcion).toBe('');
    expect(n.barrio).toBe('');
  });

  test('solo conserva el tipo «encontre»; cualquier otro valor pasa a «perdi»', () => {
    expect(normalizarValores({ tipo: 'encontre' }).tipo).toBe('encontre');
    expect(normalizarValores({ tipo: 'otro' }).tipo).toBe('perdi');
  });

  test('las coordenadas deben tener latitud y longitud numéricas', () => {
    expect(normalizarValores({ coords: { latitud: 1, longitud: 2, extra: true } }).coords).toEqual({
      latitud: 1,
      longitud: 2,
    });
    expect(normalizarValores({ coords: { latitud: '1', longitud: 2 } }).coords).toBeNull();
    expect(normalizarValores({ coords: { latitud: 1 } }).coords).toBeNull();
  });

  test('el paso debe ser un entero desde 1; si no, vuelve al primero', () => {
    expect(normalizarValores({ paso: 4 }).paso).toBe(4);
    for (const paso of [0, -2, 1.5, '3', null, undefined, NaN]) {
      expect(normalizarValores({ paso }).paso).toBe(1);
    }
  });

  test('un borrador viejo con franja y sin hora se normaliza sin la franja y con la hora vacía', () => {
    const n = normalizarValores({ titulo: 'Llaves', franja: 'tarde' });
    expect(n.hora).toBe('');
    expect(n).not.toHaveProperty('franja');
  });

  test('las fotos se filtran: solo strings no vacíos', () => {
    expect(normalizarValores({ fotos: ['a', '', 3, null, 'b'] }).fotos).toEqual(['a', 'b']);
    expect(normalizarValores({ fotos: 'a' }).fotos).toEqual([]);
  });
});

describe('borradorVacio', () => {
  test('un formulario sin contenido está vacío, aunque tenga tipo y fecha', () => {
    expect(borradorVacio({ tipo: 'encontre', fecha: '2026-10-01' })).toBe(true);
    expect(borradorVacio({ titulo: '   ', descripcion: '  ' })).toBe(true);
    expect(borradorVacio(undefined)).toBe(true);
  });

  test.each([
    ['título', { titulo: 'Algo' }],
    ['categoría', { categoria: 'Llaves' }],
    ['descripción', { descripcion: 'Algo' }],
    ['barrio', { barrio: 'Palermo' }],
    ['coordenadas', { coords: { latitud: 1, longitud: 2 } }],
    ['dirección', { direccionExacta: 'Calle 1' }],
    ['hora', { hora: '10:00' }],
    ['foto', { fotos: [FOTO] }],
    ['pregunta de verificación', { preguntaVerificacion: '¿?' }],
    ['respuesta de verificación', { respuestaVerificacion: 'Sí' }],
  ])('con %s ya no está vacío', (_nombre, parcial) => {
    expect(borradorVacio(parcial)).toBe(false);
  });
});

describe('armarBorrador e interpretarBorrador', () => {
  test('ida y vuelta: lo armado se interpreta igual', () => {
    const registro = armarBorrador({
      valores: valores(),
      clientId: 'app-1',
      fotosSubidas: { [FOTO]: '/uploads/images/1.jpg' },
      ahora: 12345,
    });

    const leido = interpretarBorrador(JSON.stringify(registro), siempre);

    expect(leido).toEqual(registro);
    expect(leido).toMatchObject({ clientId: 'app-1', guardadoAt: 12345, version: 1 });
  });

  test('armarBorrador conserva solo las fotos subidas que siguen en el formulario', () => {
    const registro = armarBorrador({
      valores: valores(),
      fotosSubidas: { [FOTO]: '/u/1.jpg', 'file:///quitada.jpg': '/u/2.jpg' },
    });
    expect(registro.fotosSubidas).toEqual({ [FOTO]: '/u/1.jpg' });
  });

  test('un clientId inválido queda en null', () => {
    expect(armarBorrador({ valores: valores(), clientId: '' }).clientId).toBeNull();
    expect(armarBorrador({ valores: valores(), clientId: 5 }).clientId).toBeNull();
  });

  test('interpretarBorrador descarta las fotos cuyo archivo ya no existe', () => {
    const registro = armarBorrador({ valores: valores(), fotosSubidas: { [FOTO]: '/u/1.jpg' } });

    const leido = interpretarBorrador(registro, () => false);

    expect(leido.valores.fotos).toEqual([]);
    expect(leido.fotosSubidas).toEqual({});
    expect(leido.valores.titulo).toBe('Llaves con llavero rojo');
  });

  test('si al perder las fotos no queda contenido, no hay borrador', () => {
    const registro = armarBorrador({ valores: { fotos: [FOTO] } });
    expect(interpretarBorrador(registro, () => false)).toBeNull();
  });

  test('registros dañados o de otra versión devuelven null', () => {
    expect(interpretarBorrador('{no es json', siempre)).toBeNull();
    expect(interpretarBorrador(null, siempre)).toBeNull();
    expect(interpretarBorrador({ version: 99, valores: valores() }, siempre)).toBeNull();
    expect(interpretarBorrador({ version: 1 }, siempre)).toBeNull();
  });
});

describe('almacenamiento del borrador', () => {
  test('guardar y leer devuelve el borrador de esa cuenta', async () => {
    await guardarBorrador('u1', { valores: valores({ fotos: [] }), clientId: 'app-1' });

    const leido = await leerBorrador('u1');
    expect(leido.valores.titulo).toBe('Llaves con llavero rojo');
    expect(leido.clientId).toBe('app-1');
  });

  test('el borrador de una cuenta no se ve desde otra', async () => {
    await guardarBorrador('u1', { valores: valores({ fotos: [] }) });
    expect(await leerBorrador('u2')).toBeNull();
  });

  test('guardar un formulario vacío elimina el borrador existente', async () => {
    await guardarBorrador('u1', { valores: valores({ fotos: [] }) });
    await guardarBorrador('u1', { valores: { tipo: 'perdi' } });

    expect(await AsyncStorage.getItem(claveBorrador('u1'))).toBeNull();
  });

  test('descartarBorrador lo elimina', async () => {
    await guardarBorrador('u1', { valores: valores({ fotos: [] }) });
    await descartarBorrador('u1');

    expect(await leerBorrador('u1')).toBeNull();
  });

  test('un guardado pedido antes de descartar no resucita el borrador', async () => {
    const guardado = guardarBorrador('u1', { valores: valores({ fotos: [] }) });
    const descartado = descartarBorrador('u1');
    await Promise.all([guardado, descartado]);

    expect(await leerBorrador('u1')).toBeNull();
  });

  test('sin cuenta no hace nada', async () => {
    await guardarBorrador(null, { valores: valores({ fotos: [] }) });
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(await leerBorrador(null)).toBeNull();
  });
});
