import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createHousehold,
  createHouseholdInvite,
  fetchHouseholds,
  leaveHousehold,
  removeHouseholdMember,
  type Household,
} from '../../../shared/index.js';
import { TabMenuButton } from '@/components/TabMenuButton';
import { mobileApiBaseUrl, mobileApiClient } from '@/lib/api';

const COLORS = {
  bg: '#f7f6f2',
  card: '#ffffff',
  text: '#2b2a28',
  muted: '#78736b',
  border: '#ddd7ca',
  primary: '#64786f',
  terracotta: '#c7674a',
} as const;

export default function HouseholdScreen() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchHouseholds(mobileApiClient);
      setHouseholds(Array.isArray(data?.households) ? data.households : []);
    } catch (err: any) {
      setError(err?.message || 'Could not load households');
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        await load();
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const totalMembers = useMemo(
    () => households.reduce((sum, household) => sum + (household.members?.length || 0), 0),
    [households]
  );

  const onCreateHousehold = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    try {
      await createHousehold(mobileApiClient, trimmed);
      setNewName('');
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Could not create household');
    }
  }, [newName, onRefresh]);

  const onInvite = useCallback(async (householdId: string | number) => {
    try {
      const data = await createHouseholdInvite(mobileApiClient, householdId);
      setError(null);
      if (data?.invite_url) {
        setError(`Invite link: ${data.invite_url}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not create invite');
    }
  }, []);

  const onLeave = useCallback(
    async (householdId: string | number) => {
      try {
        await leaveHousehold(mobileApiClient, householdId);
        await onRefresh();
      } catch (err: any) {
        setError(err?.message || 'Could not leave household');
      }
    },
    [onRefresh]
  );

  const onRemove = useCallback(
    async (householdId: string | number, userId: string | number) => {
      try {
        await removeHouseholdMember(mobileApiClient, householdId, userId);
        await onRefresh();
      } catch (err: any) {
        setError(err?.message || 'Could not remove member');
      }
    },
    [onRefresh]
  );

  return (
    <>
      <TabMenuButton />
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerWrap}>
          <Text style={styles.eyebrow}>Mental Load Manager</Text>
          <Text style={styles.title}>Household</Text>
          <Text style={styles.subtitle}>Backend: {mobileApiBaseUrl}</Text>
          <Text style={styles.subtitle}>
            Households: {households.length} • Members: {totalMembers}
          </Text>
        </View>

      <View style={styles.createCard}>
        <Text style={styles.sectionTitle}>Create Household</Text>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Household name"
          style={styles.input}
        />
        <Pressable style={styles.primaryButton} onPress={onCreateHousehold}>
          <Text style={styles.primaryButtonText}>Create</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {households.map((household) => (
          <View style={styles.householdCard} key={String(household.household_id)}>
            <View style={styles.householdHeader}>
              <View style={styles.householdHeaderContent}>
                <Text style={styles.householdTitle}>{household.name}</Text>
                <Text style={styles.householdSubtitle}>{household.members.length} members</Text>
              </View>
              <View style={styles.headerButtons}>
                <Pressable style={styles.smallButton} onPress={() => onInvite(household.household_id)}>
                  <Text style={styles.smallButtonText}>Invite</Text>
                </Pressable>
                <Pressable style={styles.leaveButton} onPress={() => onLeave(household.household_id)}>
                  <Text style={styles.leaveButtonText}>Leave</Text>
                </Pressable>
              </View>
            </View>

            {household.members.map((member) => (
              <View key={`${household.household_id}:${member.user_id}`} style={styles.memberRow}>
                <View>
                  <Text style={styles.memberName}>{member.display_name || member.username}</Text>
                  <Text style={styles.memberMeta}>{member.username}</Text>
                </View>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => onRemove(household.household_id, member.user_id)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 16
  },
  pageContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  headerWrap: {
    marginBottom: 4,
    gap: 3,
  },
  eyebrow: {
    color: COLORS.primary,
    letterSpacing: 1,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.muted,
  },
  createCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 16,
  },
  input: {
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  loadingWrap: {
    paddingVertical: 22,
  },
  errorText: {
    color: '#8f2b2b',
    fontWeight: '600',
  },
  householdCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
    gap: 10,
  },
  householdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  householdHeaderContent: {
    flex: 1,
    minWidth: 0,
  },
  householdTitle: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 18,
    flexShrink: 1,
  },
  householdSubtitle: {
    color: COLORS.muted,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  smallButton: {
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  leaveButton: {
    borderColor: '#e3b6a9',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#fff5f2',
  },
  leaveButtonText: {
    color: COLORS.terracotta,
    fontWeight: '700',
  },
  memberRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fffcf8',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  memberName: {
    color: COLORS.text,
    fontWeight: '700',
  },
  memberMeta: {
    color: COLORS.muted,
    fontSize: 12,
  },
  removeButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ebc3b8',
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: '#fff4f1',
  },
  removeButtonText: {
    color: COLORS.terracotta,
    fontWeight: '700',
    fontSize: 12,
  },
});
