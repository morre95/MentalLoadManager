import { Redirect, Tabs, router } from 'expo-router';
import React from 'react';
import { Alert, Pressable } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { clearAccessToken, useAuthToken } from '@/lib/auth';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

export default function TabLayout() {
  const token = useAuthToken();

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#64786f',
        tabBarInactiveTintColor: '#8f8a82',
        tabBarStyle: {
          backgroundColor: '#fffdf8',
          borderTopColor: '#ddd7ca',
        },
        tabBarButton: HapticTab,
        headerStyle: {
          backgroundColor: '#fffdf8',
        },
        headerTintColor: '#2b2a28',
        headerRight: () => (
          <Pressable
            hitSlop={10}
            onPress={() => {
              Alert.alert('Menu', 'Choose an action', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Log out',
                  style: 'destructive',
                  onPress: () => {
                    clearAccessToken();
                    router.replace('/login');
                  },
                },
              ]);
            }}
            style={{ marginRight: 14 }}
          >
            <IconSymbol size={24} name="line.3.horizontal" color="#2b2a28" />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <FontAwesome5 name="tasks" size={26} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Household',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
