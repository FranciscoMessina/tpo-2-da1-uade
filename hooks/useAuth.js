import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// MOCK: no hay backend. Cada función async de abajo simula una llamada de red.
// Para conectar el backend real, reemplazá el cuerpo de cada función
// (marcadas con "REEMPLAZAR POR FETCH") manteniendo la misma firma y el mismo
// manejo de loading/error. Las pantallas no necesitan cambios.
// ---------------------------------------------------------------------------

export const CODIGO_VALIDO = '123456'; // código mock válido
export const CODIGO_EXPIRADO = '000000'; // código mock que simula expiración
export const SEGUNDOS_REENVIO = 30; // espera entre reenvíos
const VIGENCIA_CODIGO_MS = 2 * 60 * 1000; // expiración simulada del código

const usuariosMock = [
  {
    email: 'demo@hallado.com',
    contraseña: 'Hallado123',
    nombre: 'Usuario de prueba',
  },
];
const codigosEmitidos = {}; // email -> timestamp de emisión

const esperar = (ms = 700) => new Promise((r) => setTimeout(r, ms));

export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim());
}

// Devuelve un mensaje de error o '' si la contraseña es válida.
export function validarContraseña(contraseña) {
  if (!contraseña || contraseña.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[A-Za-z]/.test(contraseña) || !/\d/.test(contraseña)) {
    return 'La contraseña debe incluir letras y números.';
  }
  return '';
}

function normalizar(email) {
  return email.trim().toLowerCase();
}

function emitirCodigo(email) {
  codigosEmitidos[normalizar(email)] = Date.now();
}

function comprobarCodigo(email, codigo) {
  if (codigo === CODIGO_EXPIRADO) {
    throw new Error('El código expiró. Pedí uno nuevo.');
  }
  const emitido = codigosEmitidos[normalizar(email)];
  if (emitido && Date.now() - emitido > VIGENCIA_CODIGO_MS) {
    throw new Error('El código expiró. Pedí uno nuevo.');
  }
  if (codigo !== CODIGO_VALIDO) {
    throw new Error('El código es incorrecto.');
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Ejecuta una acción mock: maneja loading/error y devuelve true/false.
  const ejecutar = useCallback(async (accion) => {
    setLoading(true);
    setError('');
    try {
      await esperar();
      await accion();
      return true;
    } catch (e) {
      setError(e.message || 'Ocurrió un error. Intentá nuevamente.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const limpiarError = useCallback(() => setError(''), []);

  const iniciarSesion = useCallback(
    (email, contraseña) =>
      ejecutar(async () => {
        // REEMPLAZAR POR FETCH: POST /auth/login
        if (!emailValido(email)) throw new Error('Ingresá un email válido.');
        if (!contraseña) throw new Error('Ingresá tu contraseña.');
        const u = usuariosMock.find(
          (x) => x.email === normalizar(email) && x.contraseña === contraseña
        );
        if (!u) throw new Error('Email o contraseña incorrectos.');
        setUsuario({ email: u.email, nombre: u.nombre });
      }),
    [ejecutar]
  );

  const solicitarCodigoRegistro = useCallback(
    (email) =>
      ejecutar(async () => {
        // REEMPLAZAR POR FETCH: POST /auth/registro/codigo
        if (!emailValido(email)) throw new Error('Ingresá un email válido.');
        if (usuariosMock.some((x) => x.email === normalizar(email))) {
          throw new Error('Ya existe una cuenta con ese email.');
        }
        emitirCodigo(email);
      }),
    [ejecutar]
  );

  const verificarCodigo = useCallback(
    (email, codigo) =>
      ejecutar(async () => {
        // REEMPLAZAR POR FETCH: POST /auth/codigo/verificar
        if (!/^\d{6}$/.test(codigo || '')) {
          throw new Error('El código debe tener 6 dígitos.');
        }
        comprobarCodigo(email, codigo);
      }),
    [ejecutar]
  );

  const registrar = useCallback(
    (email, codigo, contraseña) =>
      ejecutar(async () => {
        // REEMPLAZAR POR FETCH: POST /auth/registro
        comprobarCodigo(email, codigo);
        const msg = validarContraseña(contraseña);
        if (msg) throw new Error(msg);
        const nuevo = {
          email: normalizar(email),
          contraseña,
          nombre: normalizar(email).split('@')[0],
        };
        usuariosMock.push(nuevo);
        delete codigosEmitidos[nuevo.email];
        setUsuario({ email: nuevo.email, nombre: nuevo.nombre });
      }),
    [ejecutar]
  );

  const solicitarRecupero = useCallback(
    (email) =>
      ejecutar(async () => {
        // REEMPLAZAR POR FETCH: POST /auth/recupero
        if (!emailValido(email)) throw new Error('Ingresá un email válido.');
        // Por seguridad no se revela si el email existe o no.
        emitirCodigo(email);
      }),
    [ejecutar]
  );

  const reenviarCodigo = useCallback(
    (email) =>
      ejecutar(async () => {
        // REEMPLAZAR POR FETCH: POST /auth/codigo/reenviar
        if (!emailValido(email)) throw new Error('Ingresá un email válido.');
        emitirCodigo(email);
      }),
    [ejecutar]
  );

  const restablecerContraseña = useCallback(
    (email, codigo, contraseña) =>
      ejecutar(async () => {
        // REEMPLAZAR POR FETCH: POST /auth/recupero/restablecer
        comprobarCodigo(email, codigo);
        const msg = validarContraseña(contraseña);
        if (msg) throw new Error(msg);
        const u = usuariosMock.find((x) => x.email === normalizar(email));
        if (u) u.contraseña = contraseña;
        delete codigosEmitidos[normalizar(email)];
      }),
    [ejecutar]
  );

  const cerrarSesion = useCallback(
    () =>
      ejecutar(async () => {
        // REEMPLAZAR POR FETCH: POST /auth/logout
        setUsuario(null);
      }),
    [ejecutar]
  );

  const value = useMemo(
    () => ({
      usuario,
      autenticado: usuario !== null,
      loading,
      error,
      limpiarError,
      iniciarSesion,
      solicitarCodigoRegistro,
      verificarCodigo,
      registrar,
      solicitarRecupero,
      reenviarCodigo,
      restablecerContraseña,
      cerrarSesion,
    }),
    [
      usuario,
      loading,
      error,
      limpiarError,
      iniciarSesion,
      solicitarCodigoRegistro,
      verificarCodigo,
      registrar,
      solicitarRecupero,
      reenviarCodigo,
      restablecerContraseña,
      cerrarSesion,
    ]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
