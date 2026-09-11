import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";

export default function LoginScreen() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

 const handleContinue = async () => {
  try {
    // Later we will only do this after
    // successful FastAPI authentication.
    await AsyncStorage.setItem("isLoggedIn", "true");

    router.replace("/(tabs)");
  } catch (error) {
    console.log("Login error:", error);
  }
};
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Decorative doodles */}
          <Text style={styles.star}>✦</Text>
          <Text style={styles.sparkle}>✧</Text>
          <Text style={styles.smallStar}>✦</Text>

          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[
                styles.modeText,
                !isSignup && styles.activeMode,
              ]}
            >
              Login
            </Text>

            {/* Switch */}
            <TouchableOpacity
              style={styles.switch}
              onPress={() => setIsSignup(!isSignup)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.switchHandle,
                  isSignup && styles.switchHandleRight,
                ]}
              />
            </TouchableOpacity>

            <Text
              style={[
                styles.modeText,
                isSignup && styles.activeMode,
              ]}
            >
              Sign Up
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Paper lines */}
            <View style={styles.paperLines} />

            <Text style={styles.emoji}>
              {isSignup ? "🌸" : "🛡️"}
            </Text>

            <Text style={styles.title}>
              {isSignup ? "Create Account" : "Welcome Back"}
            </Text>

            <Text style={styles.subtitle}>
              {isSignup
                ? "Let's make your journey safer."
                : "Your safety companion is here."}
            </Text>

            {/* Form */}
            <View style={styles.form}>
              {isSignup && (
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor="#777"
                  value={name}
                  onChangeText={setName}
                />
              )}

              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#777"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#777"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              {!isSignup && (
                <TouchableOpacity>
                  <Text style={styles.forgot}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.mainButton,
                  isSignup && styles.signupButton,
                ]}
                onPress={handleContinue}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>
                  {isSignup ? "CREATE ACCOUNT" : "LOGIN"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bottom text */}
            <View style={styles.bottomArea}>
              <Text style={styles.bottomText}>
                {isSignup
                  ? "Already have an account?"
                  : "Don't have an account?"}
              </Text>

              <TouchableOpacity
                onPress={() => setIsSignup(!isSignup)}
              >
                <Text style={styles.link}>
                  {isSignup ? " Login" : " Sign Up"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            Your privacy and safety matter to us.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  keyboard: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingVertical: 35,
    position: "relative",
  },

  /* Decorative elements */

  star: {
    position: "absolute",
    top: 35,
    left: 25,
    fontSize: 40,
    color: "#FF6B6B",
    transform: [{ rotate: "-15deg" }],
  },

  sparkle: {
    position: "absolute",
    bottom: 90,
    right: 25,
    fontSize: 42,
    color: "#4ECDC4",
    transform: [{ rotate: "10deg" }],
  },

  smallStar: {
    position: "absolute",
    top: 100,
    right: 35,
    fontSize: 25,
    color: "#FFE66D",
  },

  /* Header */

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
  },

  modeText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#323232",
    opacity: 0.45,
  },

  activeMode: {
    opacity: 1,
  },

  switch: {
    width: 55,
    height: 29,
    backgroundColor: "#FFE66D",
    borderWidth: 2,
    borderColor: "#323232",
    borderRadius: 20,
    marginHorizontal: 14,
    justifyContent: "center",
    paddingHorizontal: 3,
    shadowColor: "#323232",
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },

  switchHandle: {
    width: 19,
    height: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#323232",
    borderRadius: 10,
  },

  switchHandleRight: {
    alignSelf: "flex-end",
  },

  /* Card */

  card: {
    width: "100%",
    maxWidth: 360,
    minHeight: 430,
    backgroundColor: "#FFF9E6",
    borderWidth: 2,
    borderColor: "#323232",
    borderRadius: 25,
    paddingHorizontal: 25,
    paddingVertical: 28,
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#323232",
    shadowOffset: {
      width: 5,
      height: 5,
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },

  paperLines: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 80,
    bottom: 0,
    opacity: 0.25,
    borderTopWidth: 1,
    borderColor: "#B5B5B5",
  },

  emoji: {
    fontSize: 45,
    marginBottom: 8,
  },

  title: {
    fontSize: 27,
    fontWeight: "900",
    color: "#323232",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
    transform: [{ rotate: "-2deg" }],
  },

  subtitle: {
    fontSize: 13,
    color: "#555555",
    marginTop: 8,
    marginBottom: 22,
    textAlign: "center",
  },

  /* Form */

  form: {
    width: "100%",
    alignItems: "center",
  },

  input: {
    width: "100%",
    height: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#323232",
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 14,
    fontWeight: "600",
    color: "#323232",
    marginBottom: 13,
    shadowColor: "#323232",
    shadowOffset: {
      width: 3,
      height: 3,
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },

  forgot: {
    alignSelf: "flex-end",
    color: "#2D8CF0",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 5,
  },

  mainButton: {
    width: 150,
    height: 48,
    backgroundColor: "#FF6B6B",
    borderWidth: 2,
    borderColor: "#323232",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
    shadowColor: "#323232",
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    transform: [{ rotate: "-1deg" }],
  },

  signupButton: {
    backgroundColor: "#4ECDC4",
    transform: [{ rotate: "1deg" }],
  },

  buttonText: {
    color: "#323232",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
  },

  /* Bottom */

  bottomArea: {
    flexDirection: "row",
    marginTop: 22,
    alignItems: "center",
  },

  bottomText: {
    fontSize: 12,
    color: "#555555",
  },

  link: {
    fontSize: 12,
    fontWeight: "900",
    color: "#2D8CF0",
  },

  footer: {
    marginTop: 22,
    fontSize: 11,
    color: "#888888",
    textAlign: "center",
  },
});