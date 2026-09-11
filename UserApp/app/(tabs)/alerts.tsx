import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { API_BASE, WS_BASE } from "../../constants/api";

interface AlertItem {
  id: number;
  severity: string;
  status: string;
  description: string;
  confidence: number;
  created_at?: string;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function severityColor(severity: string) {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return '#EF4444';
    case 'HIGH': return '#F97316';
    case 'MEDIUM': return '#F59E0B';
    default: return '#3BBF73';
  }
}

function severityEmoji(severity: string) {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return '🆘';
    case 'HIGH': return '🚨';
    case 'MEDIUM': return '⚠️';
    default: return 'ℹ️';
  }
}

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/alerts`);
      const data = await res.json();
      setAlerts(data.reverse());
    } catch (e) {
      console.error('Alerts fetch failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const ws = new WebSocket(`${WS_BASE}/ws/alerts`);
    ws.onmessage = () => fetchAlerts();
    ws.onerror = (e) => console.warn('WS error:', e);
    return () => ws.close();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAlerts();
  }, []);

  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE');
  const sosAlerts = alerts.filter(a => a.severity === 'CRITICAL');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        {/* ================= HEADER ================= */}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.smallHeading}>
              YOUR SAFETY SPACE 🌸
            </Text>

            <Text style={styles.title}>
              Safety Alerts
            </Text>

            <Text style={styles.subtitle}>
              Live alerts from the surveillance system.
            </Text>
          </View>

          <View style={styles.bellCircle}>
            <Text style={styles.bell}>🔔</Text>
          </View>
        </View>


        {/* ================= STATUS CARD ================= */}

        <View style={styles.clearCard}>

          <View style={styles.clearTop}>

            <View style={styles.shieldCircle}>
              <Text style={styles.shield}>
                {activeAlerts.length > 0 ? '⚠️' : '🛡️'}
              </Text>
            </View>

            <View style={styles.clearInfo}>

              <View style={styles.clearTitleRow}>

                <Text style={styles.clearTitle}>
                  {activeAlerts.length > 0
                    ? `${activeAlerts.length} Active Alert${activeAlerts.length > 1 ? 's' : ''}`
                    : "You're all clear"}
                </Text>

                <View style={[
                  styles.safeBadge,
                  { backgroundColor: activeAlerts.length > 0 ? '#FEE2E2' : '#EAF8F0' }
                ]}>
                  <View style={[
                    styles.greenDot,
                    { backgroundColor: activeAlerts.length > 0 ? '#EF4444' : '#3BBF73' }
                  ]} />
                  <Text style={[
                    styles.safeText,
                    { color: activeAlerts.length > 0 ? '#DC2626' : '#319E60' }
                  ]}>
                    {activeAlerts.length > 0 ? 'ALERT' : 'SAFE'}
                  </Text>
                </View>

              </View>

              <Text style={styles.clearText}>
                {activeAlerts.length > 0
                  ? 'Active alerts detected by surveillance cameras.'
                  : 'No active safety alerts nearby.'}
              </Text>

            </View>

          </View>

          <View style={styles.clearDivider} />

          <View style={styles.monitorRow}>

            <View style={styles.monitorLeft}>
              <View style={styles.pulseDot} />
              <Text style={styles.monitorText}>
                Protection is active
              </Text>
            </View>

            <Text style={styles.updatedText}>
              Pull to refresh
            </Text>

          </View>

        </View>


        {/* ================= TODAY ================= */}

        <Text style={styles.sectionTitle}>
          Today ✨
        </Text>

        <View style={styles.statsCard}>

          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {activeAlerts.length}
            </Text>
            <Text style={styles.statLabel}>
              Active alerts
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {sosAlerts.length}
            </Text>
            <Text style={styles.statLabel}>
              SOS alerts
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {alerts.length}
            </Text>
            <Text style={styles.statLabel}>
              Total
            </Text>
          </View>

        </View>


        {/* ================= RECENT ALERTS ================= */}

        <View style={styles.sectionHeader}>

          <View>
            <Text style={styles.sectionTitle}>
              Recent Alerts
            </Text>

            <Text style={styles.sectionSubtitle}>
              Live from surveillance system
            </Text>
          </View>

        </View>


        {/* ================= ALERT LIST ================= */}

        {loading ? (
          <ActivityIndicator color="#D05D83" style={{ marginTop: 30 }} />
        ) : alerts.length === 0 ? (
          <View style={styles.emptyCard}>

            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>🌷</Text>
            </View>

            <Text style={styles.emptyTitle}>
              No recent alerts
            </Text>

            <Text style={styles.emptyText}>
              Everything looks good around you.
            </Text>

            <Text style={styles.emptySubText}>
              If we detect something unusual,
              we'll let you know here.
            </Text>

          </View>
        ) : (
          alerts.slice(0, 20).map((alert) => (
            <View
              key={alert.id}
              style={[styles.alertCard, { borderLeftColor: severityColor(alert.severity) }]}
            >
              <Text style={styles.alertEmoji}>
                {severityEmoji(alert.severity)}
              </Text>

              <View style={styles.alertBody}>
                <Text style={styles.alertTitle}>
                  {alert.description || 'Safety Alert'}
                </Text>
                <Text style={styles.alertMeta}>
                  {alert.severity} · {timeAgo(alert.created_at)}
                </Text>
              </View>

              <View style={[
                styles.severityBadge,
                { backgroundColor: severityColor(alert.severity) + '20' }
              ]}>
                <Text style={[
                  styles.severityText,
                  { color: severityColor(alert.severity) }
                ]}>
                  {alert.severity}
                </Text>
              </View>

            </View>
          ))
        )}


        {/* ================= AI STATUS ================= */}

        <View style={styles.aiCard}>

          <View style={styles.aiIcon}>
            <Text>✨</Text>
          </View>

          <View style={styles.aiContent}>

            <Text style={styles.aiTitle}>
              Smart protection is active
            </Text>

            <Text style={styles.aiText}>
              Surveillance cameras continuously monitor
              for threats.
            </Text>

          </View>

          <View style={styles.aiStatus}>
            <View style={styles.aiDot} />
          </View>

        </View>


        {/* ================= EMERGENCY ================= */}

        <TouchableOpacity
          style={styles.emergencyButton}
          activeOpacity={0.85}
          onPress={() => router.push("/sos")}
        >

          <View style={styles.emergencyIcon}>
            <Text>🚨</Text>
          </View>

          <View style={styles.emergencyContent}>

            <Text style={styles.emergencyTitle}>
              Need immediate help?
            </Text>

            <Text style={styles.emergencyText}>
              Open your emergency options
            </Text>

          </View>

          <Text style={styles.arrow}>›</Text>

        </TouchableOpacity>

      </ScrollView>
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
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 25,
  },

  headerText: {
    flex: 1,
  },

  smallHeading: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#C07896",
    marginBottom: 5,
  },

  title: {
    fontSize: 27,
    fontWeight: "800",
    color: "#292235",
  },

  subtitle: {
    fontSize: 11,
    color: "#958B98",
    marginTop: 5,
    lineHeight: 16,
  },

  bellCircle: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1E5EB",
  },

  bell: {
    fontSize: 21,
  },

  clearCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 17,
    borderWidth: 1,
    borderColor: "#E8F1EB",
    marginBottom: 27,
    shadowColor: "#8AA895",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  clearTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  shieldCircle: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: "#EAF8F0",
    justifyContent: "center",
    alignItems: "center",
  },

  shield: {
    fontSize: 28,
  },

  clearInfo: {
    flex: 1,
    marginLeft: 13,
  },

  clearTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  clearTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#292235",
  },

  safeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
  },

  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  safeText: {
    fontSize: 8,
    fontWeight: "900",
  },

  clearText: {
    fontSize: 10,
    color: "#918793",
    marginTop: 5,
  },

  clearDivider: {
    height: 1,
    backgroundColor: "#F0E9ED",
    marginVertical: 15,
  },

  monitorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  monitorLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#3BBF73",
    marginRight: 6,
  },

  monitorText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#645A65",
  },

  updatedText: {
    fontSize: 9,
    color: "#A39AA4",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#292235",
    marginBottom: 12,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 27,
    marginBottom: 13,
  },

  sectionSubtitle: {
    fontSize: 10,
    color: "#978E99",
    marginTop: 3,
  },

  statsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0E5EB",
    marginBottom: 2,
  },

  statItem: {
    flex: 1,
    alignItems: "center",
  },

  statNumber: {
    fontSize: 19,
    fontWeight: "900",
    color: "#292235",
  },

  statLabel: {
    fontSize: 9,
    color: "#978E99",
    marginTop: 4,
  },

  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#EEE6EB",
  },

  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#F0E5EB",
  },

  alertEmoji: {
    fontSize: 22,
    marginRight: 12,
  },

  alertBody: {
    flex: 1,
  },

  alertTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#292235",
  },

  alertMeta: {
    fontSize: 10,
    color: "#978E99",
    marginTop: 3,
  },

  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  severityText: {
    fontSize: 9,
    fontWeight: "800",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 25,
    paddingVertical: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0E5EB",
  },

  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: "#FCEAF2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  emptyIcon: {
    fontSize: 31,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#292235",
  },

  emptyText: {
    fontSize: 11,
    color: "#7F7582",
    marginTop: 5,
  },

  emptySubText: {
    fontSize: 9,
    color: "#A098A2",
    textAlign: "center",
    lineHeight: 14,
    marginTop: 9,
  },

  aiCard: {
    backgroundColor: "#F3ECF8",
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#E9DDF0",
  },

  aiIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  aiContent: {
    flex: 1,
    marginLeft: 11,
  },

  aiTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#5E4A66",
  },

  aiText: {
    fontSize: 9,
    color: "#887A8E",
    lineHeight: 14,
    marginTop: 4,
  },

  aiStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#DDF4E6",
    justifyContent: "center",
    alignItems: "center",
  },

  aiDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#3BBF73",
  },

  emergencyButton: {
    backgroundColor: "#FCEAF1",
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#F1CAD9",
  },

  emergencyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  emergencyContent: {
    flex: 1,
    marginLeft: 11,
  },

  emergencyTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#633D4F",
  },

  emergencyText: {
    fontSize: 9,
    color: "#9A7888",
    marginTop: 3,
  },

  arrow: {
    fontSize: 26,
    color: "#C77A98",
  },

});