import { useEffect, useMemo, useState } from "react";
import {
  fetchHouseholds,
  flattenHouseholdMembers,
} from "../../../shared/index.js";
import { apiClient } from "@/lib/utils";

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
        if (alive) {
          setMembers(flattenHouseholdMembers(data?.households || []));
        }
      } catch (err) {
        if (alive) {
          setError(err);
        }
      }

      if (alive) {
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
