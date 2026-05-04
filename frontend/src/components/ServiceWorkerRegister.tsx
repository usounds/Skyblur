"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (navigator.webdriver) return;

        /* istanbul ignore next -- Playwright exposes serviceWorker; the false branch is browser capability fallback. */
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
                        if (!registration) return;
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
