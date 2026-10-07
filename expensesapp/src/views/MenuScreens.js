import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomText from "../components/customText/customText.js";
import HomeScreen from "./menu screen/Home";
import AccountsScreen from "./menu screen/Accounts";
import ExpenseGroupsScreen from "./menu screen/Expenses by groups";
import MoneyVariationsScreen from "./menu screen/Money variations";
import SubscriptionsScreen from "./menu screen/Subscriptions";
import BalanceScreen from "./menu screen/Balance";
import SavingsMovementsScreen from "./menu screen/Savings Movements";
import SettingsScreen from "./menu screen/Settings";

const menuOptions = [
  { id: "HOME", label: "Home" },
  { id: "ACCOUNTS", label: "Accounts" },
  { id: "GROUPS", label: "Expenses by groups" },
  { id: "VARIATIONS", label: "Money variations" },
  { id: "SUBSCRIPTIONS", label: "Subscriptions" },
  { id: "BALANCE", label: "Balance" },
  { id: "SAVINGS_MOVEMENTS", label: "Savings Movements" },
  { id: "SETTINGS", label: "Settings" },
];

function MenuIcon() {
  return (
    <View style={styles.menuIcon} accessible={false}>
      <View style={styles.menuIconLine} />
      <View style={styles.menuIconLine} />
      <View style={styles.menuIconLine} />
    </View>
  );
}

export default function MenuScreens({ navigation }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState("HOME");

  const selectScreen = screen => {
    setActiveScreen(screen);
    setDrawerOpen(false);
  };

  const renderScreen = () => {
    if (activeScreen === "HOME") {
      return <HomeScreen navigation={navigation} />;
    }

    if (activeScreen === "SETTINGS") {
      return <SettingsScreen navigation={navigation} />;
    }

    if (activeScreen === "ACCOUNTS") {
      return <AccountsScreen />;
    }
    if (activeScreen === "GROUPS") {
      return <ExpenseGroupsScreen />;
    }
    if (activeScreen === "VARIATIONS") {
      return <MoneyVariationsScreen navigation={navigation} />;
    }
    if (activeScreen === "SUBSCRIPTIONS") {
      return <SubscriptionsScreen />;
    }
    if (activeScreen === "BALANCE") {
      return <BalanceScreen />;
    }
    if (activeScreen === "SAVINGS_MOVEMENTS") {
      return <SavingsMovementsScreen navigation={navigation} />;
    }
    return <HomeScreen navigation={navigation} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Open navigation menu"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => setDrawerOpen(true)}
          style={styles.menuButton}
        >
          <MenuIcon />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {renderScreen()}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={drawerOpen}
      >
        <View style={styles.overlay}>
          <SafeAreaView style={styles.drawer}>
            <CustomText
              style={styles.drawerTitle}
              type="header3"
              text="Menu"
            />
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.drawerOptions}
            >
              {menuOptions.map(option => (
                <TouchableOpacity
                  accessibilityRole="button"
                  key={option.id}
                  onPress={() => selectScreen(option.id)}
                  style={[
                    styles.drawerItem,
                    activeScreen === option.id && styles.activeDrawerItem,
                  ]}
                >
                  <CustomText
                    style={styles.drawerItemText}
                    type="body3"
                    text={option.label}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
          <Pressable
            accessibilityLabel="Close navigation menu"
            accessibilityRole="button"
            onPress={() => setDrawerOpen(false)}
            style={styles.overlayBackground}
          />
        </View>
      </Modal>
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
    paddingHorizontal: 16,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: {
    width: 24,
    height: 20,
    justifyContent: "space-between",
  },
  menuIconLine: {
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    flexDirection: "row",
  },
  overlayBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  drawer: {
    width: 280,
    maxWidth: "85%",
    alignSelf: "stretch",
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
  },
  drawerOptions: {
    flex: 1,
  },
  drawerTitle: {
    color: "#000000",
    marginBottom: 20,
  },
  drawerItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  activeDrawerItem: {
    backgroundColor: "#E5E5EA",
  },
  drawerItemText: {
    color: "#000000",
  },
});
