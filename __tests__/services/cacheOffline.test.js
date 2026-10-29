import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  guardarPublicacionConsultada,
  guardarUltimosReclamos,
  guardarUltimosResultadosBusqueda,
  limpiarCacheUsuario,
  obtenerConsultadasRecientes,
  obtenerPublicacionCacheada,
  obtenerUltimosReclamos,
  obtenerUltimosResultadosBusqueda,
  setUsuarioCache,
} from '../../services/cacheOffline';

const publicacionAjena = (id, extra = {}) => ({
  id,
  titulo: `Objeto ${id}`,
  descripcion: 'Se encontró cerca de la plaza',
  categoria: 'Llaves',
  barrio: 'Palermo',
  tipo: 'encontrado',
  estado: 'abierta',
  fecha: '2026-10-01',
  fotos: [],
  esPropia: false,
  direccionExacta: 'Av. Santa Fe 1234, piso 3',
  latitud: -34.588123,
  longitud: -58.430987,
  publicador: { id: 'u-9', name: 'Ana', phone: '+54 11 5555-1234', telefono: '1155551234' },
  ...extra,
});

async function clavesGuardadas() {
  return AsyncStorage.getAllKeys();
}

async function textoGuardado() {
  const claves = await clavesGuardadas();
  const pares = await AsyncStorage.multiGet(claves);
  return pares.map(([, valor]) => valor).join('\n');
}

afterEach(async () => {
  await setUsuarioCache(null);
});

describe('aislamiento por cuenta', () => {
  test('sin usuario activo la caché no guarda ni lee nada', async () => {
    await guardarPublicacionConsultada(publicacionAjena(1));

    expect(await clavesGuardadas()).toEqual([]);
    expect(await obtenerPublicacionCacheada(1)).toBeNull();
    expect(await obtenerConsultadasRecientes()).toEqual([]);
  });

  test('lo guardado por la cuenta A se lee como A', async () => {
    await setUsuarioCache('A');
    await guardarPublicacionConsultada(publicacionAjena(1));

    const leida = await obtenerPublicacionCacheada(1);
    expect(leida).toMatchObject({ id: '1', titulo: 'Objeto 1', desdeCache: true, esOffline: true });
    expect(await obtenerConsultadasRecientes()).toHaveLength(1);
  });

  test('lo guardado por la cuenta A no se lee como B', async () => {
    await setUsuarioCache('A');
    await guardarPublicacionConsultada(publicacionAjena(1));
    await guardarUltimosResultadosBusqueda([publicacionAjena(1)], { palabras: 'llaves' }, 'recientes');
    await guardarUltimosReclamos({ enviados: [{ id: 'r1' }], recibidos: [] });

    await setUsuarioCache('B');

    expect(await obtenerPublicacionCacheada(1)).toBeNull();
    expect(await obtenerConsultadasRecientes()).toEqual([]);
    expect(await obtenerUltimosResultadosBusqueda()).toBeNull();
    expect(await obtenerUltimosReclamos()).toBeNull();
  });

  test('aunque queden claves de A en el almacenamiento, B no las lee', async () => {
    await setUsuarioCache('A');
    await guardarPublicacionConsultada(publicacionAjena(1));
    const claves = await clavesGuardadas();
    const copia = await AsyncStorage.multiGet(claves);

    await setUsuarioCache('B');
    // Se restauran a mano las claves de A, como si la limpieza no hubiera corrido
    await AsyncStorage.multiSet(copia);

    expect(await obtenerPublicacionCacheada(1)).toBeNull();
    expect(await obtenerConsultadasRecientes()).toEqual([]);
  });

  test('cambiar de cuenta borra la caché de la cuenta saliente', async () => {
    await setUsuarioCache('A');
    await guardarPublicacionConsultada(publicacionAjena(1));
    expect((await clavesGuardadas()).length).toBeGreaterThan(0);

    await setUsuarioCache('B');

    expect(await clavesGuardadas()).toEqual([]);
  });

  test('setUsuarioCache(null) limpia la cuenta saliente', async () => {
    await setUsuarioCache('A');
    await guardarPublicacionConsultada(publicacionAjena(1));
    await guardarUltimosResultadosBusqueda([publicacionAjena(1)], null, 'recientes');

    await setUsuarioCache(null);

    expect(await clavesGuardadas()).toEqual([]);
    expect(await obtenerPublicacionCacheada(1)).toBeNull();
  });

  test('limpiar la cuenta A no toca la caché de otra cuenta ni la cola o el borrador', async () => {
    await AsyncStorage.setItem('@hallado:cache/B/consultadas', '[]');
    await AsyncStorage.setItem('@hallado:cola/A', '[]');
    await AsyncStorage.setItem('@hallado:borrador/A', '{}');
    await AsyncStorage.setItem('@hallado:cache/A/consultadas', '[]');

    await limpiarCacheUsuario('A');

    expect((await clavesGuardadas()).sort()).toEqual([
      '@hallado:borrador/A',
      '@hallado:cache/B/consultadas',
      '@hallado:cola/A',
    ]);
  });

  test('las claves de la versión anterior (globales) nunca se leen', async () => {
    await AsyncStorage.setItem(
      '@hallado:cache_publicaciones',
      JSON.stringify([publicacionAjena(1)])
    );
    await setUsuarioCache('A');

    expect(await obtenerConsultadasRecientes()).toEqual([]);
    expect(await obtenerPublicacionCacheada(1)).toBeNull();
  });
});

describe('minimización de datos', () => {
  test('en publicaciones ajenas no se guarda la dirección exacta ni el teléfono', async () => {
    await setUsuarioCache('A');
    await guardarPublicacionConsultada(publicacionAjena(1));
    await guardarUltimosResultadosBusqueda([publicacionAjena(1)], null, 'recientes');

    const todo = await textoGuardado();
    expect(todo).not.toContain('Av. Santa Fe 1234');
    expect(todo).not.toContain('5555-1234');
    expect(todo).not.toContain('1155551234');

    const leida = await obtenerPublicacionCacheada(1);
    expect(leida.direccionExacta).toBeNull();
    expect(leida.publicador).toEqual({ id: 'u-9', name: 'Ana' });
  });

  test('en publicaciones ajenas las coordenadas se redondean', async () => {
    await setUsuarioCache('A');
    await guardarPublicacionConsultada(publicacionAjena(1));

    const leida = await obtenerPublicacionCacheada(1);
    expect(leida.latitud).toBe(-34.588);
    expect(leida.longitud).toBe(-58.431);
  });

  test('en las publicaciones propias sí se conserva la dirección exacta', async () => {
    await setUsuarioCache('A');
    await guardarPublicacionConsultada(publicacionAjena(2, { esPropia: true }));

    const leida = await obtenerPublicacionCacheada(2);
    expect(leida.direccionExacta).toBe('Av. Santa Fe 1234, piso 3');
    expect(leida.latitud).toBe(-34.588123);
  });

  test('los resultados de búsqueda guardados también van minimizados', async () => {
    await setUsuarioCache('A');
    await guardarUltimosResultadosBusqueda(
      [publicacionAjena(1), publicacionAjena(2, { esPropia: true })],
      { palabras: 'llaves' },
      'recientes'
    );

    const guardada = await obtenerUltimosResultadosBusqueda();
    expect(guardada.filtros).toEqual({ palabras: 'llaves' });
    expect(guardada.resultados[0].direccionExacta).toBeNull();
    expect(guardada.resultados[1].direccionExacta).toBe('Av. Santa Fe 1234, piso 3');
  });

  test('de los reclamos no se guarda el teléfono de la contraparte', async () => {
    await setUsuarioCache('A');
    await guardarUltimosReclamos({
      enviados: [{ id: 'r1', telefono: '1144443333', publicacion: publicacionAjena(1) }],
      recibidos: [],
    });

    const todo = await textoGuardado();
    expect(todo).not.toContain('1144443333');
    expect(todo).not.toContain('Av. Santa Fe 1234');
    expect((await obtenerUltimosReclamos()).enviados[0].telefono).toBeNull();
  });
});

describe('límite de publicaciones consultadas', () => {
  test('al superar 25 se expulsa la más antigua y se borra su copia individual', async () => {
    await setUsuarioCache('A');

    for (let id = 1; id <= 26; id += 1) {
      await guardarPublicacionConsultada(publicacionAjena(id));
    }

    const recientes = await obtenerConsultadasRecientes();
    expect(recientes).toHaveLength(25);
    expect(recientes[0].id).toBe('26');
    expect(recientes.map((r) => r.id)).not.toContain('1');

    const claves = await clavesGuardadas();
    expect(claves).not.toContain('@hallado:cache/A/pub/1');
    expect(claves).toContain('@hallado:cache/A/pub/2');
    expect(claves).toContain('@hallado:cache/A/pub/26');
    expect(await obtenerPublicacionCacheada(1)).toBeNull();
  });

  test('volver a consultar una publicación la sube al principio sin duplicarla', async () => {
    await setUsuarioCache('A');
    await guardarPublicacionConsultada(publicacionAjena(1));
    await guardarPublicacionConsultada(publicacionAjena(2));
    await guardarPublicacionConsultada(publicacionAjena(1, { titulo: 'Actualizada' }));

    const recientes = await obtenerConsultadasRecientes();
    expect(recientes.map((r) => r.id)).toEqual(['1', '2']);
    expect(recientes[0].titulo).toBe('Actualizada');
  });
});
