import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PublicProfileScreen({ usuario }) {
  const fechaIngreso = usuario.memberSince
    ? new Date(usuario.memberSince).toLocaleDateString('es-AR')
    : 'No informada';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >

      <View style={styles.header}>
        <View style={styles.avatar}>
          {usuario.avatarUrl ? (
            <Image
              source={{ uri: usuario.avatarUrl }}
              style={styles.photo}
            />
          ) : (
            <Text style={styles.avatarText}>Sin foto</Text>
          )}
        </View>

        <Text style={styles.name}>{usuario.name}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Barrio</Text>
        <Text style={styles.value}>
          {usuario.zone || 'No informado'}
        </Text>

        <Text style={styles.label}>Miembro desde</Text>
        <Text style={styles.value}>{fechaIngreso}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    color: '#1D4ED8',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    color: '#111827',
    marginBottom: 20,
  },
});