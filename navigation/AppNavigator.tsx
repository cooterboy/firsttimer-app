import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import TabBar from "../components/TabBar";
import TodayScreen from "../screens/TodayScreen";
import ProgressScreen from "../screens/ProgressScreen";
import YouScreen from "../screens/YouScreen";
import AccountScreen from "../screens/AccountScreen";
import SettingsScreen from "../screens/SettingsScreen";
import TrainingPreferencesScreen from "../screens/TrainingPreferencesScreen";
import BackfillScreen from "../screens/BackfillScreen";
import PrivacyScreen from "../screens/PrivacyScreen";
import TermsScreen from "../screens/TermsScreen";
import HelpScreen from "../screens/HelpScreen";
import AboutScreen from "../screens/AboutScreen";
import ProgramsScreen from "../screens/ProgramsScreen";
import FirstDayScreen from "../screens/FirstDayScreen";
import ShopScreen from "../screens/ShopScreen";
import FindGymScreen from "../screens/FindGymScreen";
import RecoveryScreen from "../screens/RecoveryScreen";
import FriendsScreen from "../screens/FriendsScreen";
import ConnectedAccountsScreen from "../screens/ConnectedAccountsScreen";
import PurchasesScreen from "../screens/PurchasesScreen";
import PlansScreen from "../screens/PlansScreen";

const Tab = createBottomTabNavigator();
const TodayStack = createNativeStackNavigator();
const ProgressStack = createNativeStackNavigator();
const ProgramsStack = createNativeStackNavigator();
const ShopStack = createNativeStackNavigator();
const YouStack = createNativeStackNavigator();

// Each tab gets its own stack so later "push" screens (Account, Settings,
// a past session's detail) slide in natively without leaving the tab.
function TodayStackScreen() {
  return (
    <TodayStack.Navigator screenOptions={{ headerShown: false }}>
      <TodayStack.Screen name="TodayRoot" component={TodayScreen} />
    </TodayStack.Navigator>
  );
}
function ProgressStackScreen() {
  return (
    <ProgressStack.Navigator screenOptions={{ headerShown: false }}>
      <ProgressStack.Screen name="ProgressRoot" component={ProgressScreen} />
      <ProgressStack.Screen name="Backfill" component={BackfillScreen} options={{ presentation: "card" }} />
    </ProgressStack.Navigator>
  );
}
function ProgramsStackScreen() {
  return (
    <ProgramsStack.Navigator screenOptions={{ headerShown: false }}>
      <ProgramsStack.Screen name="ProgramsRoot" component={ProgramsScreen} />
      <ProgramsStack.Screen name="FirstDay" component={FirstDayScreen} options={{ presentation: "card" }} />
      <ProgramsStack.Screen name="Plans" component={PlansScreen} options={{ presentation: "card" }} />
    </ProgramsStack.Navigator>
  );
}
function ShopStackScreen() {
  return (
    <ShopStack.Navigator screenOptions={{ headerShown: false }}>
      <ShopStack.Screen name="ShopRoot" component={ShopScreen} />
      <ShopStack.Screen name="FindGym" component={FindGymScreen} options={{ presentation: "card" }} />
      <ShopStack.Screen name="Recovery" component={RecoveryScreen} options={{ presentation: "card" }} />
    </ShopStack.Navigator>
  );
}
function YouStackScreen() {
  return (
    <YouStack.Navigator screenOptions={{ headerShown: false }}>
      <YouStack.Screen name="YouRoot" component={YouScreen} />
      <YouStack.Screen name="Account" component={AccountScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="Settings" component={SettingsScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="TrainingPreferences" component={TrainingPreferencesScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="Privacy" component={PrivacyScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="Terms" component={TermsScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="Help" component={HelpScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="About" component={AboutScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="FirstDay" component={FirstDayScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="FindGym" component={FindGymScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="Recovery" component={RecoveryScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="Friends" component={FriendsScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="ConnectedAccounts" component={ConnectedAccountsScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="Purchases" component={PurchasesScreen} options={{ presentation: "card" }} />
      <YouStack.Screen name="Plans" component={PlansScreen} options={{ presentation: "card" }} />
    </YouStack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Today" component={TodayStackScreen} />
      <Tab.Screen name="Progress" component={ProgressStackScreen} />
      <Tab.Screen name="Programs" component={ProgramsStackScreen} />
      <Tab.Screen name="Shop" component={ShopStackScreen} />
      <Tab.Screen name="You" component={YouStackScreen} />
    </Tab.Navigator>
  );
}
