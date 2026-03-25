import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { clearAccessToken } from '@/lib/auth';

export function TabMenuButton() {
  return (
    <Pressable
      hitSlop={10}
      onPress={() => {
        Alert.alert('Menu', 'Choose an action', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log out',
            style: 'destructive',
            onPress: () => {
              clearAccessToken();
              router.replace('/login');
            },
          },
        ]);
      }}
      style={styles.button}
    >
      <IconSymbol size={24} name="line.3.horizontal" color="#2b2a28" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 30,
    right: 16,
    zIndex: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd7ca',
    backgroundColor: 'rgba(255, 253, 248, 0.95)',
    padding: 8,
  },
});
