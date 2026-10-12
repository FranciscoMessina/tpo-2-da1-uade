import { StyleSheet, Text, View } from 'react-native';

export default function ReputationCard({ reputacion }) {
  const totalValoraciones = reputacion
    ? reputacion.positiveReviews + reputacion.negativeReviews
    : 0;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Reputación</Text>

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
            <Text style={styles.emptyText}>
              Sin valoraciones todavía.
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.emptyText}>
          Reputación no disponible.
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
});