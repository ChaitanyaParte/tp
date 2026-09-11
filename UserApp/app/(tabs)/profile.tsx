import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";

export default function ProfileScreen() {
  const handleLogout = async () => {
    Alert.alert(
      "Log out?",
      "You'll need to log in again on this device.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem("isLoggedIn");
              router.replace("/login");
            } catch (error) {
              console.log("Logout error:", error);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Profile 👋</Text>
          <Text style={styles.subtitle}>
            Your safety, your settings.
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Text style={styles.headerEmoji}>👤</Text>
        </View>
      </View>

      {/* Profile Card */}

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👩</Text>
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.name}>Your Name</Text>

          <Text style={styles.email}>
            your@email.com
          </Text>

          <View style={styles.protectedBadge}>
            <View style={styles.greenDot} />

            <Text style={styles.protectedText}>
              PROTECTED
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.editButton}
          activeOpacity={0.8}
        >
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Safety Status */}

      <View style={styles.statusCard}>
        <View style={styles.statusIcon}>
          <Text>🛡️</Text>
        </View>

        <View style={styles.statusInfo}>
          <Text style={styles.statusTitle}>
            Safety Protection is ON
          </Text>

          <Text style={styles.statusText}>
            Your safety features are ready.
          </Text>
        </View>

        <View style={styles.statusDot} />
      </View>

      {/* Safety Settings */}

      <Text style={styles.sectionTitle}>
        Safety Settings
      </Text>

      <TouchableOpacity
        style={styles.settingCard}
        activeOpacity={0.75}
      >
        <View style={[styles.settingIcon, styles.pinkIcon]}>
          <Text>👥</Text>
        </View>

        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>
            My Safe Circle
          </Text>

          <Text style={styles.settingSubtitle}>
            Manage your trusted people
          </Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.settingCard}
        activeOpacity={0.75}
      >
        <View style={[styles.settingIcon, styles.blueIcon]}>
          <Text>📍</Text>
        </View>

        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>
            Location Sharing
          </Text>

          <Text style={styles.settingSubtitle}>
            Manage emergency location sharing
          </Text>
        </View>

        <View style={styles.onBadge}>
          <Text style={styles.onText}>ON</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.settingCard}
        activeOpacity={0.75}
      >
        <View style={[styles.settingIcon, styles.yellowIcon]}>
          <Text>🔔</Text>
        </View>

        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>
            Notifications
          </Text>

          <Text style={styles.settingSubtitle}>
            Safety alerts and updates
          </Text>
        </View>

        <View style={styles.onBadge}>
          <Text style={styles.onText}>ON</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.settingCard}
        activeOpacity={0.75}
      >
        <View style={[styles.settingIcon, styles.redIcon]}>
          <Text>🚨</Text>
        </View>

        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>
            Emergency Settings
          </Text>

          <Text style={styles.settingSubtitle}>
            Configure your emergency preferences
          </Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      {/* App */}

      <Text style={styles.sectionTitle}>
        App
      </Text>

      <TouchableOpacity
        style={styles.settingCard}
        activeOpacity={0.75}
      >
        <View style={[styles.settingIcon, styles.purpleIcon]}>
          <Text>ℹ️</Text>
        </View>

        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>
            About SafeHer
          </Text>

          <Text style={styles.settingSubtitle}>
            Version 1.0.0
          </Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      {/* Logout */}

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutIcon}>↪</Text>

        <Text style={styles.logoutText}>
          Log Out
        </Text>
      </TouchableOpacity>

      {/* Footer */}

      <Text style={styles.footer}>
        Made with care for your safety 💗
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8FC",
  },

  content: {
    padding: 20,
    paddingTop: 58,
    paddingBottom: 40,
  },

  /* Header */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  title: {
    fontSize: 27,
    fontWeight: "800",
    color: "#171827",
  },

  subtitle: {
    fontSize: 13,
    color: "#8E8992",
    marginTop: 5,
  },

  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFE7F0",
    justifyContent: "center",
    alignItems: "center",
  },

  headerEmoji: {
    fontSize: 24,
  },

  /* Profile */

  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,

    shadowColor: "#D9C7D1",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 2,
  },

  avatar: {
    width: 65,
    height: 65,
    borderRadius: 21,
    backgroundColor: "#FCE3ED",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 31,
  },

  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },

  name: {
    fontSize: 17,
    fontWeight: "800",
    color: "#20202D",
  },

  email: {
    fontSize: 11,
    color: "#96919A",
    marginTop: 3,
  },

  protectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#27AE60",
    marginRight: 5,
  },

  protectedText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#279653",
  },

  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#FFF0F5",
  },

  editText: {
    color: "#D94B7D",
    fontSize: 11,
    fontWeight: "800",
  },

  /* Status */

  statusCard: {
    backgroundColor: "#EAF8EF",
    borderRadius: 19,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 26,
  },

  statusIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  statusInfo: {
    flex: 1,
    marginLeft: 11,
  },

  statusTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#23683F",
  },

  statusText: {
    fontSize: 11,
    color: "#6C9178",
    marginTop: 3,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#27AE60",
  },

  /* Sections */

  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#171827",
    marginBottom: 12,
  },

  /* Settings */

  settingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,

    shadowColor: "#D9C7D1",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 7,
    elevation: 2,
  },

  settingIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },

  pinkIcon: {
    backgroundColor: "#FCE5EF",
  },

  blueIcon: {
    backgroundColor: "#E5F0FF",
  },

  yellowIcon: {
    backgroundColor: "#FFF4D9",
  },

  redIcon: {
    backgroundColor: "#FFE6E6",
  },

  purpleIcon: {
    backgroundColor: "#EEE7FA",
  },

  settingInfo: {
    flex: 1,
    marginLeft: 12,
  },

  settingTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#252431",
  },

  settingSubtitle: {
    fontSize: 10,
    color: "#96919A",
    marginTop: 3,
  },

  arrow: {
    fontSize: 25,
    color: "#AAA6AE",
    marginLeft: 8,
  },

  onBadge: {
    backgroundColor: "#EAF8EF",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
  },

  onText: {
    color: "#279653",
    fontSize: 9,
    fontWeight: "900",
  },

  /* Logout */

  logoutButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFF0F2",
    borderWidth: 1,
    borderColor: "#F5B7C1",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    marginTop: 22,
  },

  logoutIcon: {
    fontSize: 19,
    color: "#E04459",
    marginRight: 8,
  },

  logoutText: {
    color: "#E04459",
    fontSize: 14,
    fontWeight: "800",
  },

  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#AAA2AA",
    marginTop: 20,
  },
});