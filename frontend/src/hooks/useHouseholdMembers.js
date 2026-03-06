import { useMemo } from "react";
import { flattenHouseholdMembers } from "../../../shared/index.js";
import { useHousehold } from "@/hooks/useHouseHold";

export function useHouseholdMembers() {
  const { households, loading, error } = useHousehold();
  const members = useMemo(
    () => flattenHouseholdMembers(Array.isArray(households) ? households : []),
    [households]
  );

  return { members, loading, error };
}
