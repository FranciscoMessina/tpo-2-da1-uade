import { isAxiosError } from 'axios';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { api, mensajeErrorApi, setupInterceptors } from '../services/api';
import { borrarToken, guardarToken, leerToken } from '../services/sesion';
import {
  descartarCacheLegada,
  setUsuarioCache,
} from '../services/cacheOffline';

export const SEGUNDOS_REENVIO = 30;

export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim());
}

export function validarContraseña(contraseña) {
  if (!contraseña || contraseña.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (contraseña.length > 72) {
    return 'La contraseña no puede superar los 72 caracteres.';
  }
  if (!/[A-Za-z]/.test(contraseña) || !/\d/.test(contraseña)) {
    return 'La contraseña debe incluir letras y números.';
  }
  return '';
}

function normalizar(email) {
  if (!emailValido(email)) throw new Error('Ingresá un email válido.');
  return email.trim().toLowerCase();
}

function mensajeError(error) {
  return isAxiosError(error)
    ? mensajeErrorApi(error)
    : error.message || 'Ocurrió un error. Intentá nuevamente.';
}

function adaptarUsuario(usuario) {
  return { ...usuario, nombre: usuario.name };
}

function configurarToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const ocupado = useRef(true);
  const [codigoPendiente, setCodigoPendiente] = useState(null);

  useEffect(() => {
  let activo = true;

  async function invalidarSesion() {
    if (!activo) return;

    configurarToken(null);
    setUsuarioCache(null);
    setUsuario(null);
    setCodigoPendiente(null);
    setError('Tu sesión venció o dejó de ser válida. Volvé a ingresar.');

    try {
      await borrarToken();
    } catch {
      if (activo) {
        setError(
          'La sesión ya no es válida y no pudimos borrar el token guardado.'
        );
      }
    }
  }

  const quitarInterceptors = setupInterceptors(invalidarSesion);

  return () => {
    activo = false;
    quitarInterceptors();
  };
}, []);

  useEffect(() => {
    let activo = true;

    async function restaurarSesion() {
      // Descarta la caché global de versiones anteriores (no pertenece a ninguna cuenta)
      descartarCacheLegada();

      try {
        const token = await leerToken();
        if (!activo || !token) return;

        const { data } = await api.get('/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!activo) return;
        configurarToken(token);
        setUsuarioCache(data.id);
        setUsuario(adaptarUsuario(data));
      } catch (e) {
        if (!activo) return;

        if (e.response?.status === 401) {
          await borrarToken();
        } else {
          setError(mensajeError(e));
        }
      } finally {
        if (activo) {
          ocupado.current = false;
          setLoading(false);
        }
      }
    }

    restaurarSesion().catch((e) => {
      if (activo) setError(mensajeError(e));
    });

    return () => {
      activo = false;
    };
  }, []);

  const ejecutar = useCallback(async (accion) => {
    if (ocupado.current) return false;

    ocupado.current = true;
    setLoading(true);
    setError('');

    try {
      await accion();
      return true;
    } catch (e) {
      setError(mensajeError(e));
      return false;
    } finally {
      ocupado.current = false;
      setLoading(false);
    }
  }, []);

  const limpiarError = useCallback(() => setError(''), []);

  async function aceptarSesion(data) {
    await guardarToken(data.session.token);
    configurarToken(data.session.token);
    setUsuarioCache(data.usuario.id);
    setCodigoPendiente(null);
    setUsuario(adaptarUsuario(data.usuario));
  }

  function datosCodigo(email, codigo, proposito) {
    const direccion = normalizar(email);
    const pendiente = codigoPendiente;

    if (
      !pendiente ||
      pendiente.email !== direccion ||
      (proposito && pendiente.purpose !== proposito)
    ) {
      throw new Error('Volvé al primer paso y solicitá un código.');
    }

    if (codigo !== undefined && !/^\d{6}$/.test(codigo)) {
      throw new Error('El código debe tener 6 dígitos.');
    }

    return {
      email: direccion,
      purpose: pendiente.purpose,
      code: codigo,
    };
  }

  function iniciarSesion(email, contraseña) {
    return ejecutar(async () => {
      const direccion = normalizar(email);
      if (!contraseña) throw new Error('Ingresá tu contraseña.');

      const { data } = await api.post('/auth/login/password', {
        email: direccion,
        password: contraseña,
      });

      await aceptarSesion(data);
    });
  }

  function solicitarCodigo(email, purpose) {
    return ejecutar(async () => {
      const solicitud = { email: normalizar(email), purpose };
      await api.post('/auth/otp/request', solicitud);
      setCodigoPendiente(solicitud);
    });
  }

  function solicitarCodigoRegistro(email) {
    return solicitarCodigo(email, 'registration');
  }

  function solicitarRecupero(email) {
    return solicitarCodigo(email, 'set_password');
  }

  function verificarCodigo(email, codigo) {
    return ejecutar(async () => {
      await api.post('/auth/otp/check', datosCodigo(email, codigo));
    });
  }

  function reenviarCodigo(email) {
    return ejecutar(async () => {
      const { email: direccion, purpose } = datosCodigo(email);
      await api.post('/auth/otp/resend', {
        email: direccion,
        purpose,
      });
    });
  }

  function registrar(email, codigo, contraseña) {
    return ejecutar(async () => {
      const mensaje = validarContraseña(contraseña);
      if (mensaje) throw new Error(mensaje);

      const { data } = await api.post('/auth/otp/verify', {
        ...datosCodigo(email, codigo, 'registration'),
        password: contraseña,
      });

      await aceptarSesion(data);
    });
  }

  function restablecerContraseña(email, codigo, contraseña) {
    return ejecutar(async () => {
      const mensaje = validarContraseña(contraseña);
      if (mensaje) throw new Error(mensaje);

      await api.post('/auth/otp/verify', {
        ...datosCodigo(email, codigo, 'set_password'),
        password: contraseña,
      });

      setCodigoPendiente(null);
    });
  }

  function cerrarSesion() {
    return ejecutar(async () => {
      let aviso = '';

      try {
        await api.post('/auth/logout');
      } catch (e) {
        if (e.response?.status !== 401) {
          aviso =
            'Se cerró la sesión en este dispositivo, pero no pudimos revocarla en el servidor.';
        }
      } finally {
        configurarToken(null);
        // Borra la caché local de la cuenta que sale (publicaciones, resultados y reclamos)
        await setUsuarioCache(null);
        setUsuario(null);
        setCodigoPendiente(null);
        await borrarToken();
      }

      if (aviso) throw new Error(aviso);
    });
  }

  const value = {
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}