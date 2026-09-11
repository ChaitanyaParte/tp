import React from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: "#D05D83",
        tabBarInactiveTintColor: "#9CA3AF",

        tabBarStyle: {
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#F0E5EC",
        },

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
        },
      }}
    >
      {/* HOME */}

      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: () => (
            <Text style={{ fontSize: 21 }}>🏠</Text>
          ),
        }}
      />

      {/* MAP */}

      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: () => (
            <Text style={{ fontSize: 21 }}>🗺️</Text>
          ),
        }}
      />

      {/* ALERTS */}

      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: () => (
            <Text style={{ fontSize: 21 }}>🚨</Text>
          ),
        }}
      />

      {/* SAFE CIRCLE */}

      <Tabs.Screen
        name="safe-circle"
        options={{
          title: "Safe Circle",
          tabBarIcon: () => (
            <Text style={{ fontSize: 21 }}>🛡️</Text>
          ),
        }}
      />

      {/* PROFILE */}

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: () => (
            <Text style={{ fontSize: 21 }}>👤</Text>
          ),
        }}
      />

      {/* Hide old Explore screen */}

      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}