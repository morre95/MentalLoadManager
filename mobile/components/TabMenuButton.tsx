import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { clearAccessToken } from '@/lib/auth';

export function TabMenuButton() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const onLogout = useCallback(() => {
    closeMenu();
    clearAccessToken();
    router.replace('/login');
  }, [closeMenu]);

  return (
    <>
      <Pressable hitSlop={10} onPress={() => setIsMenuOpen(true)} style={styles.button}>
        <IconSymbol size={24} name="line.3.horizontal" color="#2b2a28" />
      </Pressable>

      <Modal
        transparent
        animationType="fade"
        visible={isMenuOpen}
        onRequestClose={closeMenu}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeMenu} />
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Menu</Text>
            <Pressable style={styles.menuItem} onPress={onLogout}>
              <Text style={styles.menuItemText}>Log out</Text>
            </Pressable>
            <Pressable style={styles.menuSecondaryItem} onPress={closeMenu}>
              <Text style={styles.menuSecondaryItemText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
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
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(43, 42, 40, 0.12)',
  },
  menuCard: {
    position: 'absolute',
    top: 76,
    right: 16,
    minWidth: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ddd7ca',
    backgroundColor: '#fffdf8',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
  },
  menuTitle: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#6f6a62',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  menuItem: {
    borderRadius: 12,
    backgroundColor: '#f5d9d5',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8f3226',
  },
  menuSecondaryItem: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  menuSecondaryItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6f6a62',
  },
});
