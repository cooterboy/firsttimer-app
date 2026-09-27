import React from "react";
import LegalPage from "../components/LegalPage";
import { TERMS_SECTIONS } from "../lib/legalContent";

export default function TermsScreen() {
  return <LegalPage title="Terms of use" sections={TERMS_SECTIONS} />;
}
