"use client";

import { useEffect } from "react";

export default function OneSignalInit() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId) return;
    import("react-onesignal")
      .then(({ default: OneSignal }) => {
        OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
        }).catch(() => {});
      })
      .catch(() => {});
  }, []);
  return null;
}
