import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
} from "react-native";

export default function NightSafetyScreen() {
  const [nightMode, setNightMode] = useState(true);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ================= HEADER ================= */}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.smallLabel}>
              PERSONAL PROTECTION 🌙
            </Text>

            <Text style={styles.title}>
              Night Safety
            </Text>

            <Text style={styles.subtitle}>
              Extra protection when you're out at night.
            </Text>
          </View>

          <View style={styles.moonCircle}>
            <Text style={styles.moon}>
              🌙
            </Text>
          </View>
        </View>


        {/* ================= NIGHT MODE ================= */}

        <View style={styles.modeCard}>

          <View style={styles.modeTop}>

            <View style={styles.modeIcon}>
              <Text style={styles.modeEmoji}>
                🌙
              </Text>
            </View>

            <View style={styles.modeInfo}>

              <Text style={styles.modeTitle}>
                Night Safety Mode
              </Text>

              <Text style={styles.modeDescription}>
                {nightMode
                  ? "Your extra protection is active."
                  : "Turn this on when travelling at night."
                }
              </Text>

            </View>

            <Switch
              value={nightMode}
              onValueChange={setNightMode}
              trackColor={{
                false: "#D8D1DA",
                true: "#E7A4BD",
              }}
              thumbColor={
                nightMode ? "#D05D83" : "#FFFFFF"
              }
            />

          </View>


          <View style={styles.modeDivider} />


          <View style={styles.activeRow}>

            <View style={styles.activeIndicator}>
              <View
                style={[
                  styles.activeDot,
                  {
                    backgroundColor: nightMode
                      ? "#54B981"
                      : "#B7AFB8",
                  },
                ]}
              />

              <Text style={styles.activeText}>
                {nightMode
                  ? "Protection active"
                  : "Protection paused"
                }
              </Text>
            </View>

            <Text style={styles.timeText}>
              {nightMode ? "24/7 ready" : "Standby"}
            </Text>

          </View>

        </View>


        {/* ================= PROTECTION STATUS ================= */}

        <Text style={styles.sectionTitle}>
          Protection Status 🛡️
        </Text>

        <View style={styles.statusCard}>

          {/* Location */}

          <View style={styles.statusItem}>

            <View style={styles.statusIconPink}>
              <Text>📍</Text>
            </View>

            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                Location
              </Text>

              <Text style={styles.statusSubtitle}>
                Live location available
              </Text>
            </View>

            <View style={styles.checkCircle}>
              <Text style={styles.check}>
                ✓
              </Text>
            </View>

          </View>


          <View style={styles.statusDivider} />


          {/* Monitoring */}

          <View style={styles.statusItem}>

            <View style={styles.statusIconPurple}>
              <Text>👁️</Text>
            </View>

            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                Smart Monitoring
              </Text>

              <Text style={styles.statusSubtitle}>
                Surroundings are being monitored
              </Text>
            </View>

            <View style={styles.checkCircle}>
              <Text style={styles.check}>
                ✓
              </Text>
            </View>

          </View>


          <View style={styles.statusDivider} />


          {/* Safe Circle */}

          <View style={styles.statusItem}>

            <View style={styles.statusIconBlue}>
              <Text>💗</Text>
            </View>

            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                Safe Circle
              </Text>

              <Text style={styles.statusSubtitle}>
                Trusted contacts are ready
              </Text>
            </View>

            <View style={styles.checkCircle}>
              <Text style={styles.check}>
                ✓
              </Text>
            </View>

          </View>

        </View>


        {/* ================= SAFE WALK ================= */}

        <Text style={styles.sectionTitle}>
          Safe Walk 🌷
        </Text>

        <View style={styles.safeWalkCard}>

          <View style={styles.safeWalkIcon}>
            <Text style={styles.walkEmoji}>
              🚶‍♀️
            </Text>
          </View>

          <View style={styles.safeWalkContent}>

            <Text style={styles.safeWalkTitle}>
              Start a Safe Walk
            </Text>

            <Text style={styles.safeWalkText}>
              Share your journey with someone you trust
              while you're travelling.
            </Text>

          </View>

          <Text style={styles.arrow}>
            ›
          </Text>

        </View>


        {/* ================= AI PROTECTION ================= */}

        <View style={styles.aiCard}>

          <View style={styles.aiIcon}>
            <Text style={styles.aiEmoji}>
              ✨
            </Text>
          </View>

          <View style={styles.aiContent}>

            <View style={styles.aiTitleRow}>

              <Text style={styles.aiTitle}>
                Smart Protection
              </Text>

              <View style={styles.aiBadge}>
                <View style={styles.aiDot} />

                <Text style={styles.aiBadgeText}>
                  ACTIVE
                </Text>
              </View>

            </View>

            <Text style={styles.aiText}>
              Your safety system can detect unusual
              activity and help you respond quickly.
            </Text>

          </View>

        </View>


        {/* ================= SAFETY TIPS ================= */}

        <Text style={styles.sectionTitle}>
          Night Safety Tips ✨
        </Text>

        <View style={styles.tipsCard}>

          <View style={styles.tip}>
            <Text style={styles.tipEmoji}>
              💗
            </Text>

            <Text style={styles.tipText}>
              Keep your trusted contacts updated.
            </Text>
          </View>

          <View style={styles.tip}>
            <Text style={styles.tipEmoji}>
              📱
            </Text>

            <Text style={styles.tipText}>
              Keep your phone charged while travelling.
            </Text>
          </View>

          <View style={styles.tip}>
            <Text style={styles.tipEmoji}>
              🧭
            </Text>

            <Text style={styles.tipText}>
              Stay aware of your surroundings and trust
              your instincts.
            </Text>
          </View>

        </View>


        {/* ================= EMERGENCY ================= */}

        <TouchableOpacity
          style={styles.emergencyButton}
          activeOpacity={0.85}
        >

          <View style={styles.emergencyIcon}>
            <Text>
              🚨
            </Text>
          </View>

          <View style={styles.emergencyContent}>

            <Text style={styles.emergencyTitle}>
              Need immediate help?
            </Text>

            <Text style={styles.emergencySubtitle}>
              Open emergency options
            </Text>

          </View>

          <Text style={styles.emergencyArrow}>
            ›
          </Text>

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


  /* HEADER */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },

  headerText: {
    flex: 1,
  },

  smallLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#B87894",
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
  },

  moonCircle: {
    width: 52,
    height: 52,
    borderRadius: 19,
    backgroundColor: "#EEE8FA",
    justifyContent: "center",
    alignItems: "center",
  },

  moon: {
    fontSize: 27,
  },


  /* NIGHT MODE */

  modeCard: {
    backgroundColor: "#302743",
    borderRadius: 23,
    padding: 18,
    marginBottom: 27,
  },

  modeTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  modeIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#45385C",
    justifyContent: "center",
    alignItems: "center",
  },

  modeEmoji: {
    fontSize: 27,
  },

  modeInfo: {
    flex: 1,
    marginLeft: 13,
  },

  modeTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  modeDescription: {
    fontSize: 10,
    color: "#C9C0D2",
    marginTop: 4,
    lineHeight: 15,
  },

  modeDivider: {
    height: 1,
    backgroundColor: "#514563",
    marginVertical: 16,
  },

  activeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  activeIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },

  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
  },

  activeText: {
    fontSize: 10,
    color: "#E2DCE8",
    fontWeight: "700",
  },

  timeText: {
    fontSize: 9,
    color: "#AAA0B5",
  },


  /* SECTIONS */

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#292235",
    marginBottom: 13,
  },


  /* STATUS */

  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#F0E5EC",
    marginBottom: 27,
  },

  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },

  statusIconPink: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#FCEAF1",
    justifyContent: "center",
    alignItems: "center",
  },

  statusIconPurple: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#EEE8FA",
    justifyContent: "center",
    alignItems: "center",
  },

  statusIconBlue: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#E5F0FA",
    justifyContent: "center",
    alignItems: "center",
  },

  statusInfo: {
    flex: 1,
    marginLeft: 12,
  },

  statusTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#302735",
  },

  statusSubtitle: {
    fontSize: 9,
    color: "#968C99",
    marginTop: 4,
  },

  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EAF8F0",
    justifyContent: "center",
    alignItems: "center",
  },

  check: {
    color: "#3AAA6A",
    fontWeight: "900",
    fontSize: 12,
  },

  statusDivider: {
    height: 1,
    backgroundColor: "#F1E9ED",
  },


  /* SAFE WALK */

  safeWalkCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#F0E5EC",
  },

  safeWalkIcon: {
    width: 53,
    height: 53,
    borderRadius: 17,
    backgroundColor: "#FCEAF1",
    justifyContent: "center",
    alignItems: "center",
  },

  walkEmoji: {
    fontSize: 27,
  },

  safeWalkContent: {
    flex: 1,
    marginLeft: 12,
  },

  safeWalkTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#302735",
  },

  safeWalkText: {
    fontSize: 9,
    color: "#968C99",
    lineHeight: 14,
    marginTop: 4,
  },

  arrow: {
    fontSize: 27,
    color: "#B0A5B0",
  },


  /* AI */

  aiCard: {
    backgroundColor: "#F3ECF8",
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 27,
    borderWidth: 1,
    borderColor: "#E8DDF0",
  },

  aiIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  aiEmoji: {
    fontSize: 21,
  },

  aiContent: {
    flex: 1,
    marginLeft: 11,
  },

  aiTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  aiTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#604B67",
  },

  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5F7EC",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 7,
    marginLeft: 7,
  },

  aiDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#3AAA6A",
    marginRight: 4,
  },

  aiBadgeText: {
    fontSize: 7,
    fontWeight: "900",
    color: "#31935D",
  },

  aiText: {
    fontSize: 9,
    color: "#887B8D",
    lineHeight: 14,
    marginTop: 4,
  },


  /* TIPS */

  tipsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#F0E5EC",
  },

  tip: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 7,
  },

  tipEmoji: {
    width: 35,
    fontSize: 17,
  },

  tipText: {
    flex: 1,
    fontSize: 10,
    color: "#716673",
    lineHeight: 15,
  },


  /* EMERGENCY */

  emergencyButton: {
    backgroundColor: "#FCEAF1",
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
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

  emergencySubtitle: {
    fontSize: 9,
    color: "#9A7888",
    marginTop: 3,
  },

  emergencyArrow: {
    fontSize: 26,
    color: "#C77A98",
  },


  /* LOADING */

  loadingText: {
    color: "#958B98",
  },

});