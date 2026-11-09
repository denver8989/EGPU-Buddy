// EGPU Buddy desktop app: native Qt6/QML window + system-tray icon around the local backend (egpu-buddy-server.py).
// Why QML: SteamOS ships KDE Plasma, so Qt6 + QtQuick Controls + Qt.labs.platform are always there, while WebKitGTK is not
// (the app used to fall back to a browser tab on SteamOS). Run by the launcher (which also selects the Fusion style and Qt's generic platform theme, see there)
// Test hook: `-- --shot /path.png` renders one frame after the first status, saves it and quits (used with the offscreen platform).
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Shapes
import Qt.labs.platform as Platform

ApplicationWindow {
    id: win
    width: 1060; height: 660; minimumWidth: 640; minimumHeight: 520
    readonly property bool startHidden: Qt.application.arguments.indexOf("--tray") >= 0
    // Shown from onCompleted, after the domain is cleared: the window's Wayland app id is then the runner's name, which the
    // launcher sets to "egpu-buddy" (= egpu-buddy.desktop), so the taskbar shows the app's icon and name, not "qml".
    visible: false
    Component.onCompleted: { Qt.application.domain = ""; if (!startHidden) show() }
    property int showSeq: -1                   // the launcher asks a running instance to show itself through the backend
    // NV GPU Buddy mode (experimental, a BUILT-IN NVIDIA card): the same app under its own name, without the eGPU parts.
    // Every `nvb` binding is for that mode only; an eGPU install never reports the track and looks as before.
    readonly property bool nvb: s.track === "nv-gpu-buddy"
    readonly property string appName: nvb ? "NV GPU Buddy" : "EGPU Buddy"
    title: appName
    // own dark palette + the Fusion style (selected by the launcher): the same look on every desktop theme and distro
    // two looks: the new one (indigo, cyan accent) and the classic one (the app as it was); the backend keeps the pick (/api/status "look")
    readonly property bool nl: s.look === "new"
    palette { window: win.nl ? "#0c0a1d" : "#0b1016"; windowText: win.nl ? "#ece9ff" : "#dfe8f0"; base: win.nl ? "#151236" : "#101720"; alternateBase: win.nl ? "#1b173f" : "#162030"; text: win.nl ? "#ece9ff" : "#dfe8f0"
              button: win.nl ? "#1b173f" : "#1b2633"; buttonText: win.nl ? "#ece9ff" : "#dfe8f0"; highlight: win.nl ? "#2ee6f0" : "#1a9fff"; highlightedText: win.nl ? "#0c0a1d" : "#ffffff"
              mid: win.nl ? "#2f2960" : "#3a4a5c"; dark: win.nl ? "#070614" : "#070a0e"; light: win.nl ? "#2a2552" : "#2a3848"; placeholderText: win.nl ? "#a7a2cc" : "#7f8fa0"
              toolTipBase: win.nl ? "#1b173f" : "#162030"; toolTipText: win.nl ? "#ece9ff" : "#dfe8f0" }
    readonly property string subCol: nl ? "#a7a2cc" : "#8b929a"
    readonly property string vendorKey: s.vendor === "amd" || s.vendor === "intel" ? s.vendor : "nvidia"
    readonly property string brandCol: ({ nvidia: "#76b900", amd: "#ed1c24", intel: "#0071c5" })[vendorKey]
    readonly property string api: "http://127.0.0.1:8772"
    property var s: ({})                       // last /api/status
    property var g: (s.gpu || {})
    readonly property bool on: !!(s.present && s.driver_loaded && g.name)
    property bool sliderTouched: false
    // laptop-class GPUs (ASUS XG Mobile) report the power limits and the fan as [N/A]: the dock firmware owns them. They get a
    // GPU clock limit as their power control instead (the same as the HTML window and the Decky plugin since 0.7.114)
    function isNum(v) { return v !== undefined && v !== null && v !== "" && !isNaN(parseFloat(v)) }
    readonly property bool plOk: isNum(g["power.min_limit"]) && isNum(g["power.max_limit"]) && isNum(g["power.limit"]) && +g["power.max_limit"] > +g["power.min_limit"]
    // ASUS XG Mobile: the cap the GPU really runs at (enforced.power.limit, queried only for it), shown where power.limit is [N/A]
    readonly property bool xg: String(s.dock || "").indexOf("XG Mobile") >= 0
    readonly property bool xgCap: xg && !isNum(g["power.limit"]) && isNum(g["enforced.power.limit"])
    // ASUS XG Mobile controls (egpu-xgm): fan mode and lights sent to the dock, a power target held by a clock limit
    readonly property var xgm: (s.xgm || {})
    readonly property var xgLive: (xgm.live || {})
    readonly property bool xgTarget: xg && isNum(xgLive.target)
    readonly property int xgTop: isNum(g["enforced.power.limit"]) ? Math.round(+g["enforced.power.limit"]) : 115
    readonly property var fanModes: ["auto", "quiet", "balanced", "performance", "max", "custom"]
    readonly property var effects: ["static", "breathe", "cycle", "rainbow", "strobe"]
    readonly property var swatches: ["ff0000", "ff6000", "ffd000", "00ff40", "00e0ff", "0040ff", "a000ff", "ffffff"]
    readonly property var balancedCurve: [30, 50, 60, 65, 70, 75, 80, 85, 15, 25, 35, 45, 55, 65, 80, 100]
    property bool offTouched: false
    // the XG Mobile intro animation: once in this app (the plugin has its own), marked shown when it has played or was clicked away
    property bool introShowing: false
    property bool introDone: false
    function lightFx(fx, rgb, speed) { act("xgm-light-effect", { value: (fx || xgm.effect || "static") + ":" + (rgb || xgm.color || "ff0000") + ":" + (speed || xgm.speed || "normal") }) }
    function cap1(x) { x = String(x || ""); return x.charAt(0).toUpperCase() + x.slice(1) }
    property bool ptTouched: false
    readonly property int clkMax: isNum(g["clocks.max.graphics"]) ? Math.round(+g["clocks.max.graphics"]) : 0
    property bool clkTouched: false
    // NVIDIA settings (experimental)
    property int page: Qt.application.arguments.indexOf("--page") >= 0 ? +(Qt.application.arguments[Qt.application.arguments.indexOf("--page") + 1] || 0) : 0   // --page N: test hook
    readonly property int pg: (nl && page === 2) ? 2 : (page === 1 && nvShow ? 1 : 0)
    readonly property bool nvShow: !!(s.present && (s.vendor === "nvidia" || s.vendor === ""))
    property var nv: ({})
    property var nvEdit: ({})
    property bool nvDirty: false
    property bool nvSaved: false
    // while a game runs: per setting, what that game really received (read-only), refreshed while the tab is open
    property var gs: ({})
    // Game Mode settings the app shares with the plugin (the plugin's own settings file; NVIDIA reference path only, else {})
    property var ex: ({})
    function loadEx() { call("GET", "/api/extras", null, function(r) { if (r) ex = r }) }
    function setEx(key, v) { act("set-extra", { key: key, value: v }); loadEx() }
    Timer { interval: 3000; repeat: true; triggeredOnStart: true; running: win.pg === 2 && win.visible; onTriggered: win.loadEx() }
    function gsLook(st) { return ({ active: ["#4caf50", "Active"], inactive: ["#f0b429", "Inactive"], overridden: ["#f0b429", "Inactive: the game's own setting"],
                                    default: ["#8b929a", "Default"], na: ["#8b929a", "Not used by this game"] })[st] || ["#8b929a", st] }
    Timer { interval: 3000; repeat: true; triggeredOnStart: true; running: win.page === 1 && win.nvShow && win.visible
            onTriggered: win.call("GET", "/api/nvidia-game", null, function(r) { win.gs = r || {} }) }
    // every pick saves at once (a pick waiting for Apply was lost when the window closed)
    function saveNv(e) { nvEdit = e; act("nvidia-set", { settings: e }); nvDirty = false; nvSaved = true; loadNv() }
    function loadNv() { call("GET", "/api/nvidia", null, function(r) { if (!r) return; nv = r; if (!nvDirty) nvEdit = Object.assign({}, r.settings || {}) }) }
    property string msg: "Ready."
    property bool msgErr: false
    property bool updSeen: false
    readonly property var upd: (s.update || {})
    readonly property bool updRunning: upd.state === "running"
    // what the Update button says (GitHub issue #5): the installed version, and whether anything newer exists
    function vt(v) { var m = String(v || "").match(/\d+/g) || []; return [+(m[0] || 0), +(m[1] || 0), +(m[2] || 0)] }
    function newer(a, b) { var x = vt(a), y = vt(b); for (var i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false }
    readonly property string updLabel: updRunning ? "Updating…"
        : s.staged ? "Update " + s.staged + " finishes at the next reboot"
        : (s.latest && s.installed && !newer(s.latest, s.installed)) ? "Up to date (" + s.installed + ")"
        : s.latest ? "Update to " + s.latest : "Update"

    function num(v, d) { var x = parseFloat(v); return isNaN(x) ? "–" : x.toFixed(d || 0) }
    function call(method, path, body, cb) {
        var x = new XMLHttpRequest(); x.open(method, api + path)
        x.onreadystatechange = function() { if (x.readyState !== XMLHttpRequest.DONE) return
            var r = null; try { r = JSON.parse(x.responseText) } catch (e) {}
            cb(r, x.status) }
        if (body) { x.setRequestHeader("content-type", "application/json"); x.send(JSON.stringify(body)) } else x.send()
    }
    function refresh() {
        call("GET", "/api/status", null, function(r) {
            if (!r) { msg = "The EGPU Buddy backend is not answering (it starts with the app; reopen EGPU Buddy)."; msgErr = true; return }
            s = r
            if (showSeq >= 0 && (r.show_seq || 0) !== showSeq) { win.show(); win.raise(); win.requestActivate() }
            showSeq = r.show_seq || 0
            // the applied limit (the helper keeps it; NVIDIA cannot read it back), else no limit: the slider at the top
            if (on && xg && !ptTouched) { pt.to = xgTop; pt.value = +(xgm.power_target || 0) || xgTop }
            if (on && xg && xgm.intro_seen_desktop !== true && !introShowing && !introDone) introShowing = true
            if (on && xg && !offTouched) { coreOff.value = +((xgm.offset || [0, 0])[0]); memOff.value = +((xgm.offset || [0, 0])[1]) }
            if (on && clkMax > 0 && !clkTouched) { clkSl.to = clkMax; clkSl.value = +(g.clock_limit || 0) || clkMax }
            if (on && !sliderTouched) { pl.from = Math.max(100, Math.round(+g["power.min_limit"] || 100)); pl.to = Math.min(320, Math.round(+g["power.max_limit"] || 320)); pl.value = Math.round(+g["power.limit"] || pl.to) }
            var d = r.detach, gm = r.gm, l = r.last
            // a finished Safe Detach stays in its status file: once the eGPU is back with its driver it no longer applies
            var stale = !!(d && d.state === "SAFE_COMPLETE" && r.present && r.driver_loaded)
            if (d && d.state && d.state !== "IDLE" && !stale) { msgErr = /FAIL|DO_NOT|INCOMPLETE/.test(d.state); msg = d.state + ": " + (d.message || "") }
            else if (gm && gm.state && gm.state !== "ATTACHED") { msgErr = false; msg = gm.state + ": " + (gm.message || "") }
            else if (l && l.action) { msgErr = l.state === "failed"
                msg = l.state === "running" ? l.action + ": working…" : l.state === "ok" ? l.action + ": done." + (l.out ? "\n" + l.out : "") : l.action + " failed (rc " + l.rc + ")\n" + (l.out || "no output") }
            else if (stale) { msgErr = false; msg = "The eGPU is attached again." }
            // an update just finished (this app was restarted by it): show its result once
            var u = r.update || {}
            if (!updSeen && u.state && u.state !== "running" && Date.now() / 1000 - (u.t || 0) < 120) { win.show(); win.raise(); updateDlg.open() }
            updSeen = true
            if (shot.length) shotTimer.start()
        })
    }
    // GitHub release notes (backend /api/notes): every release newer than the installed one, or the installed one's own
    property string notesText: "Loading the release notes from GitHub…"
    function loadNotes() {
        call("GET", "/api/notes", null, function(r) {
            if (!r) { notesText = "The release notes could not be loaded."; return }
            if (r.error || !(r.notes || []).length) { notesText = r.error || "No release notes found."; return }
            notesText = "### " + r.title + "\n\n" + r.notes.map(function(n) { return "#### " + n.version + " · " + n.date + "\n\n" + n.body }).join("\n\n---\n\n")
        })
    }
    function act(action, extra) {
        var b = { action: action }; for (var k in (extra || {})) b[k] = extra[k]
        call("POST", "/api/action", b, function(r) {
            if (!r) { msg = "Failed: no answer from the backend"; msgErr = true; return }
            msgErr = !r.ok; msg = r.ok ? (r.started ? "Started: " + r.started : (r.out || "Done.")) : "Failed: " + (r.error || r.out || "?")
            refresh() })
    }
    Timer { interval: 2000; running: true; repeat: true; triggeredOnStart: true; onTriggered: win.refresh() }

    // closing the window keeps the tray icon (and the backend) alive; Quit is in the tray menu
    onClosing: function(close) { if (tray.available && !win.shot.length) { close.accepted = false; win.hide() } }

    Platform.SystemTrayIcon {
        id: tray
        visible: !win.shot.length
        icon.source: Qt.resolvedUrl("egpu-buddy.png")
        tooltip: win.appName + " — " + (win.s.present ? (win.g.name || (win.nvb ? "NVIDIA GPU" : "eGPU on the bus")) : (win.nvb ? "no NVIDIA card" : "no eGPU"))
        onActivated: function(reason) { if (reason !== Platform.SystemTrayIcon.Context) { win.show(); win.raise(); win.requestActivate() } }
        menu: Platform.Menu {
            Platform.MenuItem { text: "Open " + win.appName; onTriggered: { win.show(); win.raise(); win.requestActivate() } }
            Platform.MenuSeparator {}
            Platform.MenuItem { text: "Safe Detach…"; visible: !win.nvb; enabled: !!win.s.present; onTriggered: { win.show(); win.raise(); confirmDetach.open() } }
            Platform.MenuItem { text: "Re-attach"; visible: !win.nvb; enabled: !(win.s.present && win.s.driver_loaded); onTriggered: win.act("attach") }
            Platform.MenuSeparator {}
            Platform.MenuItem { text: win.updRunning ? "Updating… (show progress)" : (win.updLabel === "Update" ? "Update " + win.appName + "…" : win.updLabel); onTriggered: { win.show(); win.raise(); win.requestActivate(); updateDlg.open() } }
            Platform.MenuSeparator {}
            Platform.MenuItem { text: "Quit"; onTriggered: Qt.quit() }
        }
    }

    Dialog {
        id: confirmDetach
        title: "Safe Detach"; modal: true; anchors.centerIn: parent; width: Math.min(win.width - 80, 520)
        standardButtons: Dialog.Ok | Dialog.Cancel
        Label { width: parent.width; wrapMode: Text.WordWrap
            text: "The session moves back to the handheld screen and the eGPU is removed from the bus. Do not unplug until the result says it is safe. Continue?" }
        onAccepted: win.act("safe-detach")
    }

    Dialog {
        id: confirmScreen
        property var pick: ({})
        title: "Move the desktop"; modal: true; anchors.centerIn: parent; width: Math.min(win.width - 80, 520)
        standardButtons: Dialog.Ok | Dialog.Cancel
        Label { width: parent.width; wrapMode: Text.WordWrap
            text: "The desktop restarts on " + (confirmScreen.pick.label || "") + (confirmScreen.pick.kind === "handheld" ? ", running on the handheld's GPU with games on the eGPU" : ", running on the eGPU alone")
                  + ". Open apps are closed: save your work first. Continue?" }
        onAccepted: win.act("set-screen", { connector: confirmScreen.pick.name })
    }

    // XG Mobile custom fan curve: 8 points, checked by egpu-xgm (temperatures rising, duty not falling, the last >= 60 %)
    Dialog {
        id: curveDlg
        title: "XG Mobile custom fan curve"; modal: true; anchors.centerIn: parent; width: Math.min(win.width - 40, 760)
        standardButtons: Dialog.Apply | Dialog.Cancel
        property var c: []
        onAboutToShow: c = (win.xgm.curve && win.xgm.curve.length === 16 ? win.xgm.curve : win.balancedCurve).slice()
        onApplied: { win.act("xgm-fan-curve", { value: c.slice(0, 8).join(",") + ":" + c.slice(8).join(",") }); close() }
        ColumnLayout { width: parent.width; spacing: 8
            Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; opacity: 0.8
                text: "Eight points: at each GPU temperature, the fan speed. Temperatures must rise from point to point, the speed must not fall, and the last point must be at least 60 %. The XG Mobile follows the curve itself." }
            GridLayout { columns: 9; columnSpacing: 6; rowSpacing: 6
                Label { text: "°C" }
                Repeater { model: 8; SpinBox { from: 20; to: 100; editable: true; value: curveDlg.c[index] || 0; onValueModified: curveDlg.c[index] = value; Layout.preferredWidth: 76 } }
                Label { text: "Fan %" }
                Repeater { model: 8; SpinBox { from: 0; to: 100; stepSize: 5; editable: true; value: curveDlg.c[index + 8] || 0; onValueModified: curveDlg.c[index + 8] = value; Layout.preferredWidth: 76 } }
            }
        }
    }

    // Update: confirm, then live progress from the updater's status file, then the result (also after the app restarts)
    Dialog {
        id: updateDlg
        property real askedAt: 0                // seconds; 0 = not started from this dialog
        // confirm -> starting -> running (live progress) -> result; a result up to 2 minutes old is shown after the app restarts
        readonly property string phase: win.updRunning ? "running"
            : (win.upd.state && (win.upd.t || 0) >= (askedAt || Date.now() / 1000 - 120)) ? "result"
            : askedAt ? "starting" : "confirm"
        title: "Update " + win.appName; modal: true; anchors.centerIn: parent; width: Math.min(win.width - 80, 560)
        closePolicy: phase === "running" ? Popup.NoAutoClose : Popup.CloseOnEscape
        onOpened: { askedAt = 0; win.loadNotes() }
        ColumnLayout { width: parent.width; spacing: 10
            Label { Layout.fillWidth: true; wrapMode: Text.WordWrap
                text: updateDlg.phase === "confirm" ? (win.s.staged ? "Installed: " + (win.s.installed || "unknown") + ". Version " + win.s.staged + " is already downloaded and finishes installing at the next reboot.\nRun the update again now anyway?"
                    : (win.s.latest && win.s.installed && !win.newer(win.s.latest, win.s.installed)) ? "Installed: " + win.s.installed + ". This is the latest release; nothing newer to install.\nReinstall it anyway (repairs the system integration and the Game Mode plugin)?"
                    : "Installed: " + (win.s.installed || "unknown") + (win.s.latest ? ". Latest: " + win.s.latest : "") + ".\nDownload the latest release and update the system integration and the Game Mode plugin? The NVIDIA driver is not changed. The eGPU can stay attached; this window shows the progress.")
                    : updateDlg.phase === "starting" ? "Starting…" : (win.upd.step || "")
                color: updateDlg.phase === "result" && win.upd.state === "failed" ? "#e05555" : palette.windowText }
            // release notes from GitHub: what the update brings (before it), the installed version's notes (after it)
            Frame { Layout.fillWidth: true; Layout.preferredHeight: 260; visible: updateDlg.phase === "confirm" || updateDlg.phase === "result"; padding: 8
                ScrollView { anchors.fill: parent; clip: true; contentWidth: availableWidth
                    Label { width: parent.width; wrapMode: Text.WordWrap; textFormat: Text.MarkdownText; text: win.notesText
                            onLinkActivated: function(link) { Qt.openUrlExternally(link) } } } }
            ProgressBar { Layout.fillWidth: true; visible: updateDlg.phase === "running" || updateDlg.phase === "starting"; from: 0; to: 100
                value: win.upd.pct || 0; indeterminate: updateDlg.phase === "starting" }
            Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; opacity: 0.6; font.pixelSize: 11; visible: updateDlg.phase === "running"
                text: win.appName + " restarts itself when the update is done." }
            RowLayout { Layout.alignment: Qt.AlignRight
                Button { text: (win.s.latest && win.s.installed && !win.newer(win.s.latest, win.s.installed)) || win.s.staged ? "Reinstall" : "Update"; visible: updateDlg.phase === "confirm"; onClicked: { updateDlg.askedAt = Date.now() / 1000 - 2; win.act("update") } }
                Button { text: updateDlg.phase === "running" || updateDlg.phase === "starting" ? "Hide" : "Close"; onClicked: updateDlg.close() } }
        }
    }

    // a card of the new look; in the classic look it is invisible (no box, no padding), so the classic layout is unchanged
    component Card: Rectangle {
        default property alias content: col.data
        readonly property int pad: win.nl ? 16 : 0
        Layout.fillWidth: true
        radius: 14; color: win.nl ? palette.base : "transparent"; border.color: win.nl ? palette.light : "transparent"
        implicitHeight: col.implicitHeight + 2 * pad
        ColumnLayout { id: col; x: parent.pad; y: parent.pad; width: parent.width - 2 * parent.pad; spacing: win.nl ? 10 : 12 }
    }
    component Head: Label { font.pixelSize: 16; font.bold: true }
    // a live reading as a ring + number
    component Ring: Rectangle {
        property real frac: 0; property color col: palette.highlight; property string big; property string sub
        Layout.fillWidth: true; Layout.preferredWidth: 1; implicitHeight: 64; radius: 14; color: palette.base; border.color: palette.light
        onFracChanged: cv.requestPaint(); onColChanged: cv.requestPaint()
        RowLayout { anchors.fill: parent; anchors.margins: 10; spacing: 8
            Canvas { id: cv; Layout.preferredWidth: 44; Layout.preferredHeight: 44
                onPaint: { var c = getContext("2d"); c.reset(); c.lineWidth = 6; c.lineCap = "round"
                    c.strokeStyle = "" + palette.light; c.beginPath(); c.arc(22, 22, 18, 0, 2 * Math.PI); c.stroke()
                    if (frac > 0.01) { c.strokeStyle = "" + col; c.beginPath(); c.arc(22, 22, 18, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * Math.min(1, frac)); c.stroke() } } }
            ColumnLayout { Layout.fillWidth: true; spacing: 0
                Label { text: big; font.pixelSize: 18; font.bold: true; elide: Text.ElideRight; Layout.fillWidth: true }
                Label { text: sub; font.pixelSize: 11; color: win.subCol; elide: Text.ElideRight; Layout.fillWidth: true } } }
    }
    component TextTile: Rectangle {
        property string big; property string sub
        Layout.fillWidth: true; Layout.preferredWidth: 1; implicitHeight: 64; radius: 14; color: palette.base; border.color: palette.light
        ColumnLayout { anchors.fill: parent; anchors.margins: 10; spacing: 0
            Item { Layout.fillHeight: true }
            Label { text: big; font.pixelSize: 18; font.bold: true; elide: Text.ElideRight; Layout.fillWidth: true }
            Label { text: sub; font.pixelSize: 11; color: win.subCol; elide: Text.ElideRight; Layout.fillWidth: true }
            Item { Layout.fillHeight: true } }
    }
    // the brand mark of the card's maker: NVIDIA's mark in green, AMD red, Intel blue
    component BrandMark: Rectangle {
        property string vendor: "nvidia"; property int size: 44
        width: size; height: size; radius: 8; color: "#0c0a1d"; border.color: palette.mid
        Shape { visible: vendor === "nvidia"; x: parent.size * 0.15; y: parent.size * 0.15; width: 24; height: 24; scale: parent.size * 0.7 / 24; transformOrigin: Item.TopLeft
            ShapePath { fillColor: "#76b900"; strokeColor: "transparent"; fillRule: ShapePath.OddEvenFill
                PathSvg { path: "M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z" } } }
        Label { visible: vendor !== "nvidia"; anchors.centerIn: parent; text: vendor === "amd" ? "AMD" : "Intel"; font.bold: true; font.pixelSize: parent.size * 0.3
                color: vendor === "amd" ? "#ed1c24" : "#3d9bff" }
    }
    // a screen's picture from what it reports (any brand): shape from its resolution, TV from its name or an HDMI screen of 40" or more
    function screenArt(sc, col) {
        var m = String(sc.mode || "").match(/(\d+)x(\d+)/), r = m ? +m[1] / +m[2] : 16 / 9, body
        if (r >= 3.2) body = '<path d="M4 7 Q60 2 116 7 V38 Q60 33 4 38 Z"/><path d="M60 36 V48 M48 50 H72"/>'
        else if (r >= 2.2) body = '<rect x="19" y="4" width="82" height="34" rx="2"/><path d="M60 38 V48 M48 50 H72"/>'
        else if (/\bTV\b/i.test(sc.label || "") || (sc.port === "HDMI" && (sc.inch || 0) >= 40)) body = '<rect x="14" y="3" width="92" height="42" rx="1.5"/><path d="M28 45 L22 53 H30 M92 45 L98 53 H90"/>'
        else body = '<rect x="27" y="3" width="66" height="38" rx="3"/><path d="M60 41 V50 M48 52 H72"/>'
        return "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 56" fill="none" stroke="' + col + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">' + body + '</svg>')
    }
    function portName(p) { return p === "DP" ? "DisplayPort" : p === "HDMI" ? "HDMI" : p === "eDP" ? "Built-in" : (p || "") }
    function pickScreen(sc) {
        var moves = !s.game_mode && s.present && s.driver_loaded && sc.kind !== s.desktop_on
        if (moves) { confirmScreen.pick = sc; confirmScreen.open() } else act("set-screen", { connector: sc.name })
    }
    component Badge: Rectangle {
        property string text; property bool lit
        radius: 10; height: 22; width: lbl.implicitWidth + 18
        color: lit ? palette.highlight : "transparent"; border.color: lit ? palette.highlight : palette.mid
        Label { id: lbl; anchors.centerIn: parent; text: parent.text; font.pixelSize: 11; font.capitalization: Font.AllUppercase
                color: parent.lit ? palette.highlightedText : palette.windowText }
    }
    component NvRow: Frame {
        property string key; property string title; property string desc; property var opts: []
        property string when: "Next game launch"   // when a change takes effect (shown on the row)
        Layout.fillWidth: true; padding: 10
        RowLayout { anchors.fill: parent; spacing: 12
            ColumnLayout { Layout.fillWidth: true; spacing: 2
                RowLayout { spacing: 8
                    Label { text: title; font.pixelSize: 14 }
                    Label { text: when; font.pixelSize: 10; opacity: 0.85; color: when === "Instant" ? "#5fd35f" : palette.highlight
                            padding: 2; leftPadding: 6; rightPadding: 6; background: Rectangle { radius: 8; color: "transparent"; border.color: parent.color } } }
                Label { Layout.fillWidth: true; text: desc; wrapMode: Text.WordWrap; opacity: 0.65; font.pixelSize: 11 }
                Label { readonly property var st: (win.gs.settings || {})[key]; visible: !!win.gs.running && !!st; Layout.fillWidth: true; wrapMode: Text.WordWrap
                        font.pixelSize: 11; textFormat: Text.StyledText
                        text: st ? "<font color='" + win.gsLook(st.state)[0] + "'><b>\u25CF " + win.gsLook(st.state)[1] + "</b></font>"
                                   + (st.state !== "active" && st.state !== "default" ? "  ·  " + st.why : "") : "" } }
            ComboBox { Layout.preferredWidth: 250; model: opts.map(function(o) { return o[1] })
                currentIndex: Math.max(0, opts.map(function(o) { return String(o[0]) }).indexOf(String(win.nvEdit[key] === undefined ? opts[0][0] : win.nvEdit[key])))
                onActivated: function(i) { var e = Object.assign({}, win.nvEdit); e[key] = opts[i][0]; win.saveNv(e) } } }
    }
    component Cell: Frame {
        property string value; property string unit; property string label
        Layout.fillWidth: true; Layout.preferredWidth: 1
        ColumnLayout { anchors.fill: parent; spacing: 2
            Label { Layout.alignment: Qt.AlignHCenter; text: value + (unit ? " " + unit : ""); font.pixelSize: 20; font.bold: true }
            Label { Layout.alignment: Qt.AlignHCenter; text: label; font.pixelSize: 11; opacity: 0.7; font.capitalization: Font.AllUppercase } }
    }

    // new look: the tabs along the top, the support report at the right
    Rectangle {
        id: hdr
        visible: win.nl; height: win.nl ? 56 : 0; anchors { top: parent.top; left: parent.left; right: parent.right }
        color: win.nl ? "#120f2a" : "transparent"
        Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: palette.light }
        RowLayout { anchors.fill: parent; anchors.leftMargin: 20; anchors.rightMargin: 20; spacing: 22
            RowLayout { spacing: 10
                Image { source: Qt.resolvedUrl("egpu-buddy.png"); Layout.preferredWidth: 32; Layout.preferredHeight: 32; sourceSize.width: 64; smooth: true }
                Label { text: win.appName; font.pixelSize: 17; font.bold: true }
                Label { text: win.s.installed || ""; font.pixelSize: 12; color: win.subCol } }
            Repeater { model: [{ t: "Overview", i: 0 }, { t: win.nvb ? "GPU settings" : "NVIDIA settings", i: 1 }, { t: "Extras and setup", i: 2 }]
                AbstractButton { id: tb
                    visible: modelData.i !== 1 || win.nvShow
                    Layout.fillHeight: true; checked: win.pg === modelData.i
                    onClicked: { win.page = modelData.i; if (modelData.i === 1) win.loadNv() }
                    contentItem: Label { text: modelData.t; font.bold: tb.checked; leftPadding: 16; rightPadding: 16; verticalAlignment: Text.AlignVCenter; color: tb.checked ? palette.windowText : "#c9c5ea" }
                    background: Rectangle { color: "transparent"
                        Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 3; visible: tb.checked; color: modelData.i === 1 ? win.brandCol : palette.highlight } } } }
            Item { Layout.fillWidth: true }
            Button { text: win.updLabel; onClicked: updateDlg.open() }
            Button { text: "Save support report"; onClicked: win.act("report") }
        }
    }

    ScrollView {
        id: view
        anchors.top: win.nl ? hdr.bottom : parent.top; anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom; contentWidth: availableWidth
        background: Rectangle { color: palette.window }
        ColumnLayout {
            id: pageCol
            width: win.width - 32; x: 16; y: win.nl ? 10 : 12; spacing: win.nl ? 10 : 12
            RowLayout { Layout.fillWidth: true; spacing: 10; visible: !win.nl
                Label { text: win.appName; font.pixelSize: 22; font.bold: true }
                Label { text: "experimental"; visible: win.nvb; opacity: 0.6; font.pixelSize: 11 }
                Label { text: (win.g.name && win.s.dock ? win.s.dock + " · " + win.g.name.replace(/^NVIDIA\s+(GeForce\s+)?/i, "") : win.g.name) || (win.s.present ? "NVIDIA GPU (driver not loaded)" : win.nvb ? "no NVIDIA card yet (the driver is ready)" : "not detected"); opacity: 0.75; Layout.fillWidth: true; Layout.preferredWidth: 120; wrapMode: Text.WordWrap; maximumLineCount: 2 }   // wraps: the dock + full GPU name was cut off in a narrow window
                Badge { text: win.s.present ? "On the bus" : "No eGPU"; lit: !!win.s.present; visible: !win.nvb }
                Badge { text: win.s.tunnel ? "Tunnel up" : "No tunnel"; lit: !!win.s.tunnel; visible: !win.nvb }
                Badge { text: win.s.driver_loaded ? "Driver loaded" : "Driver unloaded"; lit: !!win.s.driver_loaded }
                Badge { text: win.s.game_mode ? "Game Mode" : "Desktop"; lit: true }
                Button { text: "New look"; flat: true; onClicked: win.act("set-look", { value: "new" }) }
            }
            // NVIDIA settings (experimental) get their own tab, shown with an NVIDIA eGPU only
            TabBar { id: tabs; Layout.fillWidth: true; visible: win.nvShow && !win.nl; currentIndex: win.page; onCurrentIndexChanged: win.page = currentIndex
                TabButton { text: win.nvb ? "GPU" : "eGPU" }
                TabButton { text: "NVIDIA settings  ·  experimental"; onClicked: win.loadNv() } }
            ColumnLayout { Layout.fillWidth: true; spacing: 10; visible: win.page === 1 && win.nvShow
                RowLayout { Layout.fillWidth: true
                    ColumnLayout { Layout.fillWidth: true; spacing: 2
                        Label { text: "Global settings"; font.pixelSize: 17; font.bold: true }
                        Label { visible: !!win.gs.running; font.pixelSize: 12; textFormat: Text.StyledText; color: "#7fc4ff"
                                text: { var st = Object.keys(win.gs.settings || {}).map(function(k) { return win.gs.settings[k].state }), set = st.filter(function(x) { return x !== "default" }).length
                                        return "<b>Running: " + (win.gs.game || "") + "</b>  ·  " + (set ? st.filter(function(x) { return x === "active" }).length + " of " + set + " changed settings active in this game" : "every setting is on its default") } }
                        Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; opacity: 0.7
                            text: win.nvb ? "Used by every game Steam starts on the NVIDIA GPU. Nothing is changed while a setting is on its default."
                                : "Used by every game that renders on the NVIDIA eGPU. Games on the handheld's own GPU never get them, and nothing is changed while a setting is on its default." } }
                    Badge { text: "Experimental"; lit: true }
                    Button { text: "Restore"; onClicked: win.saveNv(Object.assign({}, win.nv.defaults || {})) }
                }
                NvRow { key: "low_latency"; title: "Low latency mode"; desc: "Frames queued ahead of the screen (DirectX 9-12 games). Ultra adds NVIDIA's latency pacing in DirectX 11 games."
                        opts: [["off", "Off (game decides)"], ["on", "On"], ["ultra", "Ultra"]] }
                // Ultra needs a recent Proton (DXVK 2.6+): offer the latest GE-Proton when none is installed
                Frame { Layout.fillWidth: true; padding: 10; visible: win.nvEdit.low_latency === "ultra"
                    RowLayout { anchors.fill: parent; spacing: 10
                        Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; font.pixelSize: 12
                            text: (win.nv.proton || {}).ready
                                  ? "Ultra: pick " + ((win.nv.proton.tools || []).filter(function(t) { return t.ok }).map(function(t) { return t.name }).join(" or ")) + " for the game (Properties > Compatibility), or for every game in Steam Settings > Compatibility."
                                  : "Ultra needs Proton 10, GE-Proton 10 or Proton Experimental (installed now: " + (((win.nv.proton || {}).tools || []).map(function(t) { return t.name }).join(", ") || "none found") + "). " + (((win.nv.proton || {}).install || {}).message || "") }
                        Button { text: (((win.nv.proton || {}).install || {}).state === "running") ? "Installing…" : "Install latest GE-Proton"
                                 visible: !(win.nv.proton || {}).ready; enabled: (((win.nv.proton || {}).install || {}).state !== "running")
                                 onClicked: { win.act("proton-install"); win.loadNv() } } } }
                NvRow { key: "power"; when: "Instant"; title: "Power management mode"; desc: "Prefer maximum performance holds the GPU clock up while a game runs, and lets go when it closes. Not with a GPU clock limit or on an ASUS XG Mobile."
                        opts: [["adaptive", "Adaptive (driver)"], ["max", "Prefer maximum performance"]] }
                NvRow { key: "vsync"; title: "Vertical sync"; desc: "Waits for the screen refresh to avoid tearing (DirectX 9-12 and OpenGL games). Game Mode tears only with Steam's Allow tearing."
                        opts: [["app", "Use the program setting"], ["off", "Off"], ["on", "On"]] }
                NvRow { key: "fps_limit"; title: "Max frame rate"; desc: "Caps frames per second to save power and heat (DirectX 9-12 games). In Game Mode, Steam's own limit works too; the lower one wins."
                        opts: [[0, "Off"], [30, "30 FPS"], [40, "40 FPS"], [45, "45 FPS"], [60, "60 FPS"], [72, "72 FPS"], [90, "90 FPS"], [120, "120 FPS"], [144, "144 FPS"], [165, "165 FPS"]] }
                NvRow { key: "aniso"; title: "Anisotropic filtering"; desc: "Sharper textures at steep angles (DirectX 9-11 and OpenGL games; DirectX 12 games use their own setting)."
                        opts: [[0, "Program-controlled"], [2, "2x"], [4, "4x"], [8, "8x"], [16, "16x"]] }
                NvRow { key: "sharpen"; title: "Image sharpening"; desc: "The NVIDIA driver's own sharpening (Vulkan and OpenGL games)."
                        opts: [[0, "Off"], [20, "Low (20)"], [50, "Medium (50)"], [80, "High (80)"], [100, "Maximum (100)"]] }
                NvRow { key: "shader_cache"; title: "Shader cache size"; desc: "Disk space the driver keeps for compiled shaders. Larger means less stutter in big games (the driver's default is 1 GB)."
                        opts: [["default", "Driver default"], ["1", "1 GB"], ["5", "5 GB"], ["10", "10 GB"], ["unlimited", "Unlimited"]] }
                NvRow { key: "gl_threaded"; title: "Threaded optimization"; desc: "Spreads driver work over several CPU cores (OpenGL games only; Vulkan and Proton games already do)."
                        opts: [["auto", "Auto"], ["on", "On"], ["off", "Off"]] }
                // when changes take effect: with the loader in Steam, at the next game launch; before that, one Steam restart
                Frame { Layout.fillWidth: true; padding: 10
                    RowLayout { anchors.fill: parent; spacing: 10
                        Label { Layout.fillWidth: true; wrapMode: Text.WordWrap
                            text: win.nv.loader === "loaded" ? "Changes apply the next time a game starts: no Steam restart. A game that is running keeps its settings until it is started again."
                                : win.nv.loader === "restart" || win.nv.loader === "no-steam" ? "One-time step: restart Steam so it starts with EGPU Buddy's settings loader. After that, changes apply at the next game launch."
                                : "Games get changed settings when Steam starts again." }
                        Button { text: "Restart Steam"; visible: win.nv.loader !== "loaded"; enabled: !win.s.game_mode; onClicked: { win.act("nvidia-restart-steam"); win.nvSaved = false } }
                        Button { text: "Turn off"; visible: !!win.nv.enabled; onClicked: { win.act("nvidia-off"); win.loadNv() } } } }
                Label { text: "Games with their own dxvk.conf (" + ((win.nv.games || []).length) + ")"; font.bold: true; opacity: 0.7; font.capitalization: Font.AllUppercase; font.pixelSize: 11; visible: (win.nv.games || []).length > 0 }
                Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; opacity: 0.8; visible: (win.nv.games || []).length > 0
                    text: "Their own file keeps working: each game gets " + win.appName + "'s settings first and its own file after them, so its own options win. "
                          + (win.nv.games || []).map(function(g) { return "<b>" + g.game + "</b>" + (g.overridden.length ? " (keeps its own " + g.overridden.join(", ") + ")" : "") }).join(" · ")
                    textFormat: Text.StyledText }
                Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; opacity: 0.6; font.pixelSize: 11
                    text: "* Experimental. Done with what Linux offers rather than NVIDIA's control panel: DXVK and vkd3d-proton (Proton games), the NVIDIA driver's own options, and NVIDIA's clock control, handed to each game as it starts (Steam games and non-Steam games added to Steam). A game's own launch options and its own dxvk.conf always win; EGPU_NVT_OFF=1 as a launch option keeps one game out. Turn off removes it from games completely. In Game Mode the plugin also has Steam's own live settings (frame limit, tearing, VRR, sharpness). Not available yet: FXAA, texture filtering quality, page flipping." } }
            ColumnLayout { Layout.fillWidth: true; spacing: 12; visible: win.pg === 2
                GridLayout { Layout.fillWidth: true; columns: win.width < 760 ? 1 : 2; columnSpacing: 14; rowSpacing: 14
                    Card { Layout.alignment: Qt.AlignTop; Layout.preferredWidth: 1; visible: !!win.ex.tv
                        Head { text: "Game Mode" }
                        Switch { Layout.fillWidth: true; text: "Best resolution and refresh rate on every screen"; checked: !!win.ex.game_res; onToggled: win.setEx("game_res_native", checked) }
                        Switch { Layout.fillWidth: true; text: "Steam menu fix"; visible: !!(win.ex.steam_fix || {}).available; checked: !!(win.ex.steam_fix || {}).enabled; onToggled: { win.act("steam-fix", { value: checked }); win.loadEx() } }
                        Button { text: "Wake screens"; onClicked: win.act("wake-screens") } }
                    Card { Layout.alignment: Qt.AlignTop; Layout.preferredWidth: 1
                        Head { text: "Updates" }
                        Switch { Layout.fillWidth: true; visible: !!win.ex.tv; text: "Automatic updates"; checked: !!win.ex.auto_update; onToggled: win.setEx("auto_update", checked) }
                        Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; color: win.subCol; text: "Installed " + (win.s.installed || "unknown") + (win.s.latest ? " · newest " + win.s.latest : "") }
                        RowLayout { spacing: 8
                            Button { text: win.updLabel; Layout.fillWidth: true; onClicked: updateDlg.open() }
                            Button { text: "What's new"; onClicked: updateDlg.open() } } }
                    Card { Layout.alignment: Qt.AlignTop; Layout.preferredWidth: 1; visible: !!win.ex.tv
                        RowLayout { spacing: 8
                            Head { text: "Extras" }
                            Badge { text: "testing · off by default"; lit: false } }
                        Switch { Layout.fillWidth: true; text: "USB4 link speed check"; checked: !!win.ex.usb4_on; onToggled: win.setEx("usb4", checked) }
                        Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; visible: !!win.ex.usb4_on; color: (win.ex.usb4 || {}).slow ? "#f0b429" : win.subCol
                                text: (win.ex.usb4 || {}).name ? (win.ex.usb4.name + ": " + win.ex.usb4.total + " Gb/s (" + win.ex.usb4.lanes + " x " + win.ex.usb4.per_lane + ")" + (win.ex.usb4.slow ? " · slower than USB4 should be: try another cable or port" : "")) : "No USB4 link found." }
                        Switch { Layout.fillWidth: true; text: "TV control: turn on and switch input"; checked: !!(win.ex.tv || {}).enabled; onToggled: { win.act("tv-control", { value: checked }); win.loadEx() } }
                        Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; color: win.subCol; visible: ((win.ex.tv || {}).paired || []).length > 0; text: "Paired: " + ((win.ex.tv || {}).paired || []).join(", ") }
                        Button { text: "Pair TV"; enabled: !!(win.ex.tv || {}).enabled; Layout.alignment: Qt.AlignLeft; onClicked: win.act("pair-tv") } }
                    Card { Layout.alignment: Qt.AlignTop; Layout.preferredWidth: 1
                        Head { text: "Look and support" }
                        Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; color: win.subCol; text: "Classic is the app as it was before: the same controls on the old layout." }
                        RowLayout { spacing: 8
                            Button { text: "New look"; highlighted: true; enabled: false }
                            Button { text: "Classic look"; onClicked: { win.act("set-look", { value: "classic" }); win.page = 0 } }
                            Button { text: "Save support report"; onClicked: win.act("report") } } }
                    Card { Layout.alignment: Qt.AlignTop; Layout.preferredWidth: 1; Layout.columnSpan: win.width < 760 ? 1 : 2
                        Head { text: "Only in the Game Mode plugin for now" }
                        Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; color: win.subCol
                                text: "Keep awake, the NVIDIA beta driver and revert (they detach the eGPU and rebuild the driver, so they stay where Game Mode can show their progress), repair and uninstall." } }
                }
            }
            ColumnLayout { Layout.fillWidth: true; spacing: 12; visible: win.pg === 0
            // ---- new look: Overview ----
            Card { visible: win.nl
                RowLayout { Layout.fillWidth: true; spacing: 12
                    ColumnLayout { spacing: 0; Layout.preferredWidth: 150; visible: win.s.handheld !== undefined && win.s.handheld !== ""
                        Image { Layout.alignment: Qt.AlignHCenter; Layout.preferredWidth: 130; Layout.preferredHeight: 56; fillMode: Image.PreserveAspectFit; sourceSize.height: 56 * Screen.devicePixelRatio; smooth: true; source: win.s.handheld ? win.api + "/handheld.svg" : "" }
                        Label { Layout.alignment: Qt.AlignHCenter; text: (win.s.handheld || "").replace(/^(Lenovo|ASUS|MSI|AYANEO) /, ""); font.bold: true }
                        Label { Layout.alignment: Qt.AlignHCenter; text: win.s.panel_enabled == null ? "" : win.s.panel_enabled ? "handheld screen on" : "handheld screen off"; font.pixelSize: 11; color: win.subCol } }
                    ColumnLayout { Layout.fillWidth: true; Layout.preferredWidth: 1; spacing: 4
                        Rectangle { Layout.fillWidth: true; height: 3; radius: 2; color: win.s.present && win.s.tunnel ? palette.highlight : palette.mid }
                        Label { Layout.alignment: Qt.AlignHCenter; text: win.s.present ? (win.s.tunnel ? "USB4 · connected" : "on the bus · no tunnel") : "no eGPU"; font.pixelSize: 11; color: win.subCol } }
                    RowLayout { spacing: 10
                        BrandMark { vendor: win.vendorKey }
                        ColumnLayout { spacing: 0
                            Label { text: (win.g.name || "").replace(/^NVIDIA\s+(GeForce\s+)?/i, "") || (win.s.present ? "GPU (driver not loaded)" : win.nvb ? "no NVIDIA card yet" : "not detected"); font.bold: true }
                            Label { text: (win.s.dock ? win.s.dock + " · " : "") + (win.g.driver_version ? "driver " + win.g.driver_version : (win.s.driver_loaded ? "driver loaded" : "driver unloaded")); font.pixelSize: 11; color: win.subCol } } }
                    ColumnLayout { Layout.fillWidth: true; Layout.preferredWidth: 1; spacing: 4; visible: !win.nvb
                        Rectangle { Layout.fillWidth: true; height: 3; radius: 2; color: win.s.present && (win.s.displays || []).length ? palette.highlight : palette.mid }
                        Label { Layout.alignment: Qt.AlignHCenter; text: (win.s.displays || []).length + ((win.s.displays || []).length === 1 ? " screen" : " screens"); font.pixelSize: 11; color: win.subCol } }
                    RowLayout { spacing: 12; visible: !win.nvb
                        Repeater { model: (win.s.screens || []).filter(function(x) { return x.kind === "egpu" })
                            ColumnLayout { spacing: 0
                                Image { Layout.alignment: Qt.AlignHCenter; Layout.preferredWidth: 72; Layout.preferredHeight: 34; fillMode: Image.PreserveAspectFit; sourceSize.height: 34 * Screen.devicePixelRatio; smooth: true; source: win.screenArt(modelData, "#ece9ff") }
                                Label { Layout.alignment: Qt.AlignHCenter; text: modelData.label; font.bold: true; font.pixelSize: 12 }
                                Label { Layout.alignment: Qt.AlignHCenter; text: win.s.screen_pick === modelData.name ? "main screen" : "on"; font.pixelSize: 11; color: win.subCol } } } }
                }
            }
            GridLayout { Layout.fillWidth: true; visible: win.nl; columns: win.width < 1000 ? 3 : 6; columnSpacing: 10; rowSpacing: 10
                Ring { frac: (+win.g["temperature.gpu"] || 0) / 100; big: win.num(win.g["temperature.gpu"]) + " °C"; sub: "temperature" }
                Ring { col: "#d36bff"; frac: win.isNum(win.g["power.limit"]) ? (+win.g["power.draw"] || 0) / (+win.g["power.limit"] || 1) : win.xgTarget ? (+win.g["power.draw"] || 0) / (+win.xgLive.target || 1) : 0
                       big: win.num(win.g["power.draw"]) + " W"; sub: win.isNum(win.g["power.limit"]) ? "of " + win.num(win.g["power.limit"]) + " W" : win.xgTarget ? "of " + win.num(win.xgLive.target) + " W" : "power" }
                Ring { frac: (+win.g["utilization.gpu"] || 0) / 100; big: win.num(win.g["utilization.gpu"]) + "%"; sub: "GPU busy" }
                Ring { col: "#d36bff"; frac: (+win.g["memory.used"] || 0) / (+win.g["memory.total"] || 1); big: win.g["memory.used"] ? win.num(win.g["memory.used"] / 1024, 1) + " GB" : "–"; sub: win.g["memory.total"] ? "of " + win.num(win.g["memory.total"] / 1024) + " GB VRAM" : "VRAM" }
                TextTile { big: win.num(win.g["clocks.gr"]) + " MHz"; sub: "GPU · memory " + win.num(win.g["clocks.mem"]) + " MHz" }
                TextTile { big: win.g["pcie.link.gen.current"] ? "Gen" + win.g["pcie.link.gen.current"] + " x" + win.g["pcie.link.width.current"] : "–"
                           sub: "PCIe link" + (win.isNum(win.g["fan.speed"]) ? " · fan " + win.num(win.g["fan.speed"]) + "%" : "") }
            }
            // ---- classic look ----
            GridLayout { Layout.fillWidth: true; visible: !win.nl; columns: 4; columnSpacing: 8; rowSpacing: 8
                Cell { value: win.num(win.g["temperature.gpu"]); unit: "°C"; label: "GPU temp" }
                Cell { value: win.num(win.g["power.draw"]); label: win.xgTarget ? "Power / target" : win.xgCap ? "Power / cap" : "Power"
                       unit: win.xgTarget ? "/ " + win.num(win.xgLive.target) + " W"
                           : win.isNum(win.g["power.limit"]) ? "/ " + win.num(win.g["power.limit"]) + " W" : win.xgCap ? "/ " + win.num(win.g["enforced.power.limit"]) + " W" : "W" }
                Cell { value: win.num(win.g["utilization.gpu"]); unit: "%"; label: "GPU util" }
                Cell { value: win.g["memory.used"] ? win.num(win.g["memory.used"] / 1024, 1) + " G" : "–"; label: "VRAM" }
                Cell { value: win.num(win.g["clocks.gr"]); unit: "MHz"; label: "GPU clock" }
                Cell { value: win.num(win.g["clocks.mem"]); unit: "MHz"; label: "Memory clock" }
                // the XG Mobile runs its own fan (automatic, or Armoury Crate's mode on Windows): no Linux interface reads it
                Cell { value: win.isNum(win.g["fan.speed"]) || !win.on || !win.xg ? win.num(win.g["fan.speed"]) : win.cap1(win.xgm.fan || "auto"); unit: win.isNum(win.g["fan.speed"]) || !win.on || !win.xg ? "%" : ""
                       label: win.isNum(win.g["fan.speed"]) || !win.on || !win.xg ? "Fan" : "XG Mobile fan mode" }
                Cell { value: win.g["pcie.link.gen.current"] ? "Gen" + win.g["pcie.link.gen.current"] + " x" + win.g["pcie.link.width.current"] : "–"; label: "PCIe link" }
            }
            Flow { Layout.fillWidth: true; spacing: 14; visible: !win.nl
                Label { text: win.appName + "  <b>" + (win.s.installed || "—") + "</b>"; textFormat: Text.StyledText }
                Label { text: "Driver  <b>" + (win.g.driver_version || "—") + "</b>"; textFormat: Text.StyledText }
                Label { text: "Bus  <b>" + (win.s.bdf || "—") + "</b>"; textFormat: Text.StyledText }
                Label { text: "VRAM  <b>" + (win.g["memory.total"] ? win.num(win.g["memory.total"] / 1024) + " GB" : "—") + "</b>"; textFormat: Text.StyledText }
                Label { text: "Displays  <b>" + ((win.s.displays || []).map(function(d) { return d.name + (d.enabled ? "" : " (off)") }).join(", ") || "none") + "</b>"; textFormat: Text.StyledText }
                Label { visible: !win.nvb; text: "Handheld panel  <b>" + (win.s.panel_enabled == null ? "—" : win.s.panel_enabled ? "on" : "off") + "</b>"; textFormat: Text.StyledText }
            }
            // NVIDIA install: the screen for the desktop and Game Mode, as in the plugin ("Show Game Mode on ..."). Moving between
            // the handheld's GPU and the eGPU restarts the desktop on that GPU alone (no crosstalk, no copies between GPUs)
            Label { text: "Screen"; font.bold: true; opacity: 0.7; font.capitalization: Font.AllUppercase; font.pixelSize: 11; visible: !win.nl && !win.nvb && (win.s.screens || []).length > 0 }
            Flow { Layout.fillWidth: true; spacing: 8; visible: !win.nl && !win.nvb && (win.s.screens || []).length > 0
                Repeater { model: win.s.screens || []
                    Button { text: modelData.label + (win.s.screen_pick === modelData.name ? "  ✓" : ""); highlighted: win.s.screen_pick === modelData.name
                             onClicked: { var moves = !win.s.game_mode && win.s.present && win.s.driver_loaded && modelData.kind !== win.s.desktop_on
                                          if (moves) { confirmScreen.pick = modelData; confirmScreen.open() } else win.act("set-screen", { connector: modelData.name }) } } }
            }
            Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; opacity: 0.6; font.pixelSize: 11; visible: !win.nl && !win.nvb && (win.s.screens || []).length > 0
                text: "The desktop and Game Mode both start on the screen picked here (or in the plugin). On the handheld's screen the games still render on the eGPU." }
            Card {
            Label { text: "Power"; font.bold: true; opacity: 0.7; font.capitalization: Font.AllUppercase; font.pixelSize: 11; visible: !win.nl }
            // ASUS XG Mobile: power target (W), fan mode and lights
            Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; opacity: 0.8; visible: win.on && win.xg && !win.plOk
                text: "NVIDIA does not let the driver set this GPU's power limit (its cap is " + win.xgTop + " W). A power target below it makes EGPU Buddy hold the GPU there by limiting its clock"
                      + (win.xgTarget && +win.xgLive.cap ? " (clock now held at " + win.xgLive.cap + " MHz)" : "") + ". The fan mode is set in the XG Mobile itself." }
            RowLayout { Layout.fillWidth: true; spacing: 10; visible: win.on && win.xg && !win.plOk
                Label { text: "Power target" }
                Slider { id: pt; Layout.fillWidth: true; from: 40; to: 115; stepSize: 5; value: 115; onMoved: win.ptTouched = true }
                Label { text: Math.round(pt.value) >= win.xgTop ? "No target" : Math.round(pt.value) + " W"; Layout.preferredWidth: 80; horizontalAlignment: Text.AlignRight }
                Button { text: "Apply"; onClicked: { win.act("xgm-power", { value: Math.round(pt.value) >= win.xgTop ? "off" : Math.round(pt.value) }); win.ptTouched = false } }
            }
            Label { text: "XG Mobile"; font.bold: true; opacity: 0.7; font.capitalization: Font.AllUppercase; font.pixelSize: 11; visible: win.on && win.xg }
            Item { id: intro; Layout.fillWidth: true; visible: win.introShowing && win.on && win.xg
                Layout.preferredHeight: visible ? introImg.height : 0
                AnimatedImage { id: introImg; anchors.horizontalCenter: parent.horizontalCenter
                    width: Math.min(480, parent.width); height: width * 316 / 560; fillMode: Image.PreserveAspectFit
                    source: win.introShowing ? "file:///usr/local/share/egpu-buddy/xgm-intro.gif" : ""; playing: win.introShowing
                    onStatusChanged: if (status === AnimatedImage.Error) { win.introShowing = false; win.introDone = true }
                    onCurrentFrameChanged: if (frameCount > 1 && currentFrame === frameCount - 1) introFade.start()
                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: introFade.start() } }
                NumberAnimation { id: introFade; target: introImg; property: "opacity"; to: 0; duration: 600
                    onFinished: { win.introShowing = false; win.introDone = true; win.call("POST", "/api/action", { action: "xgm-intro-seen" }, function() {}) } }
            }
            RowLayout { Layout.fillWidth: true; spacing: 8; visible: win.on && win.xg
                Label { text: "Fan"; Layout.preferredWidth: 90 }
                Repeater { model: win.fanModes
                    Button { text: modelData === "custom" ? "Custom…" : win.cap1(modelData); highlighted: (win.xgm.fan || "auto") === modelData
                             Layout.fillWidth: true; onClicked: modelData === "custom" ? curveDlg.open() : win.act("xgm-fan", { value: modelData }) } }
            }
            RowLayout { Layout.fillWidth: true; spacing: 8; visible: win.on && win.xg
                Label { text: "Lights"; Layout.preferredWidth: 90 }
                Switch { checked: win.xgm.light !== false; onToggled: win.act("xgm-light", { value: checked ? "on" : "off" }) }
                ComboBox { model: win.effects.map(win.cap1); currentIndex: Math.max(0, win.effects.indexOf(win.xgm.effect || "static")); enabled: win.xgm.light !== false
                           onActivated: function(i) { win.lightFx(win.effects[i]) } }
                Repeater { model: win.swatches
                    Rectangle { width: 24; height: 24; radius: 12; color: "#" + modelData; opacity: win.xgm.light !== false ? 1 : 0.35
                                border.width: (win.xgm.color || "ff0000") === modelData ? 3 : 1; border.color: (win.xgm.color || "ff0000") === modelData ? palette.highlight : palette.mid
                                MouseArea { anchors.fill: parent; enabled: win.xgm.light !== false; onClicked: win.lightFx("", modelData) } } }
                ComboBox { model: ["Slow", "Normal", "Fast"]; currentIndex: Math.max(0, ["slow", "normal", "fast"].indexOf(win.xgm.speed || "normal")); enabled: win.xgm.light !== false
                           onActivated: function(i) { win.lightFx("", "", ["slow", "normal", "fast"][i]) } }
                Item { Layout.fillWidth: true }
                Label { text: "Brightness" }
                Slider { from: 0; to: 3; stepSize: 1; snapMode: Slider.SnapAlways; value: win.xgm.brightness === undefined ? 3 : win.xgm.brightness; Layout.preferredWidth: 110
                         onMoved: win.act("xgm-brightness", { value: Math.round(value) }) }
            }
            RowLayout { Layout.fillWidth: true; spacing: 8; visible: win.on && win.xg
                Label { text: "Clock offsets"; Layout.preferredWidth: 90 }
                Label { text: "Core" }
                Slider { id: coreOff; Layout.fillWidth: true; from: -300; to: 300; stepSize: 15; value: 0; onMoved: win.offTouched = true }
                Label { text: (coreOff.value > 0 ? "+" : "") + Math.round(coreOff.value) + " MHz"; Layout.preferredWidth: 70 }
                Label { text: "Memory" }
                Slider { id: memOff; Layout.fillWidth: true; from: -1000; to: 1500; stepSize: 50; value: 0; onMoved: win.offTouched = true }
                Label { text: (memOff.value > 0 ? "+" : "") + Math.round(memOff.value) + " MHz"; Layout.preferredWidth: 70 }
                Button { text: "Apply"; onClicked: { win.act("xgm-offset", { value: Math.round(coreOff.value) + ":" + Math.round(memOff.value) }); win.offTouched = false } }
            }
            Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; opacity: 0.8; visible: win.on && !win.xg && !win.plOk
                text: "This GPU does not take a power limit from the driver (a laptop-class GPU, as in an ASUS XG Mobile): the dock sets its power"
                      + (win.xgCap ? " (cap now " + win.num(win.g["enforced.power.limit"]) + " W" + (win.isNum(win.g["power.max_limit"]) ? ", at most " + win.num(win.g["power.max_limit"]) + " W" : "") + ")" : "")
                      + ". Limit its clock instead to lower power and heat." }
            RowLayout { Layout.fillWidth: true; spacing: 10; visible: win.on && !win.xg && !win.plOk && win.clkMax > 0
                Label { text: "Max GPU clock" }
                Slider { id: clkSl; Layout.fillWidth: true; from: 600; to: 3000; stepSize: 15; value: 3000; onMoved: win.clkTouched = true }
                Label { text: Math.round(clkSl.value) + " MHz" + (+(win.g.clock_limit || 0) && !win.clkTouched ? " (on)" : ""); Layout.preferredWidth: 110; horizontalAlignment: Text.AlignRight }
                Button { text: "Apply"; onClicked: { win.act("clock-limit", { mhz: Math.round(clkSl.value) }); win.clkTouched = false } }
            }
            RowLayout { Layout.fillWidth: true; spacing: 10; visible: !win.on || win.plOk
                Label { text: "Power limit" }
                Slider { id: pl; Layout.fillWidth: true; from: 100; to: 320; stepSize: 5; value: 320; enabled: win.on; onMoved: win.sliderTouched = true }
                Label { text: win.on ? Math.round(pl.value) + " W" : "– W"; Layout.preferredWidth: 60; horizontalAlignment: Text.AlignRight }
                Button { text: "Apply"; enabled: win.on; opacity: enabled ? 1 : 0.4; onClicked: { win.act("power-limit", { watts: Math.round(pl.value) }); win.sliderTouched = false } }
                Button { text: "Reset clocks"; visible: win.nl; enabled: win.on; onClicked: { win.clkTouched = false; win.ptTouched = false; win.offTouched = false; win.act("reset-clocks") } }
            }
            Button { text: "Reset clocks"; visible: win.nl && win.on && (win.xg || !win.plOk); Layout.alignment: Qt.AlignLeft; onClicked: { win.clkTouched = false; win.ptTouched = false; win.offTouched = false; win.act("reset-clocks") } }
            }
            RowLayout { Layout.fillWidth: true; visible: win.nl && !win.nvb; spacing: 14
                Card { visible: (win.s.screens || []).length > 0; Layout.alignment: Qt.AlignTop; Layout.preferredWidth: 17
                    Head { text: "Show the desktop on" }
                    Flow { Layout.fillWidth: true; spacing: 10
                        Repeater { model: win.s.screens || []
                            AbstractButton { id: sb
                                readonly property bool sel: win.s.screen_pick === modelData.name
                                readonly property bool moves: !win.s.game_mode && !!win.s.present && !!win.s.driver_loaded && modelData.kind !== win.s.desktop_on
                                width: 150; height: 118
                                onClicked: win.pickScreen(modelData)
                                background: Rectangle { radius: 12; color: sb.sel ? palette.alternateBase : palette.window; border.width: sb.sel ? 2 : 1; border.color: sb.sel ? palette.highlight : palette.mid }
                                contentItem: ColumnLayout { spacing: 2
                                    Item { Layout.fillHeight: true }
                                    Image { Layout.alignment: Qt.AlignHCenter; Layout.preferredWidth: 100; Layout.preferredHeight: 44; fillMode: Image.PreserveAspectFit; sourceSize.height: 44 * Screen.devicePixelRatio; smooth: true
                                            source: modelData.name.indexOf("eDP") === 0 && win.s.handheld ? win.api + "/handheld.svg" : win.screenArt(modelData, sb.sel ? "#2ee6f0" : "#ece9ff") }
                                    Label { Layout.alignment: Qt.AlignHCenter; text: win.portName(modelData.port); font.pixelSize: 11; color: win.subCol }
                                    Label { Layout.alignment: Qt.AlignHCenter; Layout.maximumWidth: 138; elide: Text.ElideRight; text: modelData.label; font.bold: true }
                                    Label { Layout.alignment: Qt.AlignHCenter; text: sb.sel ? "picked" : sb.moves ? "restarts the desktop" : (modelData.mode || ""); font.pixelSize: 11; color: sb.sel ? palette.highlight : win.subCol }
                                    Item { Layout.fillHeight: true } } } } }
                    Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; font.pixelSize: 11; color: win.subCol
                            text: "Only the picked screen shows an image. Game Mode starts on it too. On the handheld's screen the games still render on the eGPU." } }
                Card { Layout.alignment: Qt.AlignTop; Layout.preferredWidth: 10
                    Head { text: "Unplugging" }
                    Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; color: win.subCol; text: "Safe Detach moves everything to the handheld and switches the card off. Unplug when it says so." }
                    Button { id: sdBtn; text: "Safe Detach"; Layout.fillWidth: true; Layout.preferredHeight: 50; enabled: !!win.s.present; onClicked: confirmDetach.open()
                             background: Rectangle { radius: 12; color: sdBtn.enabled ? (sdBtn.down ? "#1fb8c1" : palette.highlight) : palette.mid }
                             contentItem: Label { text: sdBtn.text; font.pixelSize: 16; font.bold: true; color: sdBtn.enabled ? palette.highlightedText : win.subCol; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter } }
                    Button { text: "Re-attach"; Layout.fillWidth: true; enabled: !(win.s.present && win.s.driver_loaded); onClicked: win.act("attach") } }
            }
            Label { text: win.nvb ? "Clocks and updates" : "Lifecycle"; font.bold: true; opacity: 0.7; font.capitalization: Font.AllUppercase; font.pixelSize: 11; visible: !win.nl }
            RowLayout { Layout.fillWidth: true; spacing: 10; visible: !win.nl
                Button { text: "Safe Detach"; visible: !win.nvb; Layout.fillWidth: true; enabled: !!win.s.present; opacity: enabled ? 1 : 0.4; onClicked: confirmDetach.open() }
                Button { text: "Re-attach"; visible: !win.nvb; Layout.fillWidth: true; enabled: !(win.s.present && win.s.driver_loaded); opacity: enabled ? 1 : 0.4; onClicked: win.act("attach") }
                Button { text: "Reset clocks"; Layout.fillWidth: true; enabled: win.on; opacity: enabled ? 1 : 0.4; onClicked: { win.clkTouched = false; win.ptTouched = false; win.offTouched = false; win.act("reset-clocks") } }
                Button { text: win.updLabel; Layout.fillWidth: true; onClicked: updateDlg.open() }
            }
            }
            Frame { Layout.fillWidth: true
                Label { width: parent.width; wrapMode: Text.WordWrap; text: win.msg; color: win.msgErr ? "#e05555" : palette.windowText } }
            Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; opacity: 0.6; font.pixelSize: 11
                text: win.nvb ? "Closing this window keeps NV GPU Buddy in the system tray." : "Safe Detach moves the desktop back to the handheld and removes the card; only then unplug. Closing this window keeps EGPU Buddy in the system tray." }
        }
    }

    // ---- self-test: one frame to a PNG, then quit ----
    readonly property bool shotFull: Qt.application.arguments.indexOf("--full") >= 0   // --full: the whole page, not only what fits the window
    readonly property string shot: Qt.application.arguments.indexOf("--shot") >= 0 ? (Qt.application.arguments[Qt.application.arguments.indexOf("--shot") + 1] || "") : ""
    // the header is outside the scroll area: saved as <shot>.hdr.png, the rest as <shot>
    Timer { id: shotTimer; interval: 600
        function body() { (win.shotFull ? pageCol : view).grabToImage(function(r) { console.log("shot saved: " + r.saveToFile(win.shot)); Qt.quit() }) }
        onTriggered: { if (win.nl) hdr.grabToImage(function(h) { h.saveToFile(win.shot + ".hdr.png"); body() }); else body() } }
}
