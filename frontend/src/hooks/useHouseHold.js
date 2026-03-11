import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createHousehold as sharedCreateHousehold,
  createHouseholdInvite as sharedCreateHouseholdInvite,
  fetchHouseholds,
  flattenHouseholdMembers,
  leaveHousehold as sharedLeaveHousehold,
  removeHouseholdMember as sharedRemoveHouseholdMember,
  transferHouseholdOwnership as sharedTransferHouseholdOwnership,
  updateHouseholdMemberRole as sharedUpdateHouseholdMemberRole,
} from "../../../shared/index.js";
import { apiClient } from "@/lib/utils";
import { getUserFromLocalStorage } from "@/lib/auth";

const LS_HOUSEHOLDS_KEY = "households";
let householdsCache = null;
let householdsPromise = null;
let hasFetchedHouseholds = false;
let householdsCacheUser = null;

function getCacheUserKey() {
  const user = getUserFromLocalStorage();
  return user?.username || null;
}

function syncHouseholdCacheWithAuth() {
  const currentUser = getCacheUserKey();
  if (currentUser === householdsCacheUser) return;

  householdsCache = null;
  householdsPromise = null;
  hasFetchedHouseholds = false;
  householdsCacheUser = currentUser;

  if (typeof window !== "undefined") {
    localStorage.removeItem(LS_HOUSEHOLDS_KEY);
    localStorage.removeItem("household");
  }
}

function readHouseholdsFromStorage() {
  syncHouseholdCacheWithAuth();

  if (!householdsCacheUser) {
    return [];
  }

  try {
    const raw = localStorage.getItem(LS_HOUSEHOLDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function fetchHouseholdsShared(force = false) {
  syncHouseholdCacheWithAuth();

  if (!householdsCacheUser) {
    return [];
  }

  if (!force && hasFetchedHouseholds && Array.isArray(householdsCache)) {
    return householdsCache;
  }

  if (householdsPromise) {
    return householdsPromise;
  }

  householdsPromise = (async () => {
    const data = await fetchHouseholds(apiClient);
    const list = Array.isArray(data?.households) ? data.households : [];
    householdsCache = list;
    hasFetchedHouseholds = true;
    householdsCacheUser = getCacheUserKey();
    localStorage.setItem(LS_HOUSEHOLDS_KEY, JSON.stringify(list));
    return list;
  })().finally(() => {
    householdsPromise = null;
  });

  return householdsPromise;
}

export function useHousehold() {
  const [households, setHouseholdsState] = useState(() => {
    syncHouseholdCacheWithAuth();

    if (Array.isArray(householdsCache)) return householdsCache;
    const stored = readHouseholdsFromStorage();
    householdsCache = stored;
    return stored;
  });

  const [loading, setLoading] = useState(households.length === 0);
  const [error, setError] = useState(null);

  const setHouseholds = useCallback((nextHouseholds) => {
    setHouseholdsState((previous) => {
      const resolved =
        typeof nextHouseholds === "function" ? nextHouseholds(previous) : nextHouseholds;
      const normalized = Array.isArray(resolved) ? resolved : [];
      householdsCache = normalized;
      hasFetchedHouseholds = true;
      householdsCacheUser = getCacheUserKey();
      localStorage.setItem(LS_HOUSEHOLDS_KEY, JSON.stringify(normalized));
      return normalized;
    });
  }, []);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    try {
      const list = await fetchHouseholdsShared(force);
      setHouseholds(list);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [setHouseholds]);

  useEffect(() => {
    void load(false);
  }, [load]);

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
    refetch: () => load(true),
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
