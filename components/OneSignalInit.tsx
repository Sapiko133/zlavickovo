"use client";

import { useEffect } from "react";

export default function OneSignalInit() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId) return;

    const load = () => {
      import("react-onesignal")
        .then(({ default: OneSignal }) => {
          OneSignal.init({
            appId,
            allowLocalhostAsSecureOrigin: true,
          }).catch(() => {});
        })
        .catch(() => {});
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(load, { timeout: 5000 });
    } else {
      setTimeout(load, 3000);
    }
  }, []);
  return null;
}
