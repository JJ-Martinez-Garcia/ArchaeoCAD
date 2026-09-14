import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ArchaeoCAD from "./app/page";
import "./app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><ArchaeoCAD /></StrictMode>,
);
