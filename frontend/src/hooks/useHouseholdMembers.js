import { useEffect, useMemo, useState } from "react";
import {
  createApiClient,
  fetchHouseholds,
  flattenHouseholdMembers,
} from "../../../shared/index.js";
import { clearAuth, getAccessToken } from "@/lib/utils";

const apiClient = createApiClient({
  getAccessToken,
  onUnauthorized: clearAuth,
  envOptions: {
    locationHref: typeof window !== "undefined" ? window.location?.href : "",
  },
});

export function useHouseholdMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchHouseholds(apiClient);
        if (!alive) return;
        setMembers(flattenHouseholdMembers(data?.households || []));
      } catch (err) {
        if (!alive) return;
        setError(err);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  const normalized = useMemo(() => members ?? [], [members]);

  return { members: normalized, loading, error };
}
