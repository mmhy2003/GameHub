"use client";
import { useEffect } from "react";
import * as Swetrix from "swetrix";

export default function SwetrixAnalytics() {
  useEffect(() => {
    Swetrix.init("vXH8q8DIzoMV", {
      apiURL: "https://swetrixapi.megoo.dev/log",
    });
    Swetrix.trackViews();
    Swetrix.trackErrors();
  }, []);

  return null;
}
