/**
 * SOSButton.jsx — Persistent Floating SOS Action Button
 * ======================================================
 *
 * Features:
 *   • Always-visible floating overlay (highest Z-index)
 *   • One-tap immediate dispatch with visual + haptic feedback
 *   • Hold-to-cancel safeguard (3-second countdown)
 *   • Pulsing animation in HIGH_RISK state
 *   • Real-time WebSocket connection to backend alerts
 *   • GPS location capture on trigger
 *
 * Author: SIH Women Safety Team
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Platform,
  Vibration,
  Alert,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

// ─── Configuration ─────────────────────────────────────────────────────────

// TODO: Replace with your actual backend server IP before deployment
const SERVER_IP = '172.23.79.101';
const SERVER_PORT = '8000';
const API_BASE = `http://${SERVER_IP}:${SERVER_PORT}`;
const SOS_ENDPOINT = `${API_BASE}/api/v1/sos`;
const SOS_CONFIRM_ENDPOINT = `${API_BASE}/api/v1/sos/confirm`;
const SOS_DISMISS_ENDPOINT = `${API_BASE}/api/v1/sos/dismiss`;
const WS_ENDPOINT = `ws://${SERVER_IP}:${SERVER_PORT}/ws/alerts`;
const CANCEL_HOLD_MS = 3000;         // 3-second hold to cancel
const DEVICE_ID = 'mobile-device-001'; // Replace with actual device ID
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Threat State Colors ───────────────────────────────────────────────────

const STATE_COLORS = {
  SAFE: '#10B981', // emerald
  MONITORING: '#F59E0B', // amber
  ELEVATED: '#F97316', // orange
  HIGH_RISK_SURROUNDED: '#EF4444', // red
  SOS_ACTIVE: '#DC2626', // deep red
  SOS_SENT: '#7C3AED', // violet (confirmation)
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function SOSButton() {
  // ── State ────────────────────────────────────────────────────────────
  const [sosState, setSosState] = useState('IDLE');
  // IDLE | PRESSING | COUNTDOWN | DISPATCHING | SENT | COOLDOWN
  const [threatState, setThreatState] = useState('SAFE');
  const [countdown, setCountdown] = useState(3);
  const [alertMessage, setAlertMessage] = useState(null);

  // ── SOS Prompt Modal State ────────────────────────────────────────
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptData, setPromptData] = useState(null);
  const [promptCountdown, setPromptCountdown] = useState(30);

  // ── Refs ─────────────────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const countdownTimer = useRef(null);
  const promptTimer = useRef(null);
  const pressStartTime = useRef(0);
  const wsRef = useRef(null);
  const heartbeatRef = useRef(null);
  const isMounted = useRef(true);

  // ── WebSocket: receive real-time threat updates from backend ─────────
  useEffect(() => {
    isMounted.current = true;
    connectWebSocket();

    return () => {
      isMounted.current = false;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket(WS_ENDPOINT);

      ws.onopen = () => {
        console.log('[WS] Connected to alert stream');
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          } else {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle SOS_PROMPT from CV pipeline
          if (data.type === 'SOS_PROMPT') {
            handleSOSPrompt(data);
            return;
          }

          // Handle AUTO_SOS notification
          if (data.source === 'AUTO_SOS') {
            setAlertMessage('🚨 Auto-SOS dispatched — help is on the way');
            triggerWarningHaptic();
            setTimeout(() => setAlertMessage(null), 8000);
            return;
          }

          if (data.threat_state) {
            setThreatState(data.threat_state);
          }
          if (data.source === 'CV_PIPELINE' && data.threat_state === 'HIGH_RISK_SURROUNDED') {
            setAlertMessage('⚠️ Threat detected nearby');
            triggerWarningHaptic();
            setTimeout(() => setAlertMessage(null), 5000);
          }
        } catch (e) {
          // pong or non-JSON message
        }
      };

      ws.onerror = (error) => {
        console.warn('[WS] Error:', error.message);
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected. Reconnecting in 5s...');
        setTimeout(() => {
          if (isMounted.current) connectWebSocket();
        }, 5000);
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('[WS] Connection failed:', e);
    }
  }, []);

  // ── Pulse animation (active during HIGH_RISK) ───────────────────────
  useEffect(() => {
    if (threatState === 'HIGH_RISK_SURROUNDED' || sosState === 'PRESSING') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [threatState, sosState]);

  // ── Glow animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (sosState === 'PRESSING' || sosState === 'COUNTDOWN') {
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [sosState]);

  // ─── Haptic Feedback ────────────────────────────────────────────────

  const triggerTapHaptic = async () => {
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      Vibration.vibrate(50);
    }
  };

  const triggerWarningHaptic = async () => {
    if (Platform.OS === 'ios') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Vibration.vibrate([0, 100, 50, 100, 50, 200]);
    }
  };

  const triggerSuccessHaptic = async () => {
    if (Platform.OS === 'ios') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Vibration.vibrate([0, 50, 100, 50]);
    }
  };

  // ─── SOS Prompt Handling ──────────────────────────────────────────

  const handleSOSPrompt = (data) => {
    setPromptData(data);
    setPromptCountdown(data.auto_confirm_seconds || 30);
    setShowPromptModal(true);

    // Alarm-pattern vibration
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Vibration.vibrate([0, 300, 100, 300, 100, 500, 200, 300, 100, 300]);
    }

    // Start auto-confirm countdown
    let remaining = data.auto_confirm_seconds || 30;
    promptTimer.current = setInterval(() => {
      remaining -= 1;
      setPromptCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(promptTimer.current);
        promptTimer.current = null;
        confirmSOS(data.prompt_id);
      } else if (remaining <= 10) {
        // Escalating haptic in last 10 seconds
        triggerTapHaptic();
      }
    }, 1000);
  };

  const confirmSOS = async (promptId) => {
    if (promptTimer.current) {
      clearInterval(promptTimer.current);
      promptTimer.current = null;
    }
    setShowPromptModal(false);
    setPromptData(null);

    const { lat, lon } = await getCurrentLocation();

    try {
      const response = await fetch(SOS_CONFIRM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_id: promptId,
          device_id: DEVICE_ID,
          gps_lat: lat,
          gps_lon: lon,
        }),
      });

      if (response.ok) {
        triggerSuccessHaptic();
        setAlertMessage('🆘 SOS Confirmed — Help is on the way');
        setTimeout(() => setAlertMessage(null), 5000);
      } else {
        throw new Error('Confirm failed');
      }
    } catch (error) {
      console.error('SOS confirm error:', error);
      Alert.alert(
        'SOS Confirm Failed',
        'Could not confirm SOS. Please use the manual SOS button or call emergency services.',
        [{ text: 'OK' }]
      );
    }
  };

  const dismissSOS = async (promptId) => {
    if (promptTimer.current) {
      clearInterval(promptTimer.current);
      promptTimer.current = null;
    }
    setShowPromptModal(false);
    setPromptData(null);

    try {
      await fetch(SOS_DISMISS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_id: promptId,
          device_id: DEVICE_ID,
          reason: 'User indicated they are safe',
        }),
      });
      setAlertMessage('✅ Dismissed — Stay safe!');
      setTimeout(() => setAlertMessage(null), 3000);
    } catch (error) {
      console.error('SOS dismiss error:', error);
    }
  };

  // ─── GPS Location ─────────────────────────────────────────────────

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission denied');
        return { lat: null, lon: null };
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return { lat: loc.coords.latitude, lon: loc.coords.longitude };
    } catch (e) {
      console.error('Location error:', e);
      return { lat: null, lon: null };
    }
  };

  // ─── SOS Dispatch ─────────────────────────────────────────────────

  const dispatchSOS = async () => {
    setSosState('DISPATCHING');

    const { lat, lon } = await getCurrentLocation();

    try {
      const response = await fetch(SOS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: DEVICE_ID,
          gps_lat: lat,
          gps_lon: lon,
          message: 'SOS triggered by user',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSosState('SENT');
        triggerSuccessHaptic();
        setAlertMessage(`🆘 SOS Sent — Help is on the way`);

        // Reset after 5 seconds
        setTimeout(() => {
          if (isMounted.current) {
            setSosState('IDLE');
            setAlertMessage(null);
          }
        }, 5000);
      } else {
        throw new Error(data.detail || 'Dispatch failed');
      }
    } catch (error) {
      console.error('SOS dispatch error:', error);
      setSosState('IDLE');
      Alert.alert(
        'SOS Failed',
        'Could not reach safety dispatch. Please call emergency services directly.',
        [{ text: 'OK' }]
      );
    }
  };

  // ─── Press Handlers ───────────────────────────────────────────────

  const onPressIn = () => {
    pressStartTime.current = Date.now();
    setSosState('PRESSING');
    triggerTapHaptic();

    // Scale down animation
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    const pressDuration = Date.now() - pressStartTime.current;

    // Cancel any running countdown
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }

    // Scale back
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();

    if (sosState === 'COUNTDOWN') {
      // User released during countdown — this is a CANCEL
      setSosState('IDLE');
      setCountdown(3);
      setAlertMessage('SOS Cancelled');
      setTimeout(() => setAlertMessage(null), 2000);
      return;
    }

    if (pressDuration < 200) {
      // Quick tap — initiate countdown
      startCountdown();
    } else {
      setSosState('IDLE');
    }
  };

  const startCountdown = () => {
    setSosState('COUNTDOWN');
    setCountdown(3);
    triggerWarningHaptic();

    let remaining = 3;
    countdownTimer.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(countdownTimer.current);
        countdownTimer.current = null;
        dispatchSOS();
      } else {
        triggerTapHaptic();
      }
    }, 1000);
  };

  // ─── Render ───────────────────────────────────────────────────────

  const buttonColor =
    sosState === 'SENT' ? STATE_COLORS.SOS_SENT :
      sosState === 'COUNTDOWN' ? STATE_COLORS.SOS_ACTIVE :
        sosState === 'PRESSING' ? STATE_COLORS.HIGH_RISK_SURROUNDED :
          STATE_COLORS[threatState] || STATE_COLORS.SAFE;

  const glowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 25],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const buttonLabel =
    sosState === 'COUNTDOWN' ? `${countdown}` :
      sosState === 'DISPATCHING' ? '...' :
        sosState === 'SENT' ? '✓' :
          'SOS';

  const sublabel =
    sosState === 'COUNTDOWN' ? 'HOLD TO CANCEL' :
      sosState === 'DISPATCHING' ? 'SENDING' :
        sosState === 'SENT' ? 'HELP COMING' :
          sosState === 'PRESSING' ? 'RELEASE TO SEND' :
            threatState === 'HIGH_RISK_SURROUNDED' ? '⚠ THREAT DETECTED' :
              'TAP FOR HELP';

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* ── Alert Banner ─────────────────────────────────────────── */}
      {alertMessage && (
        <Animated.View style={[styles.alertBanner, { backgroundColor: buttonColor }]}>
          <Text style={styles.alertText}>{alertMessage}</Text>
        </Animated.View>
      )}

      {/* ── Threat State Indicator ───────────────────────────────── */}
      <View style={[styles.stateChip, { backgroundColor: buttonColor + '30' }]}>
        <View style={[styles.stateDot, { backgroundColor: buttonColor }]} />
        <Text style={[styles.stateText, { color: buttonColor }]}>
          {threatState.replace(/_/g, ' ')}
        </Text>
      </View>

      {/* ── Glow Ring ────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            shadowColor: buttonColor,
            shadowRadius: glowRadius,
            shadowOpacity: glowOpacity,
            borderColor: buttonColor + '40',
          },
        ]}
      />

      {/* ── Main SOS Button ──────────────────────────────────────── */}
      <TouchableWithoutFeedback
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={sosState === 'DISPATCHING' || sosState === 'SENT'}
      >
        <Animated.View
          style={[
            styles.sosButton,
            {
              backgroundColor: buttonColor,
              transform: [
                { scale: Animated.multiply(pulseAnim, scaleAnim) },
              ],
            },
          ]}
        >
          {/* Inner rings for depth */}
          <View style={[styles.innerRing, { borderColor: 'rgba(255,255,255,0.2)' }]}>
            <View style={[styles.innerCore, { borderColor: 'rgba(255,255,255,0.15)' }]}>
              <Text style={styles.sosLabel}>{buttonLabel}</Text>
            </View>
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>

      {/* ── Sub-label ────────────────────────────────────────────── */}
      <Text style={[styles.sublabel, { color: buttonColor }]}>{sublabel}</Text>

      {/* ── SOS Prompt Confirmation Modal ─────────────────────────── */}
      {showPromptModal && promptData && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalEmoji}>⚠️</Text>
              <Text style={styles.modalTitle}>Threat Detected</Text>
            </View>

            {/* Threat Details */}
            <View style={styles.modalBody}>
              <Text style={styles.modalMessage}>
                {promptData.message || 'A potential threat has been detected near you.'}
              </Text>

              <View style={styles.threatDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Threat Score</Text>
                  <Text style={[
                    styles.detailValue,
                    { color: promptData.threat_score >= 0.8 ? '#EF4444' : '#F59E0B' }
                  ]}>
                    {(promptData.threat_score * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nearby Threats</Text>
                  <Text style={styles.detailValue}>
                    {promptData.nearby_men_count || 0} detected
                  </Text>
                </View>
              </View>

              {/* Auto-confirm countdown */}
              <Text style={styles.autoConfirmText}>
                Auto-confirming in {promptCountdown}s
              </Text>

              {/* Progress bar */}
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${((promptData.auto_confirm_seconds - promptCountdown) / promptData.auto_confirm_seconds) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableWithoutFeedback onPress={() => confirmSOS(promptData.prompt_id)}>
                <View style={styles.confirmButton}>
                  <Text style={styles.confirmButtonText}>🆘 CONFIRM SOS</Text>
                </View>
              </TouchableWithoutFeedback>

              <TouchableWithoutFeedback onPress={() => dismissSOS(promptData.prompt_id)}>
                <View style={styles.dismissButton}>
                  <Text style={styles.dismissButtonText}>✅ I'M SAFE</Text>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const SOS_SIZE = 80;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999, // Android
  },

  alertBanner: {
    position: 'absolute',
    bottom: SOS_SIZE + 100,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },

  alertText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  stateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },

  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  stateText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  glowRing: {
    position: 'absolute',
    bottom: 28,
    width: SOS_SIZE + 30,
    height: SOS_SIZE + 30,
    borderRadius: (SOS_SIZE + 30) / 2,
    borderWidth: 2,
  },

  sosButton: {
    width: SOS_SIZE,
    height: SOS_SIZE,
    borderRadius: SOS_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 20,
  },

  innerRing: {
    width: SOS_SIZE - 10,
    height: SOS_SIZE - 10,
    borderRadius: (SOS_SIZE - 10) / 2,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  innerCore: {
    width: SOS_SIZE - 22,
    height: SOS_SIZE - 22,
    borderRadius: (SOS_SIZE - 22) / 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sosLabel: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  sublabel: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ─── SOS Prompt Modal Styles ─────────────────────────────────────

  modalOverlay: {
    position: 'absolute',
    top: -SCREEN_H,
    left: -SCREEN_W + 20,
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
    elevation: 999999,
  },

  modalCard: {
    width: SCREEN_W * 0.88,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 30,
  },

  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },

  modalEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },

  modalTitle: {
    color: '#EF4444',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  modalBody: {
    marginBottom: 24,
  },

  modalMessage: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },

  threatDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },

  detailLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },

  detailValue: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '700',
  },

  autoConfirmText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },

  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },

  progressBarFill: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },

  modalActions: {
    gap: 12,
  },

  confirmButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },

  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },

  dismissButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },

  dismissButtonText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
