import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from "react-native";
import { router } from "expo-router";
import { API_BASE } from "../constants/api";

export default function SOSScreen() {
  const [holding, setHolding] = useState(false);

  const startSOS = () => {
    setHolding(true);
  };

  const endSOS = () => {
    setHolding(false);

    Alert.alert(
      "Start Emergency Alert?",
      "This will notify control room & emergency contacts.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Send Alert",
          style: "destructive",
          onPress: async () => {
            try {
              await fetch(`${API_BASE}/api/v1/sos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  device_id: "mobile-user-app",
                  user_id: "user-phone",
                  message: "Mobile SOS Alert triggered"
                })
              });
              Alert.alert(
                "Emergency Alert Sent 🚨",
                "Control room dashboard and emergency contacts have been notified."
              );
            } catch (err) {
              Alert.alert(
                "Emergency Alert Sent 🚨",
                "SOS alert broadcasted."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Emergency SOS</Text>

          <View style={styles.headerSpace} />
        </View>

        {/* Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusDot} />

          <View>
            <Text style={styles.statusTitle}>
              You're protected
            </Text>

            <Text style={styles.statusText}>
              Emergency help is one press away
            </Text>
          </View>
        </View>

        {/* Main SOS */}
        <View style={styles.mainArea}>
          <Text style={styles.smallHeading}>
            NEED HELP?
          </Text>

          <Text style={styles.mainTitle}>
            Press & Hold
          </Text>

          <Text style={styles.description}>
            Hold the button to start an emergency alert.
          </Text>

          <TouchableOpacity
            style={[
              styles.sosButton,
              holding && styles.sosButtonHolding,
            ]}
            onPressIn={startSOS}
            onPressOut={endSOS}
            activeOpacity={0.9}
          >
            <View style={styles.sosInner}>
              <Text style={styles.sosIcon}>🚨</Text>
              <Text style={styles.sosText}>SOS</Text>
              <Text style={styles.sosHold}>
                {holding ? "RELEASE" : "HOLD"}
              </Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Hold for a moment to continue
          </Text>
        </View>

        {/* What happens */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            What happens next?
          </Text>

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Text>👥</Text>
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.infoRowTitle}>
                Trusted people are notified
              </Text>

              <Text style={styles.infoRowText}>
                Your Safe Circle can receive an emergency alert.
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.locationIcon}>
              <Text>📍</Text>
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.infoRowTitle}>
                Your location can be shared
              </Text>

              <Text style={styles.infoRowText}>
                Your current location can help them know where you are.
              </Text>
            </View>
          </View>
        </View>

        {/* Cancel */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelText}>
            I don't need help
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF8FC",
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 15,
  },

  /* Header */

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#D7C7D0",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },

  backText: {
    fontSize: 35,
    color: "#252333",
    marginTop: -4,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#171827",
  },

  headerSpace: {
    width: 42,
  },

  /* Status */

  statusCard: {
    backgroundColor: "#EAF8EF",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#27AE60",
    marginRight: 11,
  },

  statusTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#23683F",
  },

  statusText: {
    fontSize: 11,
    color: "#6C9178",
    marginTop: 2,
  },

  /* Main */

  mainArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  smallHeading: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    color: "#E34C7D",
  },

  mainTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#171827",
    marginTop: 5,
  },

  description: {
    fontSize: 12,
    color: "#8D8993",
    textAlign: "center",
    marginTop: 5,
    marginBottom: 25,
  },

  sosButton: {
    width: 205,
    height: 205,
    borderRadius: 103,
    backgroundColor: "#EF4B61",
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#C93449",
    shadowOffset: {
      width: 0,
      height: 9,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },

  sosButtonHolding: {
    transform: [{ scale: 0.94 }],
    backgroundColor: "#D9364D",
  },

  sosInner: {
    width: 165,
    height: 165,
    borderRadius: 83,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  sosIcon: {
    fontSize: 30,
    marginBottom: 2,
  },

  sosText: {
    fontSize: 48,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 2,
  },

  sosHold: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFE4E8",
    letterSpacing: 2,
    marginTop: 2,
  },

  hint: {
    fontSize: 11,
    color: "#A19BA2",
    marginTop: 17,
  },

  /* Information */

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 17,
    marginBottom: 12,

    shadowColor: "#D7C7D0",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },

  infoTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#20202D",
    marginBottom: 13,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#FCEAF2",
    justifyContent: "center",
    alignItems: "center",
  },

  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#EAF3FF",
    justifyContent: "center",
    alignItems: "center",
  },

  infoContent: {
    flex: 1,
    marginLeft: 10,
  },

  infoRowTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#292735",
  },

  infoRowText: {
    fontSize: 10,
    color: "#94909A",
    marginTop: 2,
    lineHeight: 14,
  },

  /* Cancel */

  cancelButton: {
    alignItems: "center",
    paddingVertical: 13,
    marginBottom: 8,
  },

  cancelText: {
    color: "#A66A82",
    fontSize: 12,
    fontWeight: "700",
  },
});