import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { mobileApiBaseUrl } from '@/lib/api';
import { setAccessToken } from '@/lib/auth';

const COLORS = {
  bg: '#f7f6f2',
  card: '#ffffff',
  text: '#2b2a28',
  muted: '#78736b',
  border: '#ddd7ca',
  primary: '#64786f',
  terracotta: '#c7674a',
} as const;

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.set('grant_type', 'password');
      body.set('username', username.trim());
      body.set('password', password);

      const response = await fetch(`${mobileApiBaseUrl}/api/passwrod/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.detail || `Login failed (${response.status})`);
      }

      if (!data?.access_token) {
        throw new Error('No access token returned from backend.');
      }

      setAccessToken(data.access_token);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Mental Load Manager</Text>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Backend: {mobileApiBaseUrl}</Text>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="kalle_svensson"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
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
    marginBottom: 4,
  },
  fieldWrap: {
    gap: 6,
  },
  label: {
    color: COLORS.text,
    fontWeight: '600',
  },
  input: {
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  error: {
    color: COLORS.terracotta,
    fontWeight: '600',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
