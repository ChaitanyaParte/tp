import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import { API_BASE } from "../../constants/api";

export default function SafeCircleScreen() {
  const [locationSharing, setLocationSharing] = useState(true);
  const [sending, setSending] = useState(false);

  const contacts = [
    { name: "Mom", relation: "Family", emoji: "👩" },
    { name: "Dad", relation: "Family", emoji: "👨" },
    { name: "Best Friend", relation: "Friend", emoji: "👩‍🦰" },
  ];

  const handleAddContact = () => {
    Alert.alert(
      "Add Trusted Contact",
      "Contact selection will be connected here."
    );
  };

  const handleAlert = () => {
    Alert.alert(
      "Alert Safe Circle",
      "This will send an SOS alert to the safety system and notify your contacts.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Alert",
          style: "destructive",
          onPress: async () => {
            setSending(true);
            try {
              let lat = null, lon = null;
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                lat = loc.coords.latitude;
                lon = loc.coords.longitude;
              }
              const res = await fetch(`${API_BASE}/api/v1/sos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  device_id: 'safeher-app',
                  user_id: 'user',
                  gps_lat: lat,
                  gps_lon: lon,
                  message: 'SOS from Safe Circle alert button',
                }),
              });
              if (res.ok) {
                Alert.alert(
                  '🆘 Alert Sent',
                  'Your safe circle and the safety system have been notified.'
                );
              } else {
                throw new Error('Failed');
              }
            } catch (e) {
              Alert.alert(
                'Failed',
                'Could not send alert. Check your connection.'
              );
            } finally {
              setSending(false);
            }
          }
        }
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
          <Text style={styles.title}>Safe Circle 🛡️</Text>

          <Text style={styles.subtitle}>
            Your trusted people, always close.
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Text style={styles.headerEmoji}>💗</Text>
        </View>
      </View>

      {/* Protection Card */}

      <View style={styles.protectionCard}>
        <View style={styles.protectionIcon}>
          <Text style={styles.shield}>🛡️</Text>
        </View>

        <View style={styles.protectionInfo}>
          <View style={styles.statusRow}>
            <Text style={styles.protectionTitle}>
              Safe Circle Active
            </Text>

            <View style={styles.activeBadge}>
              <View style={styles.greenDot} />
              <Text style={styles.activeText}>ACTIVE</Text>
            </View>
          </View>

          <Text style={styles.protectionText}>
            3 trusted people are connected to your circle.
          </Text>
        </View>
      </View>

      {/* Contacts Header */}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            Trusted People 💕
          </Text>

          <Text style={styles.sectionSubtitle}>
            People who can help you
          </Text>
        </View>

        <Text style={styles.contactCount}>3 contacts</Text>
      </View>

      {/* Contact Cards */}

      {contacts.map((contact, index) => (
        <View style={styles.contactCard} key={index}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>
              {contact.emoji}
            </Text>
          </View>

          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>
              {contact.name}
            </Text>

            <Text style={styles.contactRelation}>
              {contact.relation}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.callButton}
            activeOpacity={0.8}
            onPress={() =>
              Alert.alert(
                "Call Contact",
                `Calling ${contact.name}...`
              )
            }
          >
            <Text style={styles.callIcon}>📞</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Add Contact */}

      <TouchableOpacity
        style={styles.addButton}
        activeOpacity={0.8}
        onPress={handleAddContact}
      >
        <View style={styles.plusCircle}>
          <Text style={styles.plus}>+</Text>
        </View>

        <View style={styles.addTextContainer}>
          <Text style={styles.addTitle}>
            Add Trusted Contact
          </Text>

          <Text style={styles.addSubtitle}>
            Add someone you trust
          </Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      {/* Location Sharing */}

      <Text style={styles.sectionTitle}>
        Safety Settings 🌸
      </Text>

      <View style={styles.settingCard}>
        <View style={styles.settingIcon}>
          <Text>📍</Text>
        </View>

        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>
            Live Location Sharing
          </Text>

          <Text style={styles.settingSubtitle}>
            Share your location with your Safe Circle
          </Text>
        </View>

        <Switch
          value={locationSharing}
          onValueChange={setLocationSharing}
          trackColor={{
            false: "#D9D9D9",
            true: "#F3A6BF",
          }}
          thumbColor={
            locationSharing ? "#D05D83" : "#FFFFFF"
          }
        />
      </View>

      {/* Alert Button */}

      <TouchableOpacity
        style={[styles.alertButton, sending && { opacity: 0.6 }]}
        activeOpacity={0.85}
        onPress={handleAlert}
        disabled={sending}
      >
        <Text style={styles.alertEmoji}>
          {sending ? '⏳' : '🚨'}
        </Text>

        <View>
          <Text style={styles.alertTitle}>
            {sending ? 'Sending Alert...' : 'Alert My Safe Circle'}
          </Text>

          <Text style={styles.alertSubtitle}>
            Send an emergency notification
          </Text>
        </View>
      </TouchableOpacity>

      {/* Bottom message */}

      <View style={styles.bottomMessage}>
        <Text style={styles.bottomEmoji}>🌷</Text>

        <Text style={styles.bottomText}>
          You don't have to face an emergency alone.
          {"\n"}
          Your Safe Circle is here for you.
        </Text>
      </View>
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
    paddingTop: 55,
    paddingBottom: 35,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#241923",
  },

  subtitle: {
    marginTop: 5,
    fontSize: 13,
    color: "#8A7A82",
  },

  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFE5F0",
    justifyContent: "center",
    alignItems: "center",
  },

  headerEmoji: {
    fontSize: 23,
  },

  protectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1E2E9",
    shadowColor: "#D05D83",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },

  protectionIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#EAF8F0",
    justifyContent: "center",
    alignItems: "center",
  },

  shield: {
    fontSize: 28,
  },

  protectionInfo: {
    flex: 1,
    marginLeft: 14,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  protectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#241923",
  },

  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF8F0",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },

  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2DBE75",
    marginRight: 5,
  },

  activeText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#23935C",
  },

  protectionText: {
    fontSize: 11,
    color: "#8A7A82",
    marginTop: 6,
    lineHeight: 16,
  },

  sectionHeader: {
    marginTop: 28,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#241923",
    marginTop: 25,
    marginBottom: 12,
  },

  sectionSubtitle: {
    fontSize: 11,
    color: "#9B8C94",
    marginTop: 3,
  },

  contactCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D05D83",
  },

  contactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1E7EC",
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "#F4EAFE",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarEmoji: {
    fontSize: 24,
  },

  contactInfo: {
    flex: 1,
    marginLeft: 13,
  },

  contactName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#241923",
  },

  contactRelation: {
    fontSize: 11,
    color: "#9B8C94",
    marginTop: 4,
  },

  callButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#EAF8F0",
    justifyContent: "center",
    alignItems: "center",
  },

  callIcon: {
    fontSize: 18,
  },

  addButton: {
    backgroundColor: "#FFF0F6",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    borderWidth: 1,
    borderColor: "#F5D8E5",
    borderStyle: "dashed",
  },

  plusCircle: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  plus: {
    fontSize: 28,
    color: "#D05D83",
    fontWeight: "400",
  },

  addTextContainer: {
    flex: 1,
    marginLeft: 12,
  },

  addTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#241923",
  },

  addSubtitle: {
    fontSize: 10,
    color: "#9B8C94",
    marginTop: 3,
  },

  arrow: {
    fontSize: 25,
    color: "#C49AA9",
  },

  settingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1E7EC",
  },

  settingIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#EAF0FF",
    justifyContent: "center",
    alignItems: "center",
  },

  settingInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  settingTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#241923",
  },

  settingSubtitle: {
    fontSize: 10,
    color: "#9B8C94",
    marginTop: 4,
    lineHeight: 14,
  },

  alertButton: {
    marginTop: 20,
    backgroundColor: "#FFE8EE",
    borderRadius: 20,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3C6D3",
  },

  alertEmoji: {
    fontSize: 25,
    marginRight: 13,
  },

  alertTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#B9385D",
  },

  alertSubtitle: {
    fontSize: 10,
    color: "#A86B7D",
    marginTop: 4,
  },

  bottomMessage: {
    marginTop: 20,
    backgroundColor: "#F8EFFB",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },

  bottomEmoji: {
    fontSize: 25,
    marginRight: 12,
  },

  bottomText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: "#806C79",
  },
});