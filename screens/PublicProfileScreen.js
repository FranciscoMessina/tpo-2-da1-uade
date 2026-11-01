import { StyleSheet, View } from 'react-native';
import ReputationCard from '../components/ReputationCard';
import BadgesCard from '../components/BadgesCard';
import usePerfilPublico from '../hooks/usePerfilPublico';
import AgradecimientosPublicos from '../components/AgradecimientosPublicos';
import {
  Avatar,
  Cargando,
  ErrorConReintento,
  FilaDato,
  Pantalla,
  Tarjeta,
  Texto,
  espacio,
  estilosPantalla,
} from '../components/ui';

export default function PublicProfileScreen({ usuario: param }) {
  const usuarioId = typeof param === 'string' ? param : param?.id;
  const { usuario, loading, error, recargarPerfil } = usePerfilPublico(usuarioId);

  if (loading) return <Cargando pantalla />;

  if (!usuario) {
    return (
      <View style={estilosPantalla.centrado}>
        <ErrorConReintento
          mensaje={error || 'Usuario no encontrado.'}
          onReintentar={recargarPerfil}
        />
      </View>
    );
  }

  const fechaIngreso = usuario.memberSince
    ? new Date(usuario.memberSince).toLocaleDateString('es-AR')
    : 'No informada';

  return (
    <Pantalla>
      <View style={styles.cabecera}>
        <Avatar uri={usuario.avatarUrl} nombre={usuario.name} />
        <Texto variante="pantalla" centrado>{usuario.name}</Texto>
      </View>

      <Tarjeta>
        <FilaDato etiqueta="Barrio" valor={usuario.zone || 'No informado'} />
        <FilaDato etiqueta="Miembro desde" valor={fechaIngreso} />
      </Tarjeta>

      <ReputationCard reputacion={usuario.reputation} />

      <BadgesCard insignias={usuario.badges ?? []} />

      <AgradecimientosPublicos key={usuario.id} usuarioId={usuario.id} />
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  cabecera: {
    alignItems: 'center',
    gap: espacio.xs,
    paddingVertical: espacio.xs,
  },
});
