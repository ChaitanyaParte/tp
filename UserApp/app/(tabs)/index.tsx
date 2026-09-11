import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";

import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { API_BASE } from "../../constants/api";

export default function HomeScreen() {
  const [streamError, setStreamError] = useState(false);
  const [streamUri, setStreamUri] = useState(`${API_BASE}/snapshot?t=0`);
  const [activeAlerts, setActiveAlerts] = useState<number>(0);
  const [detectionStats, setDetectionStats] = useState({ women: 0, men: 0, total: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setStreamUri(`${API_BASE}/snapshot?t=${Date.now()}`);
      setStreamError(false);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [alertsRes, detRes] = await Promise.all([
          fetch(`${API_BASE}/alerts`),
          fetch(`${API_BASE}/detections/summary`),
        ]);
        const alerts = await alertsRes.json();
        setActiveAlerts(alerts.filter((a: any) => a.status === 'ACTIVE').length);

        const det = await detRes.json();
        setDetectionStats({
          women: det.latest.female_count,
          men:   det.latest.male_count,
          total: det.latest.total_people,
        });
      } catch (_) {}
    };

    fetchStats();
    const poll = setInterval(fetchStats, 10000); // refresh every 10 s
    return () => clearInterval(poll);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ================= HEADER ================= */}

        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>GOOD EVENING 🌷</Text>
            <Text style={styles.heading}>Stay safe, beautiful ✨</Text>
            <Text style={styles.headerSubtitle}>
              We're keeping an eye out for you.
            </Text>
          </View>

          <TouchableOpacity style={styles.notificationButton}>
            <Text style={styles.notificationIcon}>🔔</Text>
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>


        {/* ================= SAFETY CARD ================= */}

        <View style={styles.safetyCard}>
          <View style={styles.safetyTop}>
            <View style={styles.shieldContainer}>
              <Text style={styles.shield}>🛡️</Text>
            </View>

            <View style={styles.safetyInfo}>
              <View style={styles.safetyTitleRow}>
                <Text style={styles.safetyTitle}>{activeAlerts > 0 ? 'Alert Active' : "You're Safe"}</Text>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.safetySubtitle}>
                Your surroundings are being monitored.
              </Text>
            </View>
          </View>

          {/* Detection counts row */}
          <View style={styles.safetyCountRow}>
            <View style={styles.safetyCount}>
              <Text style={styles.safetyCountNum}>{detectionStats.total}</Text>
              <Text style={styles.safetyCountLabel}>Total</Text>
            </View>
            <View style={styles.safetyCountDivider} />
            <View style={styles.safetyCount}>
              <Text style={[styles.safetyCountNum, { color: '#8B5CF6' }]}>{detectionStats.women}</Text>
              <Text style={styles.safetyCountLabel}>Women</Text>
            </View>
            <View style={styles.safetyCountDivider} />
            <View style={styles.safetyCount}>
              <Text style={[styles.safetyCountNum, { color: '#3B82F6' }]}>{detectionStats.men}</Text>
              <Text style={styles.safetyCountLabel}>Men</Text>
            </View>
          </View>

          <View style={styles.safetyDivider} />

          <View style={styles.monitoringRow}>
            <View style={styles.monitoringIndicator}>
              <View style={styles.greenDot} />
              <Text style={styles.monitoringText}>Protection active</Text>
            </View>
            <Text style={styles.monitoringTime}>Just now</Text>
          </View>
        </View>


        {/* ================= LIVE CAMERA FEED ================= */}

        <View style={styles.streamCard}>
          <View style={styles.streamHeader}>
            <View style={styles.streamTitleRow}>
              <Text style={styles.streamTitle}>📷 Live Surveillance</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.streamSubtitle}>
              AI-powered real-time monitoring
            </Text>
          </View>

          {streamError ? (
            <View style={styles.streamOffline}>
              <Text style={styles.streamOfflineIcon}>📷</Text>
              <Text style={styles.streamOfflineText}>Camera offline</Text>
              <Text style={styles.streamRetry}>Reconnecting...</Text>
            </View>
          ) : (
            <Image
              source={{ uri: streamUri }}
              style={styles.streamImage}
              contentFit="cover"
              recyclingKey="live-stream"
              transition={0}
              onError={() => setStreamError(true)}
            />
          )}
        </View>


        {/* ================= SOS ================= */}

        <View style={styles.sosSection}>
          <Text style={styles.emergencyLabel}>EMERGENCY ASSISTANCE</Text>

          <TouchableOpacity
            style={styles.sosOuter}
            activeOpacity={0.85}
            onPress={() => router.push("/sos")}
          >
            <View style={styles.sosButton}>
              <Text style={styles.sosText}>SOS</Text>
              <Text style={styles.sosHold}>HOLD</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.sosHint}>I'm here if you need me 🫶</Text>
          <Text style={styles.sosDescription}>
            Press and hold to start an emergency alert.
          </Text>
        </View>


        {/* ================= QUICK ACTIONS ================= */}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Quick Actions ✨</Text>
            <Text style={styles.sectionSubtitle}>Everything you need, right here.</Text>
          </View>
        </View>

        <View style={styles.actionsGrid}>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={() => router.push("/(tabs)/safe-circle")}
          >
            <View style={[styles.actionIcon, styles.pinkIcon]}>
              <Text>💗</Text>
            </View>
            <Text style={styles.actionTitle}>My Safe Circle</Text>
            <Text style={styles.actionDescription}>Your trusted people</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={() => router.push("/(tabs)/safe-circle")}
          >
            <View style={[styles.actionIcon, styles.blueIcon]}>
              <Text>📍</Text>
            </View>
            <Text style={styles.actionTitle}>Share Location</Text>
            <Text style={styles.actionDescription}>Let someone know where you are</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={() => router.push("/(tabs)/map")}
          >
            <View style={[styles.actionIcon, styles.purpleIcon]}>
              <Text>🗺️</Text>
            </View>
            <Text style={styles.actionTitle}>Safety Map</Text>
            <Text style={styles.actionDescription}>Explore safer areas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={() => router.push("/(tabs)/alerts")}
          >
            <View style={[styles.actionIcon, styles.yellowIcon]}>
              <Text>🔔</Text>
            </View>
            <Text style={styles.actionTitle}>My Alerts</Text>
            <Text style={styles.actionDescription}>Stay updated nearby</Text>
          </TouchableOpacity>

        </View>


        {/* ================= CURRENT AREA ================= */}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your Safety 🌸</Text>
            <Text style={styles.sectionSubtitle}>Current surroundings</Text>
          </View>
          <Text style={styles.details}>Details</Text>
        </View>

        <View style={styles.areaCard}>
          <View style={styles.areaTop}>
            <View style={styles.locationIcon}>
              <Text>📍</Text>
            </View>
            <View style={styles.areaInfo}>
              <Text style={styles.areaTitle}>Current Area</Text>
              <Text style={styles.areaSubtitle}>No unusual activity detected</Text>
            </View>
            <View style={styles.safeBadge}>
              <View style={styles.safeDot} />
              <Text style={styles.safeText}>SAFE</Text>
            </View>
          </View>

          <View style={styles.areaDivider} />

          <View style={styles.areaStats}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{activeAlerts}</Text>
              <Text style={styles.statLabel}>Active alerts</Text>
            </View>
            <View style={styles.statLine} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{detectionStats.women}</Text>
              <Text style={styles.statLabel}>Women seen</Text>
            </View>
            <View style={styles.statLine} />
            <View style={styles.stat}>
              <Text style={styles.statNumber}>{detectionStats.men}</Text>
              <Text style={styles.statLabel}>Men seen</Text>
            </View>
          </View>
        </View>


        {/* ================= SAFETY MESSAGE ================= */}

        <View style={styles.messageCard}>
          <View style={styles.messageIcon}>
            <Text>🌷</Text>
          </View>
          <View style={styles.messageContent}>
            <Text style={styles.messageTitle}>You've got this 💕</Text>
            <Text style={styles.messageText}>
              Stay aware, trust your instincts, and remember that help is always
              just a tap away.
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({

  safeArea: { flex: 1, backgroundColor: "#FFF8FC" },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  welcome: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, color: "#B17A91", marginBottom: 5 },
  heading: { fontSize: 27, fontWeight: "800", color: "#292235" },
  headerSubtitle: { fontSize: 12, color: "#8C8290", marginTop: 5 },
  notificationButton: { width: 48, height: 48, borderRadius: 17, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", elevation: 2, shadowColor: "#8B6274", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  notificationIcon: { fontSize: 20 },
  notificationDot: { position: "absolute", top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: "#E94B6A", borderWidth: 2, borderColor: "#FFFFFF" },

  safetyCard: { backgroundColor: "#FFFFFF", borderRadius: 23, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: "#F4DDE7", elevation: 2, shadowColor: "#B66F89", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  safetyTop: { flexDirection: "row", alignItems: "center" },
  safetyCountRow: { flexDirection: "row", alignItems: "center", marginTop: 14, marginBottom: 4 },
  safetyCount: { flex: 1, alignItems: "center" },
  safetyCountNum: { fontSize: 17, fontWeight: "900", color: "#292235" },
  safetyCountLabel: { fontSize: 9, color: "#9A909B", marginTop: 3 },
  safetyCountDivider: { width: 1, height: 26, backgroundColor: "#F2E8ED" },
  shieldContainer: { width: 62, height: 62, borderRadius: 21, backgroundColor: "#FCEAF1", justifyContent: "center", alignItems: "center" },
  shield: { fontSize: 31 },
  safetyInfo: { flex: 1, marginLeft: 15 },
  safetyTitleRow: { flexDirection: "row", alignItems: "center" },
  safetyTitle: { fontSize: 18, fontWeight: "800", color: "#292235" },
  liveBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#EAF8F0", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#54B981", marginRight: 4 },
  liveText: { fontSize: 8, fontWeight: "900", color: "#329966" },
  safetySubtitle: { fontSize: 11, color: "#827887", marginTop: 5, lineHeight: 16 },
  safetyDivider: { height: 1, backgroundColor: "#F2E8ED", marginVertical: 15 },
  monitoringRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monitoringIndicator: { flexDirection: "row", alignItems: "center" },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#54B981", marginRight: 7 },
  monitoringText: { fontSize: 11, fontWeight: "700", color: "#5D5561" },
  monitoringTime: { fontSize: 10, color: "#A39AA5" },

  streamCard: { backgroundColor: "#FFFFFF", borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: "#F4DDE7", overflow: "hidden", elevation: 2, shadowColor: "#B66F89", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  streamHeader: { padding: 14 },
  streamTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  streamTitle: { fontSize: 14, fontWeight: "800", color: "#292235" },
  streamSubtitle: { fontSize: 10, color: "#9A909B" },
  streamImage: { width: "100%", height: 200, backgroundColor: "#1a1a2e" },
  streamOffline: { height: 200, backgroundColor: "#1a1a2e", justifyContent: "center", alignItems: "center", gap: 8 },
  streamOfflineIcon: { fontSize: 36 },
  streamOfflineText: { fontSize: 13, color: "#666", fontWeight: "600" },
  streamRetry: { fontSize: 11, color: "#D05D83", fontWeight: "700", marginTop: 4 },

  sosSection: { alignItems: "center", marginBottom: 31 },
  emergencyLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5, color: "#B58A9A", marginBottom: 15 },
  sosOuter: { width: 158, height: 158, borderRadius: 79, backgroundColor: "#FBDCE6", justifyContent: "center", alignItems: "center" },
  sosButton: { width: 130, height: 130, borderRadius: 65, backgroundColor: "#E94B6A", justifyContent: "center", alignItems: "center", elevation: 7, shadowColor: "#D83F5E", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } },
  sosText: { fontSize: 31, fontWeight: "900", color: "#FFFFFF", letterSpacing: 1 },
  sosHold: { fontSize: 8, fontWeight: "900", color: "#FFE9EF", letterSpacing: 2, marginTop: 4 },
  sosHint: { fontSize: 14, fontWeight: "700", color: "#514752", marginTop: 16 },
  sosDescription: { fontSize: 10, color: "#9A909B", marginTop: 5 },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 13 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#292235" },
  sectionSubtitle: { fontSize: 10, color: "#9A909B", marginTop: 3 },
  details: { fontSize: 11, fontWeight: "800", color: "#D05D83" },

  actionsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 28 },
  actionCard: { width: "48%", minHeight: 143, backgroundColor: "#FFFFFF", borderRadius: 19, padding: 15, marginBottom: 11, borderWidth: 1, borderColor: "#F2E9EE", elevation: 1, shadowColor: "#A8788D", shadowOpacity: 0.04, shadowRadius: 7, shadowOffset: { width: 0, height: 3 } },
  actionIcon: { width: 43, height: 43, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  pinkIcon: { backgroundColor: "#FCE5ED" },
  blueIcon: { backgroundColor: "#E5F0FC" },
  purpleIcon: { backgroundColor: "#EEE7FA" },
  yellowIcon: { backgroundColor: "#FFF4D8" },
  actionTitle: { fontSize: 13, fontWeight: "800", color: "#292235" },
  actionDescription: { fontSize: 10, color: "#948A96", lineHeight: 14, marginTop: 5 },

  areaCard: { backgroundColor: "#FFFFFF", borderRadius: 21, padding: 18, marginBottom: 18, borderWidth: 1, borderColor: "#F2E9EE", elevation: 1, shadowColor: "#A8788D", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  areaTop: { flexDirection: "row", alignItems: "center" },
  locationIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: "#F0EAFE", justifyContent: "center", alignItems: "center" },
  areaInfo: { flex: 1, marginLeft: 12 },
  areaTitle: { fontSize: 14, fontWeight: "800", color: "#292235" },
  areaSubtitle: { fontSize: 10, color: "#938995", marginTop: 4 },
  safeBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#EAF8F0", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9 },
  safeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#54B981", marginRight: 5 },
  safeText: { fontSize: 8, fontWeight: "900", color: "#329966" },
  areaDivider: { height: 1, backgroundColor: "#F1E9ED", marginVertical: 17 },
  areaStats: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 14, fontWeight: "900", color: "#292235" },
  statLabel: { fontSize: 9, color: "#958B97", marginTop: 4 },
  statLine: { width: 1, height: 28, backgroundColor: "#EEE6EB" },

  messageCard: { backgroundColor: "#F7EDF8", borderRadius: 20, padding: 15, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#EDE0F0" },
  messageIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" },
  messageContent: { flex: 1, marginLeft: 12 },
  messageTitle: { fontSize: 13, fontWeight: "800", color: "#624A68" },
  messageText: { fontSize: 10, color: "#817286", lineHeight: 15, marginTop: 3 },
});