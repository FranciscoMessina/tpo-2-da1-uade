import {
  aplicarFotosLocales,
  conservarLocales,
  esFotoDescargable,
  esRutaPrivada,
  extensionDeUri,
  fotosDescargables,
  nombreArchivoLocal,
  segmentoSeguro,
} from '../../services/archivosLocales';

const BASE = 'https://api.hallado.test';

describe('esFotoDescargable', () => {
  test('acepta una imagen pública del propio backend', () => {
    expect(esFotoDescargable(`${BASE}/uploads/images/foto.jpg`, BASE)).toBe(true);
  });

  test('ignora la barra final de la URL base', () => {
    expect(esFotoDescargable(`${BASE}/uploads/images/foto.jpg`, `${BASE}/`)).toBe(true);
  });

  test('rechaza las pruebas privadas (/uploads/pruebas)', () => {
    expect(esFotoDescargable(`${BASE}/uploads/pruebas/comprobante.jpg`, BASE)).toBe(false);
    expect(esFotoDescargable(`${BASE}/uploads/PRUEBAS/comprobante.jpg`, BASE)).toBe(false);
    expect(esFotoDescargable(`${BASE}/uploads/%70ruebas/comprobante.jpg`, BASE)).toBe(false);
  });

  test('rechaza otros hosts, aunque parezcan el mismo', () => {
    expect(esFotoDescargable('https://otro.test/uploads/images/foto.jpg', BASE)).toBe(false);
    expect(esFotoDescargable(`${BASE}.malo.test/uploads/images/foto.jpg`, BASE)).toBe(false);
  });

  test('rechaza rutas con «..» o separadores escapados', () => {
    expect(esFotoDescargable(`${BASE}/uploads/../secreto.jpg`, BASE)).toBe(false);
    expect(esFotoDescargable(`${BASE}/uploads/%2e%2e/secreto.jpg`, BASE)).toBe(false);
    expect(esFotoDescargable(`${BASE}/uploads/images%5c..%5cx.jpg`, BASE)).toBe(false);
  });

  test('rechaza rutas fuera de /uploads/ y valores que no son texto', () => {
    expect(esFotoDescargable(`${BASE}/otra/foto.jpg`, BASE)).toBe(false);
    expect(esFotoDescargable('/uploads/images/foto.jpg', BASE)).toBe(false);
    expect(esFotoDescargable(null, BASE)).toBe(false);
    expect(esFotoDescargable(undefined, BASE)).toBe(false);
  });
});

describe('esRutaPrivada', () => {
  test('detecta /uploads/pruebas con distintos finales', () => {
    expect(esRutaPrivada('/uploads/pruebas')).toBe(true);
    expect(esRutaPrivada('/uploads/pruebas/a.jpg')).toBe(true);
    expect(esRutaPrivada('/uploads/pruebas?x=1')).toBe(true);
  });

  test('no confunde otras carpetas con prefijo parecido', () => {
    expect(esRutaPrivada('/uploads/pruebas-publicas/a.jpg')).toBe(false);
    expect(esRutaPrivada('/uploads/images/a.jpg')).toBe(false);
  });
});

describe('fotosDescargables', () => {
  test('filtra las no descargables, quita repetidas y respeta el máximo', () => {
    const urls = [
      `${BASE}/uploads/images/1.jpg`,
      `${BASE}/uploads/images/1.jpg`,
      `${BASE}/uploads/pruebas/2.jpg`,
      `${BASE}/uploads/images/3.jpg`,
      `${BASE}/uploads/images/4.jpg`,
    ];

    expect(fotosDescargables(urls, BASE)).toEqual([
      `${BASE}/uploads/images/1.jpg`,
      `${BASE}/uploads/images/3.jpg`,
      `${BASE}/uploads/images/4.jpg`,
    ]);
    expect(fotosDescargables(urls, BASE, 2)).toHaveLength(2);
  });

  test('con algo que no es una lista devuelve una lista vacía', () => {
    expect(fotosDescargables(undefined, BASE)).toEqual([]);
  });
});

describe('aplicarFotosLocales', () => {
  const remota1 = `${BASE}/uploads/images/1.jpg`;
  const remota2 = `${BASE}/uploads/images/2.jpg`;

  test('reemplaza por la copia local solo las que existen', () => {
    const locales = { [remota1]: 'file:///a/1.jpg', [remota2]: 'file:///a/2.jpg' };
    const existe = (uri) => uri === 'file:///a/1.jpg';

    expect(aplicarFotosLocales([remota1, remota2], locales, existe)).toEqual([
      'file:///a/1.jpg',
      remota2,
    ]);
  });

  test('si no hay mapa de copias locales deja las URLs como están', () => {
    expect(aplicarFotosLocales([remota1], undefined, () => true)).toEqual([remota1]);
  });

  test('si las fotos no son una lista devuelve una lista vacía', () => {
    expect(aplicarFotosLocales(undefined, {}, () => true)).toEqual([]);
  });
});

describe('conservarLocales', () => {
  test('descarta las copias de fotos que la publicación ya no usa', () => {
    const locales = { a: 'file:///1', b: 'file:///2' };
    expect(conservarLocales(locales, ['b'])).toEqual({ b: 'file:///2' });
  });

  test('con datos inválidos devuelve un mapa vacío', () => {
    expect(conservarLocales(undefined, ['a'])).toEqual({});
    expect(conservarLocales({ a: 'x' }, undefined)).toEqual({});
  });
});

describe('nombreArchivoLocal', () => {
  test('es determinístico: la misma URL da siempre el mismo nombre', () => {
    const url = `${BASE}/uploads/images/foto.png`;
    expect(nombreArchivoLocal(url)).toBe(nombreArchivoLocal(url));
  });

  test('URLs distintas dan nombres distintos', () => {
    expect(nombreArchivoLocal(`${BASE}/uploads/images/1.jpg`)).not.toBe(
      nombreArchivoLocal(`${BASE}/uploads/images/2.jpg`)
    );
  });

  test('conserva la extensión de la imagen y usa jpg si no se reconoce', () => {
    expect(nombreArchivoLocal(`${BASE}/uploads/images/a.png`)).toMatch(/^[0-9a-f]{16}\.png$/);
    expect(nombreArchivoLocal(`${BASE}/uploads/images/a.JPEG`)).toMatch(/\.jpg$/);
    expect(nombreArchivoLocal(`${BASE}/uploads/images/sin-extension`)).toMatch(/\.jpg$/);
  });

  test('el nombre nunca contiene separadores de ruta', () => {
    expect(nombreArchivoLocal(`${BASE}/uploads/../../etc/passwd`)).not.toMatch(/[\\/]/);
  });
});

describe('extensionDeUri y segmentoSeguro', () => {
  test('extensionDeUri ignora la query y normaliza jpeg', () => {
    expect(extensionDeUri('file:///a/b.webp?x=1')).toBe('webp');
    expect(extensionDeUri('file:///a/b.jpeg')).toBe('jpg');
  });

  test('segmentoSeguro reemplaza todo lo que no sea letra, número, _ o -', () => {
    expect(segmentoSeguro('../a b/c')).toBe('___a_b_c');
    expect(segmentoSeguro('usuario-1_ok')).toBe('usuario-1_ok');
    expect(segmentoSeguro('')).toBe('_');
  });
});
