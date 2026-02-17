import { useSyncExternalStore } from 'react';

type AuthListener = () => void;

let accessToken = (process.env.EXPO_PUBLIC_ACCESS_TOKEN || '').trim();
const listeners = new Set<AuthListener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getAccessToken() {
  return accessToken || null;
}

export function setAccessToken(nextToken: string) {
  accessToken = String(nextToken || '').trim();
  emit();
}

export function clearAccessToken() {
  accessToken = '';
  emit();
}

export function hasAccessToken() {
  return Boolean(accessToken);
}

export function subscribeToAuth(listener: AuthListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuthToken() {
  return useSyncExternalStore(subscribeToAuth, getAccessToken, getAccessToken);
}
