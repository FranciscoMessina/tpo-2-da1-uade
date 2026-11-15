import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  CLAVE_STORAGE_NOTIFICADOS,
  configurarCanalNotificaciones,
  configurarOyenteRespuestaNotificaciones,
  ejecutarNavegacionPendiente,
  emitirNotificacionNativa,
  esEventoPushRelevante,
  limpiarNotificacionPendiente,
  navegarADestino,
  obtenerNotificacionPendiente,
  obtenerYRegistrarTokenPush,
  setRefNavegacion,
  simularNotificacionNativa,
  sincronizarAvisosNativos,
} from '../../services/notificacionesPush';
import { api } from '../../services/api';

jest.mock('../../services/api', () => ({
  api: {
    post: jest.fn().mockResolvedValue({ data: { ok: true } }),
  },
}));

describe('notificacionesPush service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    limpiarNotificacionPendiente();
    await AsyncStorage.clear();
  });

  describe('esEventoPushRelevante', () => {
    test('identifica eventos de reclamo y encuentro según Punto 12', () => {
      expect(esEventoPushRelevante({ tipo: 'reclamo' })).toBe(true);
      expect(esEventoPushRelevante({ tipo: 'encuentro' })).toBe(true);
      expect(esEventoPushRelevante({ tipo: 'coincidencia' })).toBe(false);
      expect(esEventoPushRelevante({ tipo: 'publicacion' })).toBe(false);
      expect(esEventoPushRelevante(null)).toBe(false);
      expect(esEventoPushRelevante(undefined)).toBe(false);
    });
  });

  describe('navegarADestino', () => {
    test('lleva a MisReclamos cuando la notificación es de reclamo o encuentro', () => {
      const mockNav = { navigate: jest.fn(), isReady: jest.fn().mockReturnValue(true) };
      navegarADestino(mockNav, { tipo: 'reclamo', claimId: 'rec-123' });
      expect(mockNav.navigate).toHaveBeenCalledWith('Principal', {
        screen: 'MisReclamos',
        params: { reclamoId: 'rec-123' },
      });

      mockNav.navigate.mockClear();
      navegarADestino(mockNav, { tipo: 'encuentro', reclamoId: 'enc-456' });
      expect(mockNav.navigate).toHaveBeenCalledWith('Principal', {
        screen: 'MisReclamos',
        params: { reclamoId: 'enc-456' },
      });
    });

    test('lleva al historial cuando es de valoración', () => {
      const mockNav = { navigate: jest.fn(), isReady: jest.fn().mockReturnValue(true) };
      navegarADestino(mockNav, { tipo: 'valoracion' });
      expect(mockNav.navigate).toHaveBeenCalledWith('Historial');
    });

    test('lleva al detalle de publicación si tiene publicationId', () => {
      const mockNav = { navigate: jest.fn(), isReady: jest.fn().mockReturnValue(true) };
      navegarADestino(mockNav, { tipo: 'otra', publicationId: 'pub-999' });
      expect(mockNav.navigate).toHaveBeenCalledWith('DetallePublicacion', {
        publicacionId: 'pub-999',
      });
    });

    test('lleva a la bandeja de notificaciones por defecto', () => {
      const mockNav = { navigate: jest.fn(), isReady: jest.fn().mockReturnValue(true) };
      navegarADestino(mockNav, {});
      expect(mockNav.navigate).toHaveBeenCalledWith('Notificaciones');
    });
  });

  describe('bloqueo biométrico y navegación diferida', () => {
    test('si la sesión está bloqueada, retiene la navegación hasta el desbloqueo', () => {
      const mockNav = { navigate: jest.fn(), isReady: jest.fn().mockReturnValue(true) };
      setRefNavegacion(mockNav);

      let bloqueado = true;
      const desuscribir = configurarOyenteRespuestaNotificaciones(mockNav, () => bloqueado);

      // Simular llegada de respuesta de notificación (toque de usuario)
      const listeners = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls;
      const ultimoHandler = listeners[listeners.length - 1][0];

      ultimoHandler({
        notification: {
          request: {
            content: {
              data: { tipo: 'reclamo', claimId: 'rec-retenido' },
            },
          },
        },
      });

      // No debe haber navegado porque la sesión estaba bloqueada
      expect(mockNav.navigate).not.toHaveBeenCalled();
      expect(obtenerNotificacionPendiente()).toEqual({
        tipo: 'reclamo',
        claimId: 'rec-retenido',
      });

      // Se desbloquea la sesión y se ejecuta la navegación pendiente
      bloqueado = false;
      const ejecutado = ejecutarNavegacionPendiente(mockNav);
      expect(ejecutado).toBe(true);
      expect(mockNav.navigate).toHaveBeenCalledWith('Principal', {
        screen: 'MisReclamos',
        params: { reclamoId: 'rec-retenido' },
      });
      expect(obtenerNotificacionPendiente()).toBeNull();

      desuscribir();
    });

    test('si la sesión NO está bloqueada, navega inmediatamente al tocar la notificación', () => {
      const mockNav = { navigate: jest.fn(), isReady: jest.fn().mockReturnValue(true) };
      const desuscribir = configurarOyenteRespuestaNotificaciones(mockNav, () => false);

      const listeners = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls;
      const ultimoHandler = listeners[listeners.length - 1][0];

      ultimoHandler({
        notification: {
          request: {
            content: {
              data: { tipo: 'encuentro', claimId: 'enc-inmediato' },
            },
          },
        },
      });

      expect(mockNav.navigate).toHaveBeenCalledWith('Principal', {
        screen: 'MisReclamos',
        params: { reclamoId: 'enc-inmediato' },
      });

      desuscribir();
    });

    test('si el navegador no contiene Principal (ej. pantalla Login), retiene la navegación hasta que se inicie sesión', () => {
      // Mock de navegador que solo contiene rutas de login
      const mockNavLogin = {
        navigate: jest.fn(),
        isReady: jest.fn().mockReturnValue(true),
        getRootState: jest.fn().mockReturnValue({ routeNames: ['Login', 'Registro', 'RecuperarContraseña'] }),
      };

      const desuscribir = configurarOyenteRespuestaNotificaciones(mockNavLogin, () => false);

      const listeners = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls;
      const ultimoHandler = listeners[listeners.length - 1][0];

      ultimoHandler({
        notification: {
          request: {
            content: {
              data: { tipo: 'reclamo', claimId: 'rec-desde-login' },
            },
          },
        },
      });

      // No debe navegar a Principal en el stack de Login
      expect(mockNavLogin.navigate).not.toHaveBeenCalled();
      expect(obtenerNotificacionPendiente()).toEqual({
        tipo: 'reclamo',
        claimId: 'rec-desde-login',
      });

      // Al cambiar a un stack autenticado con Principal disponible
      const mockNavAutenticado = {
        navigate: jest.fn(),
        isReady: jest.fn().mockReturnValue(true),
        getRootState: jest.fn().mockReturnValue({ routeNames: ['Principal', 'Configuracion'] }),
      };

      const ejecutado = ejecutarNavegacionPendiente(mockNavAutenticado);
      expect(ejecutado).toBe(true);
      expect(mockNavAutenticado.navigate).toHaveBeenCalledWith('Principal', {
        screen: 'MisReclamos',
        params: { reclamoId: 'rec-desde-login' },
      });

      desuscribir();
    });
  });

  describe('sincronizarAvisosNativos', () => {
    test('emite notificaciones del sistema para eventos relevantes y no repite IDs', async () => {
      const items = [
        { id: 'notif-1', tipo: 'reclamo', mensaje: 'Nuevo reclamo en tu publicación', leidaEn: null },
        { id: 'notif-2', tipo: 'coincidencia', mensaje: 'Nueva coincidencia', leidaEn: null },
        { id: 'notif-3', tipo: 'encuentro', mensaje: 'Punto de encuentro propuesto', leidaEn: null },
        { id: 'notif-4', tipo: 'reclamo', mensaje: 'Reclamo ya leído', leidaEn: '2026-11-15T12:00:00Z' },
      ];

      await sincronizarAvisosNativos(items);

      // Solo notif-1 y notif-3 deben emitirse (son reclamo/encuentro y sin leer)
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);

      // Segunda sincronización con los mismos ítems no debe volver a emitir
      jest.mocked(Notifications.scheduleNotificationAsync).mockClear();
      await sincronizarAvisosNativos(items);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('obtenerYRegistrarTokenPush', () => {
    test('solicita permisos y envía el token push al backend cuando hay permiso', async () => {
      jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'granted' });
      jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ data: 'ExponentPushToken[abc123xyz]' });

      const token = await obtenerYRegistrarTokenPush();

      expect(token).toBe('ExponentPushToken[abc123xyz]');
      expect(api.post).toHaveBeenCalledWith('/me/push-token', {
        token: 'ExponentPushToken[abc123xyz]',
      });
    });
  });
});

