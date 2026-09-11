/**
 * App.jsx — Root application with persistent SOS overlay
 * =======================================================
 *
 * The SOSButton is rendered at the root level OUTSIDE of any
 * navigator so it persists across all screens and states.
 *
 * Author: SIH Women Safety Team
 */

import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import SOSButton from './components/SOSButton';

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* ── Your app screens / navigator goes here ──────────────── */}
      <View style={styles.content}>
        {/* <NavigationContainer>...</NavigationContainer> */}
      </View>

      {/* ── Persistent SOS Overlay — always on top ──────────────── */}
      <SOSButton />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
  },
});
