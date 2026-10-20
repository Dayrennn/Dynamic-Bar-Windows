"use client";

import { useEffect, useState } from "react";
import { useSystem } from "./useSystem";

// Ukuran notch (px)
const EAR = 12; // lebar "telinga" melengkung di kiri-kanan atas
const STRIP = { w: 140, h: 6, r: 6 }; // strip tipis saat tidak ada aktivitas
const COLLAPSED = { w: 200, h: 34, r: 14 }; // notch kecil saat musik berjalan
const HUD = { w: 330, h: 80, r: 26 }; // volume, baterai, notifikasi
const EXPANDED = { w: 390, h: 244, r: 30 }; // mode penuh (hover)

const EASE = "cubic-bezier(0.32,0.72,0,1)";

const ICONS = {
    music: (
        <>
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
        </>
    ),
    battery: (
        <>
            <rect x="2" y="7" width="18" height="10" rx="2" />
            <path d="M22 10v4M6 10h9" />
        </>
    ),
    bell: (
        <>
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
        </>
    ),
    play: <path d="m8 5 12 7-12 7z" fill="currentColor" />,
    pause: <path d="M8 5v14M16 5v14" strokeWidth="3" />,
    next: (
        <>
            <path d="m5 5 10 7-10 7z" fill="currentColor" />
            <path d="M19 5v14" strokeWidth="3" />
        </>
    ),
    prev: (
        <>
            <path d="m19 5-10 7 10 7z" fill="currentColor" />
            <path d="M5 5v14" strokeWidth="3" />
        </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    volume: (
        <>
            <path d="M4 10v4h4l5 4V6l-5 4z" />
            <path d="M16 9a5 5 0 0 1 0 6M18 5a10 10 0 0 1 0 14" />
        </>
    ),
    mute: (
        <>
            <path d="M4 10v4h4l5 4V6l-5 4z" />
            <path d="m17 9 5 6M22 9l-5 6" />
        </>
    ),
    sun: (
        <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
    ),
};

const TABS = [
    { id: "music", label: "Media", icon: "music" },
    { id: "system", label: "System", icon: "battery" },
    { id: "notifications", label: "Notifikasi", icon: "bell" },
];

const BARS = [6, 12, 8, 14, 9];

// Telinga melengkung: sudut cekung yang menyatu dengan tepi atas layar
const EAR_BASE = {
    position: "absolute",
    top: 0,
    width: EAR,
    height: EAR,
    pointerEvents: "none",
    transition: "opacity 300ms ease",
};
const EAR_LEFT = { ...EAR_BASE, left: -EAR, background: `radial-gradient(circle at 0 100%, transparent ${EAR - 0.5}px, #000 ${EAR}px)` };
const EAR_RIGHT = { ...EAR_BASE, right: -EAR, background: `radial-gradient(circle at 100% 100%, transparent ${EAR - 0.5}px, #000 ${EAR}px)` };

// State di level modul (bukan useRef): satu jendela = satu notch, jadi aman,
// tidak memicu render, dan tidak butuh hook tambahan.
let leaveTimer = null; // jeda singkat agar tidak berkedip saat kursor keluar-masuk tepi
let windowSize = { w: 0, h: 0 }; // ukuran jendela Tauri terakhir yang dikirim

function resizeWindow(w, h) {
    if (windowSize.w === w && windowSize.h === h) return; // tidak ada perubahan, tidak perlu IPC
    windowSize = { w, h };
    window.__TAURI__?.core.invoke("resize_window", { width: w, height: h }).catch(console.error);
}

function Icon({ name, size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" aria-hidden="true">
            {ICONS[name]}
        </svg>
    );
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

function Art({ media, className, symbolSize }) {
    if (media?.art) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={media.art} alt="" decoding="async" className={`${className} object-cover`} />;
    }
    return <div className={`${className} flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 ${symbolSize}`}>✦</div>;
}

function NotifIcon({ notification, className }) {
    if (notification?.icon) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={notification.icon} alt="" decoding="async" className={`${className} rounded-[10px] object-contain`} />;
    }
    return (
        <div className={`${className} flex items-center justify-center rounded-full bg-white/10 text-sm font-semibold uppercase`}>
            {(notification?.app || notification?.title || "?").charAt(0)}
        </div>
    );
}

export default function Home() {
    const { brightness, media, volume, battery, notifications, hud, control, setSystemVolume, dismiss, setSystemBrightness } = useSystem();

    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState("music");
    const [recentlyPlaying, setRecentlyPlaying] = useState(false);
    const [dragBrightness, setDragBrightness] = useState(null);

    const playing = media?.playing ?? false;

    // Setelah musik di-pause, notch tetap tampil 4 detik lalu berubah jadi strip.
    // Ini satu-satunya timer yang memang butuh effect (menunggu waktu berlalu).
    useEffect(() => {
        if (playing) {
            setRecentlyPlaying(true);
            return;
        }
        const timer = setTimeout(() => setRecentlyPlaying(false), 4000);
        return () => clearTimeout(timer);
    }, [playing]);

    // full   : kursor di atas notch
    // hud    : ada aktivitas (volume / baterai / notifikasi)
    // playing: musik berjalan
    // strip  : tidak ada aktivitas
    const mode = expanded ? "full" : hud ? "hud" : recentlyPlaying ? "playing" : "strip";
    const size = mode === "full" ? EXPANDED : mode === "hud" ? HUD : mode === "playing" ? COLLAPSED : STRIP;

    // Ukuran jendela mengikuti notch supaya area kosong tidak menutupi aplikasi lain
    const roomy = mode === "full" || mode === "hud";
    const winW = size.w + (mode === "strip" ? 0 : EAR * 2) + (roomy ? 32 : 0);
    const winH = size.h + (roomy ? 28 : 0);

    // Membesar: ubah jendela lebih dulu agar animasi tidak terpotong.
    // Mengecil: ditangani onTransitionEnd di bawah (tanpa setTimeout / ref).
    useEffect(() => {
        resizeWindow(Math.max(winW, windowSize.w), Math.max(winH, windowSize.h));
    }, [winW, winH]);

    function handleTransitionEnd(event) {
        if (event.target !== event.currentTarget) return;
        if (event.propertyName === "width" || event.propertyName === "height") resizeWindow(winW, winH);
    }

    function open() {
        clearTimeout(leaveTimer);
        setExpanded(true);
    }

    function close() {
        leaveTimer = setTimeout(() => setExpanded(false), 160);
    }

    // Slider kecerahan: nilai lokal dipakai selama digeser, dilepas saat selesai.
    // Menggantikan useRef + setTimeout 800ms sebelumnya.
    function changeBrightness(value) {
        setDragBrightness(value);
        setSystemBrightness(value);
    }
    const endDrag = () => setDragBrightness(null);

    const progress = media && media.duration > 0 ? Math.min(100, (media.position / media.duration) * 100) : 0;
    const batteryLow = battery?.present && !battery.charging && battery.percent <= 20;
    const volumeLevel = volume?.level ?? 0;
    const shownBrightness = dragBrightness ?? brightness;
    const earClass = mode === "strip" ? "opacity-0" : "opacity-100";

    return (
        <main className="relative min-h-screen overflow-hidden bg-transparent p-0 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Segoe_UI',sans-serif] text-white antialiased">
            <div
                onMouseEnter={open}
                onMouseLeave={close}
                onTransitionEnd={handleTransitionEnd}
                className="absolute left-1/2 top-0 -translate-x-1/2"
                style={{
                    width: size.w,
                    height: size.h,
                    transition: `width 480ms ${EASE}, height 480ms ${EASE}`,
                }}
            >
                {/* Telinga kiri & kanan */}
                <span className={earClass} style={EAR_LEFT} />
                <span className={earClass} style={EAR_RIGHT} />

                {/* Badan notch */}
                <section
                    className="relative h-full w-full overflow-hidden"
                    style={{
                        backgroundColor: mode === "strip" ? "#3a3a3a" : "#000",
                        borderRadius: `0 0 ${size.r}px ${size.r}px`,
                        boxShadow: roomy ? "0 14px 30px rgba(0,0,0,0.45)" : "none",
                        transition: `border-radius 480ms ${EASE}, box-shadow 300ms ease, background-color 300ms ease`,
                    }}
                >
                    {/* Baris atas: bagian tengah kosong seperti area kamera */}
                    <div
                        onClick={() => setExpanded((value) => !value)}
                        className="absolute inset-x-0 top-0 flex h-[34px] cursor-pointer items-center justify-between px-3"
                        style={{
                            opacity: mode === "strip" ? 0 : 1,
                            pointerEvents: mode === "strip" ? "none" : "auto",
                            transition: "opacity 200ms ease",
                        }}
                    >
                        <Art media={media} className="h-[20px] w-[20px] rounded-[6px] text-[11px]" symbolSize="text-[11px]" />

                        <div className="flex h-4 items-end gap-[2px]">
                            {BARS.map((height, index) => (
                                <span
                                    key={index}
                                    className={`w-[2px] rounded-full ${playing ? "animate-pulse bg-emerald-400" : "bg-white/30"}`}
                                    style={{ height, animationDelay: `${index * 120}ms` }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Mode HUD: volume, baterai habis, notifikasi baru */}
                    <div
                        className="absolute inset-x-0 bottom-0 top-[34px] px-5"
                        style={{
                            opacity: mode === "hud" ? 1 : 0,
                            transform: mode === "hud" ? "translateY(0)" : "translateY(-4px)",
                            pointerEvents: "none",
                            transition: mode === "hud" ? "opacity 240ms ease 140ms, transform 300ms ease 100ms" : "opacity 100ms ease",
                        }}
                    >
                        {hud?.type === "volume" && (
                            <div className="flex items-center gap-3 pt-2">
                                <Icon name={hud.data.muted || hud.data.level === 0 ? "mute" : "volume"} size={18} />
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                                    <div className="h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${hud.data.muted ? 0 : hud.data.level}%` }} />
                                </div>
                                <span className="w-10 text-right text-[11px] tabular-nums text-white/80">{hud.data.muted ? "Mute" : `${hud.data.level}%`}</span>
                            </div>
                        )}

                        {hud?.type === "battery" && (
                            <div className="flex items-center gap-3 pt-2 text-red-400">
                                <Icon name="battery" size={22} />
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold">Baterai tinggal {hud.data.percent}%</p>
                                    <p className="text-[10px] text-white/50">Colokkan charger</p>
                                </div>
                            </div>
                        )}

                        {hud?.type === "brightness" && (
                            <div className="flex items-center gap-3 pt-2">
                                <Icon name="sun" size={18} />
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                                    <div className="h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${hud.data.level}%` }} />
                                </div>
                                <span className="w-10 text-right text-[11px] tabular-nums text-white/80">{hud.data.level}%</span>
                            </div>
                        )}

                        {hud?.type === "notification" && (
                            <div className="flex items-center gap-3 pt-2">
                                <NotifIcon notification={hud.data} className="h-9 w-9 shrink-0" />
                                <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold">{hud.data.title || hud.data.app}</p>
                                    <p className="truncate text-[10px] text-white/55">{hud.data.message || hud.data.app}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mode penuh: tab Media / System / Notifikasi */}
                    <div
                        className="absolute inset-x-0 bottom-0 top-[38px] px-5 pb-4"
                        style={{
                            opacity: mode === "full" ? 1 : 0,
                            transform: mode === "full" ? "translateY(0)" : "translateY(-6px)",
                            pointerEvents: mode === "full" ? "auto" : "none",
                            transition: mode === "full" ? `opacity 260ms ease 140ms, transform 340ms ${EASE} 100ms` : "opacity 120ms ease, transform 120ms ease",
                        }}
                    >
                        {/* Tab */}
                        <div className="mb-3 flex items-center justify-center gap-1.5">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium transition ${
                                        activeTab === tab.id ? "bg-white text-black" : "bg-white/[0.07] text-white/55 hover:bg-white/[0.12]"
                                    }`}
                                >
                                    <Icon name={tab.icon} size={12} />
                                    {tab.label}
                                    {tab.id === "notifications" && notifications.length > 0 && ` (${notifications.length})`}
                                </button>
                            ))}
                        </div>

                        {/* Media */}
                        {activeTab === "music" && (
                            <div>
                                <div className="flex items-center gap-3">
                                    <Art media={media} className="h-14 w-14 shrink-0 rounded-[14px] shadow-lg" symbolSize="text-2xl" />

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[13px] font-semibold">{media?.title ?? "Tidak ada media"}</p>
                                        <p className="truncate text-[11px] text-white/50">{media?.artist}</p>
                                        <div className="mt-2 flex items-center gap-2 text-[9px] tabular-nums text-white/40">
                                            <span>{formatTime(media?.position)}</span>
                                            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/15">
                                                <div className="h-full rounded-full bg-white transition-[width] duration-1000 ease-linear" style={{ width: `${progress}%` }} />
                                            </div>
                                            <span>{formatTime(media?.duration)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 flex items-center justify-center gap-9">
                                    <button onClick={() => control("prev")} className="text-white/75 transition hover:text-white active:scale-90" aria-label="Lagu sebelumnya">
                                        <Icon name="prev" size={20} />
                                    </button>
                                    <button
                                        onClick={() => control("toggle")}
                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 active:scale-95"
                                        aria-label={playing ? "Pause" : "Play"}
                                    >
                                        <Icon name={playing ? "pause" : "play"} size={16} />
                                    </button>
                                    <button onClick={() => control("next")} className="text-white/75 transition hover:text-white active:scale-90" aria-label="Lagu berikutnya">
                                        <Icon name="next" size={20} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* System */}
                        {activeTab === "system" && (
                            <div className="space-y-3">
                                <div>
                                    <div className="mb-1.5 flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-2 text-white/70">
                                            <Icon name="battery" size={16} />
                                            Baterai{battery?.charging ? " (mengisi)" : ""}
                                        </span>
                                        <span className={`font-medium tabular-nums ${batteryLow ? "text-red-400" : ""}`}>
                                            {battery?.present ? `${battery.percent}%` : battery ? "Tidak ada baterai" : "-"}
                                        </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                        <div
                                            className={`h-full rounded-full transition-[width] duration-500 ${batteryLow ? "bg-red-400" : "bg-emerald-400"}`}
                                            style={{ width: `${battery?.percent ?? 0}%` }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="mb-1.5 flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-2 text-white/70">
                                            <Icon name={volume?.muted ? "mute" : "volume"} size={16} />
                                            Volume
                                        </span>
                                        <span className="tabular-nums">{volume?.muted ? "Mute" : `${volumeLevel}%`}</span>
                                    </div>
                                    <input
                                        aria-label="Volume"
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={volumeLevel}
                                        onChange={(event) => setSystemVolume(Number(event.target.value))}
                                        className="w-full accent-white"
                                    />
                                </div>

                                <div>
                                    <div className="mb-1.5 flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-2 text-white/70">
                                            <Icon name="sun" size={16} />
                                            Kecerahan
                                        </span>
                                        <span className="tabular-nums">{shownBrightness ?? "-"}%</span>
                                    </div>
                                    <input
                                        aria-label="Kecerahan"
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={shownBrightness ?? 0}
                                        onChange={(event) => changeBrightness(Number(event.target.value))}
                                        onPointerUp={endDrag}
                                        onKeyUp={endDrag}
                                        onBlur={endDrag}
                                        className="w-full accent-white"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Notifikasi */}
                        {activeTab === "notifications" && (
                            <div className="max-h-[110px] space-y-2 overflow-y-auto pr-1">
                                {notifications.length === 0 ? (
                                    <p className="py-6 text-center text-xs text-white/40">Tidak ada notifikasi baru</p>
                                ) : (
                                    notifications.map((notification) => (
                                        <div key={notification.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-2.5">
                                            <NotifIcon notification={notification} className="h-8 w-8 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-medium">{notification.title || notification.app}</p>
                                                <p className="mt-0.5 truncate text-[10px] text-white/50">{notification.message}</p>
                                            </div>
                                            <button onClick={() => dismiss(notification.id)} className="text-white/35 hover:text-white" aria-label="Hapus notifikasi">
                                                <Icon name="close" size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
