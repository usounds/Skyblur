"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            // 既存のService Workerを解除してから再登録（キャッシュクリアのため）
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (const registration of registrations) {
                    registration.unregister();
                }
            }).then(() => {
                navigator.serviceWorker
                    .register("/sw.js")
                    .then((registration) => {
                        console.log("Service Worker registered with scope:", registration.scope);
                    })
                    .catch((error) => {
                        console.error("Service Worker registration failed:", error);
                    });
            });
        }
    }, []);

    return null;
}
