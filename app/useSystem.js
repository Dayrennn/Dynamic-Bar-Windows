"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useSystem() {
    const [media, setMedia] = useState(null);
    const [volume, setVolume] = useState(null);
    const [battery, setBattery] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [hud, setHud] = useState(null); // { type, data }
    const [brightness, setBrightness] = useState(null);
    const lastBrightness = useRef(null);

    const hudTimer = useRef();
    const firstVolume = useRef(true);
    const lastAlert = useRef(100);
    const lastVolume = useRef(null);

    const showHud = useCallback((type, data, ms) => {
        clearTimeout(hudTimer.current);
        setHud({ type, data });
        hudTimer.current = setTimeout(() => setHud(null), ms);
    }, []);

    useEffect(() => {
        const tauri = window.__TAURI__;
        if (!tauri) return;
        let cancelled = false;
        const unlisteners = [];

        const on = async (name, handler) => {
            const un = await tauri.event.listen(name, (e) => handler(e.payload));
            if (cancelled) un();
            else unlisteners.push(un);
        };

        on("media", setMedia);

        on("volume", (v) => {
            setVolume(v);
            const prev = lastVolume.current;
            lastVolume.current = v;
            // HUD hanya muncul saat nilainya berubah, bukan saat pembacaan awal atau kiriman ulang
            if (prev && (prev.level !== v.level || prev.muted !== v.muted)) {
                showHud("volume", v, 1800);
            }
        });
        on("brightness", (value) => {
            setBrightness(value);
            // HUD hanya muncul saat nilainya benar-benar berubah
            if (lastBrightness.current !== null && lastBrightness.current !== value) {
                showHud("brightness", { level: value }, 1800);
            }
            lastBrightness.current = value;
        });

        on("battery", (b) => {
            setBattery(b);
            if (!b.present) return;
            if (b.charging || b.percent > 20) {
                lastAlert.current = 100;
                return;
            }
            const level = [5, 10, 20].find((t) => b.percent <= t && lastAlert.current > t);
            if (level) {
                lastAlert.current = level;
                showHud("battery", b, 5000);
            }
        });

        on("notification", (n) => {
            setNotifications((list) => [n, ...list].slice(0, 20));
            showHud("notification", n, 4000);
        });

        return () => {
            cancelled = true;
            unlisteners.forEach((u) => u());
        };
    }, [showHud]);

    const invoke = (cmd, args) => window.__TAURI__?.core.invoke(cmd, args);

    return {
        media,
        volume,
        battery,
        notifications,
        hud,
        control: (action) => invoke("media_control", { action }),
        setSystemVolume: (percent) => invoke("set_volume", { percent }),
        dismiss: (id) => setNotifications((l) => l.filter((n) => n.id !== id)),
        brightness,
        setSystemBrightness: (percent) => invoke("set_brightness", { percent }),
    };
}
