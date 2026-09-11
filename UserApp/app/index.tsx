import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function StartScreen() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    try {
      const value = await AsyncStorage.getItem("isLoggedIn");

      console.log("LOGIN STATUS:", value);

      setLoggedIn(value === "true");
    } catch (error) {
      console.log("Error checking login:", error);
      setLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.logo}>🛡️</Text>

        <Text style={styles.title}>SafeHer</Text>

        <Text style={styles.subtitle}>
          Keeping you safe, wherever you go.
        </Text>

        <ActivityIndicator
          size="small"
          color="#D05D83"
          style={styles.loader}
        />
      </View>
    );
  }

  if (loggedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#FFF8FC",
    justifyContent: "center",
    alignItems: "center",
  },

  logo: {
    fontSize: 55,
    marginBottom: 10,
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#D05D83",
  },

  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#8A7A82",
  },

  loader: {
    marginTop: 25,
  },
});