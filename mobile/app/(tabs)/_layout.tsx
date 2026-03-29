import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuthToken } from '@/lib/auth';

export default function TabLayout() {
  const token = useAuthToken();

  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      initialRouteName="task"
      screenOptions={{
        tabBarActiveTintColor: '#64786f',
        tabBarInactiveTintColor: '#8f8a82',
        tabBarStyle: {
          backgroundColor: '#fffdf8',
          borderTopColor: '#ddd7ca',
        },
        tabBarButton: HapticTab,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="task"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Household',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="calendar" color={color} />,
        }}
      />
    </Tabs>
  );
}
