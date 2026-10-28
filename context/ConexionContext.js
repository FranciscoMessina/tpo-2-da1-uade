import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { verificarConexion } from '../services/conexion';

const ConexionContext = createContext({
  hayConexion: true,
  comprobarConexion: async () => true,
});

export function ConexionProvider({ children }) {
  const [hayConexion, setHayConexion] = useState(true);

  const comprobar = useCallback(async () => {
    const conectado = await verificarConexion();
    setHayConexion(conectado);
    return conectado;
  }, []);

  useEffect(() => {
    comprobar();
    // Verificación periódica cada 2.5 segundos para reflejar Modo Avión inmediatamente
    const intervalo = setInterval(comprobar, 2500);
    return () => clearInterval(intervalo);
  }, [comprobar]);

  return (
    <ConexionContext.Provider
      value={{
        hayConexion,
        comprobarConexion: comprobar,
      }}
    >
      {children}
    </ConexionContext.Provider>
  );
}

export function useConexion() {
  const contexto = useContext(ConexionContext);
  if (!contexto) {
    return { hayConexion: true, comprobarConexion: async () => true };
  }
  return contexto;
}
