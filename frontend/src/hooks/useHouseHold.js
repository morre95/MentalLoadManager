import { useEffect, useMemo, useState } from "react";
import {
  createHousehold as sharedCreateHousehold,
  createHouseholdInvite as sharedCreateHouseholdInvite,
  createApiClient,
  fetchHouseholds,
  flattenHouseholdMembers,
  leaveHousehold as sharedLeaveHousehold,
  removeHouseholdMember as sharedRemoveHouseholdMember,
  transferHouseholdOwnership as sharedTransferHouseholdOwnership,
  updateHouseholdMemberRole as sharedUpdateHouseholdMemberRole,
} from "../../../shared/index.js";
import { clearAuth, getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/utils";

const LS_HOUSEHOLDS_KEY = "households";

const apiClient = createApiClient({
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
  onUnauthorized: clearAuth,
  envOptions: {
    locationHref: typeof window !== "undefined" ? window.location?.href : "",
  },
});

export function useHousehold() {
  const [households, setHouseholds] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_HOUSEHOLDS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(households.length === 0);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchHouseholds(apiClient);
      const list = Array.isArray(data?.households) ? data.households : [];
      setHouseholds(list);
      localStorage.setItem(LS_HOUSEHOLDS_KEY, JSON.stringify(list));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const normalizedHouseholds = useMemo(() => households || [], [households]);

  const membersFlat = useMemo(
    () => flattenHouseholdMembers(normalizedHouseholds),
    [normalizedHouseholds]
  );

  return {
    households: normalizedHouseholds,
    membersFlat,
    loading,
    error,
    setHouseholds,
    refetch: load,
  };
}

export async function createHouseholdInvite(householdId) {
  return sharedCreateHouseholdInvite(apiClient, householdId);
}

export async function createHousehold(name) {
  return sharedCreateHousehold(apiClient, name);
}

export async function removeHouseholdMember(householdId, userId) {
  return sharedRemoveHouseholdMember(apiClient, householdId, userId);
}

export async function leaveHousehold(householdId) {
  return sharedLeaveHousehold(apiClient, householdId);
}

export async function transferHouseholdOwnership(householdId, newOwnerUserId) {
  return sharedTransferHouseholdOwnership(apiClient, householdId, newOwnerUserId);
}

export async function updateHouseholdMemberRole(householdId, userId, role) {
  return sharedUpdateHouseholdMemberRole(apiClient, householdId, userId, role);
}
