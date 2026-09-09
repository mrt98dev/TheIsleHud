import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { MenuWindow } from "./MenuWindow";
import { RadarWindow } from "./RadarWindow";
import "./styles.css";

const hash = window.location.hash.replace(/^#/, "");
const isRadar = hash.startsWith("radar");
const isMenu = hash.startsWith("menu");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isRadar ? <RadarWindow /> : isMenu ? <MenuWindow /> : <App />}</React.StrictMode>,
);
