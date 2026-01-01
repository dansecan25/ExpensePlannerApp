// src/views/MenuScreens.js
import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import MainScreen from "./MainScreen";
import SettingsScreen from "./Settings.js";
import CustomText from "../components/customText/customText.js";

export default function MenuScreens({ navigation }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState("MAIN");

  const renderScreen = () => {
    switch (activeScreen) {
      case "SETTINGS":
        return <SettingsScreen />;
      case "MAIN":
      default:
        return <MainScreen navigation={navigation} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={styles.menuButton}
        >
            <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>

        {/* Spacer to keep title centered */}
        <View style={{ width: 32 }} />
    </View>


      {/* CONTENT */}
      <ScrollView style={styles.content}>
        {renderScreen()}
      </ScrollView>

      {/* DRAWER OVERLAY */}
      {drawerOpen && (
        <View style={styles.overlay}>
            {/* DRAWER FIRST (LEFT) */}
            <View style={styles.drawer}>
                <CustomText
                    style={{color:"black",marginBottom:20}}
                    type="header3"
                    text="Menu"
                />

                <TouchableOpacity
                    style={styles.drawerItem}
                    onPress={() => {
                        setActiveScreen("MAIN");
                        setDrawerOpen(false);
                    }}
                >
                    <CustomText
                        style={{color:"black"}}
                        type="body3"
                        text="Home"
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.drawerItem}
                    onPress={() => {
                    setActiveScreen("SETTINGS");
                    setDrawerOpen(false);
                    }}
                >
                    <CustomText
                        style={{color:"black"}}
                        type="body3"
                        text="Settings"
                    />
                </TouchableOpacity>
            </View>

            {/* BACKDROP */}
            <TouchableOpacity
            style={styles.overlayBackground}
            onPress={() => setDrawerOpen(false)}
            />
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },

  menuButton: {
    padding: 0,
  },

  menuIcon: {
    fontSize: 22,
  },

  content: {
    flex: 1,
  },

  /* Drawer */
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
 },

  overlayBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },

    drawer: {
        paddingTop:40,
        width: 200,
        backgroundColor: "#ffffff",
        padding: 20,
        elevation: 10,
    },


    drawerTitle: {
        fontSize: 18,
        marginBottom: 20,
    },

  drawerItem: {
    paddingVertical: 12,
  },
});

