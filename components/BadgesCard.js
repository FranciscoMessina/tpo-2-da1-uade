import { StyleSheet, Text, View } from 'react-native';

export default function BadgesCard({ insignias = [] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Insignias</Text>

      {insignias.length > 0 ? (
        insignias.map((insignia) => (
          <View key={insignia.id} style={styles.badge}>
            <Text style={styles.icon}>🏅</Text>

            <Text style={styles.name}>{insignia.name}</Text>

            <Text style={styles.description}>
              {insignia.description}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>
          Todavía no tiene insignias.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  badge: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400E',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#78350F',
    textAlign: 'center',
    marginTop: 6,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});