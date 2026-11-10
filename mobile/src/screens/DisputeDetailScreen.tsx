import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation';

type Props = StackScreenProps<RootStackParamList, 'DisputeDetail'>;

export default function DisputeDetailScreen({ navigation, route }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dispute</Text>
      <Text style={styles.label}>Dispute ID</Text>
      <Text selectable style={styles.id}>{route.params.id}</Text>
      <Text style={styles.description}>
        Review the dispute details with your trade counterparty or support team.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Go back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    marginBottom: 24,
    color: '#1f2937',
    fontSize: 24,
    fontWeight: '700',
  },
  label: {
    marginBottom: 8,
    color: '#6b7280',
    fontSize: 14,
  },
  id: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    marginTop: 16,
    color: '#4b5563',
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: 24,
    borderRadius: 8,
    backgroundColor: '#2d6a2d',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
