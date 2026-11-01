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
import {
  borrarToken,
  guardarPerfilMinimo,
  guardarToken,
  leerPerfilMinimo,
  leerToken,
} from '../services/sesion';
import {
  esErrorDeConectividad,
  reportarFalloConexion,
  suscribirConexion,
  verificarConexion,
} from '../services/conexion';
import {
  descartarCacheLegada,
  setUsuarioCache,
} from '../services/cacheOffline';
import { desactivarBiometria } from './useConfiguracion';

export const SEGUNDOS_REENVIO = 30;

// Espera máxima de GET /me al restaurar la sesión: sin red conviene decidir rápido
const TIMEOUT_RESTAURAR_MS = 6000;

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
  // true cuando la sesión se restauró sin conexión con el perfil guardado, sin validar el token
  const [sesionOffline, setSesionOffline] = useState(false);
  const invalidarSesionRef = useRef(null);

  useEffect(() => {
  let activo = true;

  async function invalidarSesion() {
    if (!activo) return;

    configurarToken(null);
    setUsuarioCache(null);
    setUsuario(null);
    setSesionOffline(false);
    setCodigoPendiente(null);
    setError('Tu sesión venció o dejó de ser válida. Volvé a ingresar.');

    desactivarBiometria().catch(() => {});

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

  invalidarSesionRef.current = invalidarSesion;
  const quitarInterceptors = setupInterceptors(invalidarSesion);

  return () => {
    activo = false;
    invalidarSesionRef.current = null;
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

        let data;
        try {
          ({ data } = await api.get('/me', {
            headers: { Authorization: `Bearer ${token}` },
            timeout: TIMEOUT_RESTAURAR_MS,
          }));
        } catch (e) {
          if (!activo) return;

          // Sin conectividad el token no se descarta: se usa el perfil mínimo del último
          // inicio exitoso para poder leer la caché y se revalida al volver la red.
          // Un error HTTP (p. ej. 401) sigue el camino de siempre.
          const perfil = esErrorDeConectividad(e) ? await leerPerfilMinimo() : null;
          if (!perfil) throw e;
          if (!activo) return;

          reportarFalloConexion();
          configurarToken(token);
          setUsuarioCache(perfil.id);
          setSesionOffline(true);
          setUsuario(adaptarUsuario(perfil));
          return;
        }

        if (!activo) return;
        configurarToken(token);
        setUsuarioCache(data.id);
        guardarPerfilMinimo(data);
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

  // Con la sesión restaurada sin conexión, al volver la red se valida el token con /me:
  // si sigue vigente se reemplaza el perfil mínimo por el real; si no, se cierra la sesión.
  useEffect(() => {
    if (!sesionOffline) return undefined;

    let activo = true;
    let enCurso = false;

    async function revalidar() {
      if (enCurso) return;
      enCurso = true;

      try {
        const { data } = await api.get('/me');
        if (!activo) return;

        setUsuarioCache(data.id);
        guardarPerfilMinimo(data);
        setUsuario(adaptarUsuario(data));
        setSesionOffline(false);
      } catch (e) {
        if (!activo) return;

        // Un 401 significa que el token ya no vale; cualquier otra falla deja la
        // sesión sin validar hasta el próximo cambio de conectividad
        if (e.response?.status === 401) await invalidarSesionRef.current?.();
        else if (esErrorDeConectividad(e)) reportarFalloConexion();
      } finally {
        enCurso = false;
      }
    }

    const desuscribir = suscribirConexion((disponible) => {
      if (disponible) revalidar();
    });
    // La conexión pudo volver antes de que este efecto se montara
    verificarConexion().then((disponible) => {
      if (disponible && activo) revalidar();
    });

    return () => {
      activo = false;
      desuscribir();
    };
  }, [sesionOffline]);

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
    await guardarPerfilMinimo(data.usuario);
    setCodigoPendiente(null);
    setSesionOffline(false);
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
        setSesionOffline(false);
        setCodigoPendiente(null);
        // Una falla acá no debe impedir borrar el token
        await desactivarBiometria().catch(() => {});
        await borrarToken();
      }

      if (aviso) throw new Error(aviso);
    });
  }

  const value = {
    usuario,
    autenticado: usuario !== null,
    sesionOffline,
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