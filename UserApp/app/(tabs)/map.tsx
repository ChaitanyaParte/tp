import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import MapView, {
  Marker,
  Circle,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import * as Location from "expo-location";
import { API_BASE } from "../../constants/api";

interface Hotspot {
  location_id: number;
  location: string;
  alert_count: number;
  risk_score: number;
  risk_level: string;
  latitude?: number;
  longitude?: number;
}

export default function MapScreen() {
  const [location, setLocation] =
    useState<Location.LocationObject | null>(null);

  const [permissionDenied, setPermissionDenied] =
    useState(false);

  const [hotspots, setHotspots] = useState<Hotspot[]>([]);

  useEffect(() => {
    getLocation();
    fetchHotspots();
  }, []);

  const getLocation = async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setPermissionDenied(true);
        return;
      }

      const currentLocation =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      setLocation(currentLocation);
    } catch (error) {
      console.log("Location error:", error);
    }
  };

  const fetchHotspots = async () => {
    try {
      const res = await fetch(`${API_BASE}/hotspots`);
      const data = await res.json();
      setHotspots(data);
    } catch (e) {
      console.error('Hotspots fetch failed:', e);
    }
  };

  function hotspotColor(risk_level: string) {
    switch (risk_level?.toUpperCase()) {
      case 'HIGH': return '#EF4444';
      case 'MEDIUM': return '#F59E0B';
      default: return '#35BE70';
    }
  }

  // Loading screen
  if (!location && !permissionDenied) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Text style={styles.loadingEmoji}>📍</Text>
        </View>

        <Text style={styles.loadingTitle}>
          Finding your location
        </Text>

        <Text style={styles.loadingText}>
          Getting your current position for the safety map...
        </Text>

        <ActivityIndicator
          size="small"
          style={{ marginTop: 20 }}
        />
      </View>
    );
  }

  // Permission screen
  if (permissionDenied) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Text style={styles.loadingEmoji}>📍</Text>
        </View>

        <Text style={styles.loadingTitle}>
          Location access needed
        </Text>

        <Text style={styles.loadingText}>
          Allow location access to use your live safety map.
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={getLocation}
        >
          <Text style={styles.retryText}>
            Allow Location
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const latitude = location!.coords.latitude;
  const longitude = location!.coords.longitude;

  return (
    <View style={styles.container}>

      {/* ================= HEADER ================= */}

      <SafeAreaView style={styles.headerWrapper}>
        <View style={styles.header}>

          <View>
            <Text style={styles.title}>
              Safety Map 🗺️
            </Text>

            <Text style={styles.subtitle}>
              Stay aware. Stay protected.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.locationButton}
            onPress={getLocation}
          >
            <Text style={styles.locationIcon}>
              📍
            </Text>
          </TouchableOpacity>

        </View>
      </SafeAreaView>


      {/* ================= MAP ================= */}

      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        showsBuildings={true}
        showsTraffic={false}
      >

        {/* YOUR LOCATION */}
        <Marker
          coordinate={{ latitude, longitude }}
          title="You are here"
          description="Your current location"
        />

        {/* SAFE AREA CIRCLE */}
        <Circle
          center={{ latitude, longitude }}
          radius={350}
          strokeWidth={1}
          strokeColor="rgba(53, 190, 112, 0.5)"
          fillColor="rgba(53, 190, 112, 0.08)"
        />

        {/* HOTSPOT MARKERS FROM BACKEND */}
        {hotspots.map((h) =>
          h.latitude && h.longitude ? (
            <Marker
              key={h.location_id}
              coordinate={{ latitude: h.latitude, longitude: h.longitude }}
              title={h.location}
              description={`Risk: ${h.risk_level} · Alerts: ${h.alert_count}`}
              pinColor={hotspotColor(h.risk_level)}
            />
          ) : null
        )}

      </MapView>


      {/* ================= MAP CONTROLS ================= */}

      <View style={styles.mapControls}>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={getLocation}
        >
          <Text style={styles.controlIcon}>◎</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton}>
          <Text style={styles.controlIcon}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton}>
          <Text style={styles.controlIcon}>−</Text>
        </TouchableOpacity>

      </View>


      {/* ================= SAFETY STATUS ================= */}

      <View style={styles.statusCard}>

        <View style={styles.statusIconContainer}>
          <Text style={styles.statusIcon}>🛡️</Text>
        </View>

        <View style={styles.statusContent}>

          <View style={styles.statusTitleRow}>

            <Text style={styles.statusTitle}>
              You're Safe
            </Text>

            <View style={styles.safeBadge}>
              <View style={styles.greenDot} />
              <Text style={styles.safeText}>LOW RISK</Text>
            </View>

          </View>

          <Text style={styles.statusDescription}>
            {hotspots.length > 0
              ? `${hotspots.length} location${hotspots.length > 1 ? 's' : ''} monitored nearby.`
              : 'No active safety alerts detected nearby.'}
          </Text>

        </View>

      </View>


      {/* ================= LEGEND ================= */}

      <View style={styles.legendCard}>

        <Text style={styles.legendTitle}>
          Safety Zones
        </Text>

        <View style={styles.legendRow}>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#35BE70" }]} />
            <Text style={styles.legendText}>Safe</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#F5B83D" }]} />
            <Text style={styles.legendText}>Caution</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#EF5350" }]} />
            <Text style={styles.legendText}>Alert</Text>
          </View>

        </View>

      </View>

    </View>
  );
}


const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#F8F7FC",
  },

  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  header: {
    marginTop: 8,
    marginHorizontal: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#292235",
  },

  subtitle: {
    fontSize: 11,
    color: "#938A98",
    marginTop: 3,
  },

  locationButton: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#FCEAF2",
    justifyContent: "center",
    alignItems: "center",
  },

  locationIcon: {
    fontSize: 20,
  },

  map: {
    flex: 1,
  },

  mapControls: {
    position: "absolute",
    right: 18,
    top: 170,
    gap: 10,
  },

  controlButton: {
    width: 44,
    height: 44,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },

  controlIcon: {
    fontSize: 24,
    fontWeight: "500",
    color: "#4B4253",
  },

  statusCard: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },

  statusIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "#E9F8F0",
    justifyContent: "center",
    alignItems: "center",
  },

  statusIcon: {
    fontSize: 24,
  },

  statusContent: {
    flex: 1,
    marginLeft: 12,
  },

  statusTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  statusTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#292235",
  },

  safeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E9F8F0",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },

  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#35BE70",
    marginRight: 5,
  },

  safeText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#35A968",
  },

  statusDescription: {
    fontSize: 10,
    color: "#8D8591",
    marginTop: 5,
  },

  legendCard: {
    position: "absolute",
    left: 18,
    bottom: 30,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 11,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },

  legendTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#514856",
    marginBottom: 7,
  },

  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },

  legendText: {
    fontSize: 9,
    color: "#77707A",
    fontWeight: "600",
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#FFF8FC",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },

  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: "#FCEAF2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  loadingEmoji: {
    fontSize: 38,
  },

  loadingTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#292235",
  },

  loadingText: {
    fontSize: 12,
    color: "#8D8591",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },

  retryButton: {
    marginTop: 22,
    backgroundColor: "#D05D83",
    paddingHorizontal: 25,
    paddingVertical: 13,
    borderRadius: 15,
  },

  retryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

});