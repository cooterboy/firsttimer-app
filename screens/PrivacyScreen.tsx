import React from "react";
import LegalPage from "../components/LegalPage";
import { PRIVACY_SECTIONS } from "../lib/legalContent";

export default function PrivacyScreen() {
  return <LegalPage title="Privacy policy" sections={PRIVACY_SECTIONS} />;
}
