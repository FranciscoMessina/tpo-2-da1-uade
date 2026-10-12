import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PublicProfileScreen({ usuario }) {
  const fechaIngreso = usuario.memberSince
    ? new Date(usuario.memberSince).toLocaleDateString('es-AR')
    : 'No informada';

  const reputacion = usuario.reputation;
  const insignias = usuario.badges ?? [];

  const totalValoraciones = reputacion
    ? reputacion.positiveReviews + reputacion.negativeReviews
    : 0;

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

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reputación</Text>

        {reputacion ? (
          <>
            <Text style={styles.returnCount}>
              {reputacion.completedReturns}
            </Text>

            <Text style={styles.returnLabel}>
              Devoluciones concretadas
            </Text>

            {totalValoraciones > 0 ? (
              <>
                <View style={styles.reviewRow}>
                  <View style={[styles.reviewBox, styles.positiveBox]}>
                    <Text style={[styles.reviewCount, styles.positiveText]}>
                      {reputacion.positiveReviews}
                    </Text>

                    <Text style={styles.positiveText}>Positivas</Text>
                  </View>

                  <View style={[styles.reviewBox, styles.negativeBox]}>
                    <Text style={[styles.reviewCount, styles.negativeText]}>
                      {reputacion.negativeReviews}
                    </Text>

                    <Text style={styles.negativeText}>Negativas</Text>
                  </View>
                </View>

                <Text style={styles.summary}>
                  Total de valoraciones: {totalValoraciones}
                </Text>
              </>
            ) : (
              <Text style={styles.emptyText}>Sin valoraciones todavía.</Text>
            )}
          </>
        ) : (
          <Text style={styles.emptyText}>Reputación no disponible.</Text>
        )}
      </View>

      <View style={styles.card}>
  <Text style={styles.sectionTitle}>Insignias</Text>

  {insignias.length > 0 ? (
    insignias.map((insignia) => (
      <View key={insignia.id} style={styles.badge}>
        <Text style={styles.badgeIcon}>🏅</Text>
        <Text style={styles.badgeName}>{insignia.name}</Text>
        <Text style={styles.badgeDescription}>
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
    marginBottom: 16,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  returnCount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1D4ED8',
    textAlign: 'center',
  },
  returnLabel: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  reviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  reviewBox: {
    flex: 1,
    minWidth: 100,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  positiveBox: {
    backgroundColor: '#DCFCE7',
  },
  negativeBox: {
    backgroundColor: '#FEE2E2',
  },
  reviewCount: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  positiveText: {
    color: '#166534',
  },
  negativeText: {
    color: '#991B1B',
  },
  summary: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
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
badgeIcon: {
  fontSize: 32,
  marginBottom: 8,
},
badgeName: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#92400E',
  textAlign: 'center',
},
badgeDescription: {
  fontSize: 14,
  color: '#78350F',
  textAlign: 'center',
  marginTop: 6,
},
});