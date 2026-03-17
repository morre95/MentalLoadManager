export function normalizeHousehold(household) {
  return {
    household_id: household.household_id,
    name: household.name ?? household.household_name ?? "Household",
    members: (household.members || []).map((member) => ({
      user_id: member.user_id ?? member.id,
      username: member.username ?? "",
      email: member.email ?? null,
      display_name: member.display_name ?? member.displayName ?? null,
      role: member.role ?? "member",
    })),
  };
}

export function flattenHouseholdMembers(households) {
  return (households || []).flatMap((household) =>
    (household.members || []).map((member) => ({
      ...member,
      household_id: household.household_id,
      household_name: household.name,
    })),
  );
}

export async function fetchHouseholds(apiClient) {
  const data = await apiClient.request("/api/v1/household", { method: "GET" });
  const households = Array.isArray(data?.households)
    ? data.households.map(normalizeHousehold)
    : [];

  return {
    ...data,
    households,
  };
}

export async function createHousehold(apiClient, name) {
  return apiClient.request("/api/v1/household", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateHousehold(apiClient, householdId, name) {
  return apiClient.request("/api/v1/household", {
    method: "PUT",
    body: JSON.stringify({ household_id: householdId, name }),
  });
}

export async function createHouseholdInvite(apiClient, householdId) {
  return apiClient.request("/api/v1/household/invite", {
    method: "POST",
    body: JSON.stringify({ household_id: householdId }),
  });
}

export async function emailHouseholdInvite(apiClient, householdId, email) {
  return apiClient.request("/api/v1/household/invite/email", {
    method: "POST",
    body: JSON.stringify({ household_id: householdId, email }),
  });
}

export async function acceptHouseholdInvite(apiClient, code) {
  return apiClient.request("/api/v1/household/invite/accept", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function removeHouseholdMember(apiClient, householdId, userId) {
  return apiClient.request("/api/v1/household/members", {
    method: "DELETE",
    body: JSON.stringify({ household_id: householdId, user_id: userId }),
  });
}

export async function leaveHousehold(apiClient, householdId) {
  return apiClient.request("/api/v1/household/leave", {
    method: "POST",
    body: JSON.stringify({ household_id: householdId }),
  });
}

export async function updateHouseholdMemberRole(
  apiClient,
  householdId,
  userId,
  role,
) {
  return apiClient.request("/api/v1/household/members/role", {
    method: "PUT",
    body: JSON.stringify({ household_id: householdId, user_id: userId, role }),
  });
}

export async function transferHouseholdOwnership(
  apiClient,
  householdId,
  newOwnerUserId,
) {
  return apiClient.request("/api/v1/household/transfer-ownership", {
    method: "POST",
    body: JSON.stringify({
      household_id: householdId,
      new_owner_user_id: newOwnerUserId,
    }),
  });
}
