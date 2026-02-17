import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Household',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
