use std::{collections::HashMap, process::Command};
use windows::{
    core::Interface,
    Foundation::Size,
    Storage::Streams::IRandomAccessStreamReference,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use wmi::WMIConnection;
use std::{collections::HashSet, thread, time::Duration};
use tauri::{AppHandle, Emitter};
use windows::{
    core::HSTRING,
    Media::Control::*,
    Storage::Streams::DataReader,
    UI::Notifications::{Management::*, NotificationKinds},
    Win32::{
        Media::Audio::{
            eMultimedia, eRender, Endpoints::IAudioEndpointVolume, IMMDeviceEnumerator,
            MMDeviceEnumerator,
        },
        System::{Com::*, Power::*},
    },
};
use std::os::windows::process::CommandExt;
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use std::sync::Mutex;


type Mgr = GlobalSystemMediaTransportControlsSessionManager;
type Session = GlobalSystemMediaTransportControlsSession;

fn com() {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
}

// ---------- MEDIA (Spotify) ----------

#[derive(Serialize, Clone, PartialEq)]
pub struct MediaInfo {
    title: String,
    artist: String,
    playing: bool,
    position: f64,
    duration: f64,
    art: Option<String>,
}

static LAST_SOURCE: Mutex<String> = Mutex::new(String::new());

fn source_id(s: &Session) -> String {
    s.SourceAppUserModelId().map(|h| h.to_string()).unwrap_or_default()
}

fn is_playing(s: &Session) -> bool {
    s.GetPlaybackInfo()
        .and_then(|i| i.PlaybackStatus())
        .map(|st| st == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing)
        .unwrap_or(false)
}

fn pick_session(mgr: &Mgr) -> Option<Session> {
    let current = mgr.GetCurrentSession().ok();
    let sessions: Vec<Session> = mgr.GetSessions().ok()?.into_iter().collect();

    let chosen = if let Some(c) = current.clone().filter(is_playing) {
        // sesi yang sedang aktif menurut Windows dan sedang diputar
        Some(c)
    } else if let Some(p) = sessions.iter().find(|s| is_playing(s)) {
        // sesi lain yang sedang diputar
        Some(p.clone())
    } else {
        // tidak ada yang diputar: tetap di sesi terakhir, kalau masih ada
        let last = LAST_SOURCE.lock().ok().map(|g| g.clone()).unwrap_or_default();
        sessions
            .iter()
            .find(|s| !last.is_empty() && source_id(s) == last)
            .cloned()
            .or(current)
            .or_else(|| sessions.first().cloned())
    };

    if let Some(s) = &chosen {
        if let Ok(mut last) = LAST_SOURCE.lock() {
            *last = source_id(s);
        }
    }
    chosen
}

fn read_art(props: &GlobalSystemMediaTransportControlsSessionMediaProperties) -> Option<String> {
    let stream = props.Thumbnail().ok()?.OpenReadAsync().ok()?.join().ok()?;
    let size = stream.Size().ok()? as u32;
    let reader = DataReader::CreateDataReader(&stream.GetInputStreamAt(0).ok()?).ok()?;
    reader.LoadAsync(size).ok()?.join().ok()?;
    let mut buf = vec![0u8; size as usize];
    reader.ReadBytes(&mut buf).ok()?;
    Some(format!("data:image/jpeg;base64,{}", STANDARD.encode(buf)))
}

fn read_media(mgr: &Mgr, last_key: &mut String, last_art: &mut Option<String>) -> Option<MediaInfo> {
    let s = pick_session(mgr)?;
    let props = s.TryGetMediaPropertiesAsync().ok()?.join().ok()?;
    let title = props.Title().ok()?.to_string();
    let artist = props.Artist().ok()?.to_string();

    // cover hanya diambil saat lagu berganti
    let key = format!("{title}|{artist}");
    if key != *last_key {
        *last_art = read_art(&props);
        *last_key = key;
    }

    let playing = s.GetPlaybackInfo().ok()?.PlaybackStatus().ok()?
        == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
        let tl = s.GetTimelineProperties().ok()?;
    let secs = |t: windows::Foundation::TimeSpan| t.Duration as f64 / 10_000_000.0;

    let mut position = secs(tl.Position().ok()?);
    let duration = secs(tl.EndTime().ok()?);

    // Windows hanya memperbarui posisi sesekali, jadi tambahkan selisih
    // waktu sejak posisi itu dicatat agar bar berjalan tiap detik
    if playing {
        if let Ok(updated) = tl.LastUpdatedTime() {
            // DateTime Windows = satuan 100 ns sejak 1 Januari 1601 (UTC)
            let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?;
            let now_ticks = now.as_secs() as i64 * 10_000_000
                + now.subsec_nanos() as i64 / 100
                + 116_444_736_000_000_000;
            let elapsed = (now_ticks - updated.UniversalTime) as f64 / 10_000_000.0;
            if elapsed > 0.0 && elapsed < 60.0 {
                position += elapsed;
            }
        }
    }
    if duration > 0.0 {
        position = position.min(duration);
    }

    Some(MediaInfo {
        title,
        artist,
        playing,
        position,
        duration,
        art: last_art.clone(),
    })
}

fn stream_to_data_url(r: &IRandomAccessStreamReference) -> Option<String> {
    let stream = r.OpenReadAsync().ok()?.join().ok()?;
    let size = stream.Size().ok()? as u32;
    let reader = DataReader::CreateDataReader(&stream.GetInputStreamAt(0).ok()?).ok()?;
    reader.LoadAsync(size).ok()?.join().ok()?;
    let mut buf = vec![0u8; size as usize];
    reader.ReadBytes(&mut buf).ok()?;
    Some(format!("data:image/png;base64,{}", STANDARD.encode(buf)))
}

#[tauri::command]
pub fn media_control(action: String) {
    com();
    let Ok(op) = Mgr::RequestAsync() else { return };
    let Ok(mgr) = op.join() else { return };
    if let Some(s) = pick_session(&mgr) {
        match action.as_str() {
            "toggle" => { let _ = s.TryTogglePlayPauseAsync(); }
            "next" => { let _ = s.TrySkipNextAsync(); }
            "prev" => { let _ = s.TrySkipPreviousAsync(); }
            _ => {}
        }
    }
}

// ---------- KECERAHAN ----------

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct WmiMonitorBrightness {
    current_brightness: u8,
}

static PENDING: AtomicI32 = AtomicI32::new(-1);
static RUNNING: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn set_brightness(percent: u32) {
    // simpan nilai terbaru; hanya satu proses PowerShell berjalan sekaligus
    PENDING.store(percent.min(100) as i32, Ordering::SeqCst);
    if RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    thread::spawn(|| loop {
        let v = PENDING.swap(-1, Ordering::SeqCst);
        if v < 0 {
            RUNNING.store(false, Ordering::SeqCst);
            // ada nilai baru yang masuk tepat saat berhenti?
            if PENDING.load(Ordering::SeqCst) >= 0 && !RUNNING.swap(true, Ordering::SeqCst) {
                continue;
            }
            break;
        }
        let script = format!(
            "Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | \
             Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{{ Timeout = 1; Brightness = {v} }}"
        );
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .creation_flags(0x08000000) // tanpa jendela konsol
            .output();
    });
}

// ---------- VOLUME ----------

#[derive(Serialize, Clone, PartialEq)]
pub struct Volume {
    level: u32,
    muted: bool,
}

fn endpoint() -> windows::core::Result<IAudioEndpointVolume> {
    unsafe {
        let e: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let d = e.GetDefaultAudioEndpoint(eRender, eMultimedia)?;
        d.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
    }
}

#[tauri::command]
pub fn set_volume(percent: f32) {
    com();
    if let Ok(ep) = endpoint() {
        unsafe {
            let _ = ep.SetMasterVolumeLevelScalar((percent / 100.0).clamp(0.0, 1.0), std::ptr::null());
        }
    }
}

// ---------- BATERAI ----------

#[derive(Serialize, Clone, PartialEq)]
pub struct Battery {
    percent: u8,
    charging: bool,
    present: bool,
}

// ---------- NOTIFIKASI ----------

#[derive(Serialize, Clone)]
pub struct Notif {
    id: u32,
    app: String,
    title: String,
    message: String,
    icon: Option<String>,
}

pub fn start(app: AppHandle) {
    // media
    let a = app.clone();
    thread::spawn(move || {
        com();
        let Ok(op) = Mgr::RequestAsync() else { return };
        let Ok(mgr) = op.join() else { return };
        let (mut key, mut art) = (String::new(), None);
        let mut last: Option<MediaInfo> = None;
        loop {
            let info = read_media(&mgr, &mut key, &mut art);
            if info != last {
                let _ = a.emit("media", info.clone());
                last = info;
            }
            thread::sleep(Duration::from_millis(1000));
        }
    });

    // volume
    let a = app.clone();
    thread::spawn(move || {
        com();
        let mut last: Option<Volume> = None;
        let mut ticks: u32 = 0;
        loop {
            if let Ok(ep) = endpoint() {
                unsafe {
                    if let (Ok(v), Ok(m)) = (ep.GetMasterVolumeLevelScalar(), ep.GetMute()) {
                        let cur = Volume { level: (v * 100.0).round() as u32, muted: m.as_bool() };
                        // kirim saat berubah, dan ulang tiap ~3 detik agar tidak ada yang terlewat
                        if last.as_ref() != Some(&cur) || ticks % 25 == 0 {
                            let _ = a.emit("volume", cur.clone());
                        }
                        last = Some(cur);
                    }
                }
            }
            ticks += 1;
            thread::sleep(Duration::from_millis(120));
        }
    });

        // baterai
    let a = app.clone();
    thread::spawn(move || loop {
        unsafe {
            let mut st = SYSTEM_POWER_STATUS::default();
            if GetSystemPowerStatus(&mut st).is_ok() {
                // BatteryFlag 128 = tidak ada baterai, BatteryLifePercent 255 = tidak diketahui
                let present = st.BatteryFlag & 128 == 0 && st.BatteryLifePercent <= 100;
                let _ = a.emit(
                    "battery",
                    Battery {
                        percent: if present { st.BatteryLifePercent } else { 0 },
                        charging: st.ACLineStatus == 1,
                        present,
                    },
                );
            }
        }
        thread::sleep(Duration::from_secs(5));
    });

    // kecerahan
    let a = app.clone();
    thread::spawn(move || {
        let Ok(wmi) = WMIConnection::with_namespace_path("ROOT\\WMI") else {
            eprintln!("Kecerahan: gagal membuka WMI");
            return;
        };
        let mut last: Option<u8> = None;
        let mut ticks: u32 = 0;
        loop {
            if let Ok(rows) = wmi.query::<WmiMonitorBrightness>() {
                if let Some(row) = rows.first() {
                    let v = row.current_brightness;
                    // kirim saat berubah, dan ulang tiap ~3 detik agar tidak ada yang terlewat
                    if last != Some(v) || ticks % 10 == 0 {
                        let _ = a.emit("brightness", v);
                    }
                    last = Some(v);
                }
            }
            ticks += 1;
            thread::sleep(Duration::from_millis(300));
        }
    });

    // notifikasi Windows
    thread::spawn(move || {
        com();
        let Ok(listener) = UserNotificationListener::Current() else { return };
        let status = listener.RequestAccessAsync().ok().and_then(|o| o.join().ok());
        if status != Some(UserNotificationListenerAccessStatus::Allowed) {
            eprintln!("Akses notifikasi tidak diberikan: {:?}", status);
            return;
        }
        let mut seen: HashSet<u32> = HashSet::new();
        let mut first = true;
        let mut logos: HashMap<String, Option<String>> = HashMap::new();
        loop {
            if let Ok(list) = listener.GetNotificationsAsync(NotificationKinds::Toast).and_then(|o| o.join()) {
                for n in list {
                    let Ok(id) = n.Id() else { continue };
                    if !seen.insert(id) || first { continue; }

                    let app_name = n.AppInfo().and_then(|a| a.DisplayInfo()).and_then(|d| d.DisplayName())
                        .map(|s| s.to_string()).unwrap_or_default();
                    let icon = logos
                    .entry(app_name.clone())
                    .or_insert_with(|| {
                        n.AppInfo()
                            .and_then(|a| a.DisplayInfo())
                            .and_then(|d| d.GetLogo(Size { Width: 64.0, Height: 64.0 }))
                            .ok()
                            .and_then(|r| r.cast::<IRandomAccessStreamReference>().ok())
                            .and_then(|r| stream_to_data_url(&r))
                    })
                    .clone();
                    let texts: Vec<String> = n.Notification().and_then(|x| x.Visual())
                        .and_then(|v| v.GetBinding(&HSTRING::from("ToastGeneric")))
                        .and_then(|b| b.GetTextElements())
                        .map(|els| els.into_iter().filter_map(|e| e.Text().ok()).map(|t| t.to_string()).collect())
                        .unwrap_or_default();

                    let _ = app.emit("notification", Notif {
                        id,
                        app: app_name,
                        title: texts.get(0).cloned().unwrap_or_default(),
                        message: texts.get(1..).map(|r| r.join(" ")).unwrap_or_default(),
                        icon,
                    });
                }
            }
            first = false; // notifikasi lama di Action Center diabaikan
            thread::sleep(Duration::from_millis(1000));
        }
    });
}

#[tauri::command]
pub fn resize_window(window: tauri::WebviewWindow, width: f64, height: f64) {
    let _ = window.set_size(tauri::LogicalSize::new(width, height));

    // tetap di tengah atas layar
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let scale = monitor.scale_factor();
        let win_w = (width * scale).round() as i32;
        let x = monitor.position().x + (monitor.size().width as i32 - win_w) / 2;
        let _ = window.set_position(tauri::PhysicalPosition::new(x, monitor.position().y));
    }
}
