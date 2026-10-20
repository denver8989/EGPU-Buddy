// EGPU Buddy desktop app: native Qt6/QML window + system-tray icon around the local backend (egpu-buddy-server.py).
// Why QML: SteamOS ships KDE Plasma, so Qt6 + QtQuick Controls + Qt.labs.platform are always there, while WebKitGTK is not
// (the app used to fall back to a browser tab on SteamOS). Run by the launcher (which also selects the Fusion style and Qt's generic platform theme, see there)
// Test hook: `-- --shot /path.png` renders one frame after the first status, saves it and quits (used with the offscreen platform).
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Qt.labs.platform as Platform

ApplicationWindow {
    id: win
    width: 900; height: 640; minimumWidth: 640; minimumHeight: 520
    readonly property bool startHidden: Qt.application.arguments.indexOf("--tray") >= 0
    visible: !startHidden
    property int showSeq: -1                   // the launcher asks a running instance to show itself through the backend
    title: "EGPU Buddy"
    // own dark palette + the Fusion style (selected by the launcher): the same look on every desktop theme and distro
    palette { window: "#0b1016"; windowText: "#dfe8f0"; base: "#101720"; alternateBase: "#162030"; text: "#dfe8f0"
              button: "#1b2633"; buttonText: "#dfe8f0"; highlight: "#1a9fff"; highlightedText: "#ffffff"
              mid: "#3a4a5c"; dark: "#070a0e"; light: "#2a3848"; placeholderText: "#7f8fa0"; toolTipBase: "#162030"; toolTipText: "#dfe8f0" }
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
    property string msg: "Ready."
    property bool msgErr: false
    property bool updSeen: false
    readonly property var upd: (s.update || {})
    readonly property bool updRunning: upd.state === "running"

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
        tooltip: "EGPU Buddy — " + (win.s.present ? (win.g.name || "eGPU on the bus") : "no eGPU")
        onActivated: function(reason) { if (reason !== Platform.SystemTrayIcon.Context) { win.show(); win.raise(); win.requestActivate() } }
        menu: Platform.Menu {
            Platform.MenuItem { text: "Open EGPU Buddy"; onTriggered: { win.show(); win.raise(); win.requestActivate() } }
            Platform.MenuSeparator {}
            Platform.MenuItem { text: "Safe Detach…"; enabled: !!win.s.present; onTriggered: { win.show(); win.raise(); confirmDetach.open() } }
            Platform.MenuItem { text: "Re-attach"; enabled: !(win.s.present && win.s.driver_loaded); onTriggered: win.act("attach") }
            Platform.MenuSeparator {}
            Platform.MenuItem { text: win.updRunning ? "Updating… (show progress)" : "Update EGPU Buddy…"; onTriggered: { win.show(); win.raise(); win.requestActivate(); updateDlg.open() } }
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
        title: "Update EGPU Buddy"; modal: true; anchors.centerIn: parent; width: Math.min(win.width - 80, 560)
        closePolicy: phase === "running" ? Popup.NoAutoClose : Popup.CloseOnEscape
        onOpened: askedAt = 0
        ColumnLayout { width: parent.width; spacing: 10
            Label { Layout.fillWidth: true; wrapMode: Text.WordWrap
                text: updateDlg.phase === "confirm" ? "Installed: " + (win.s.installed || "unknown") + ".\nDownload the latest release and update the system integration and the Game Mode plugin? The NVIDIA driver is not changed. The eGPU can stay attached; this window shows the progress."
                    : updateDlg.phase === "starting" ? "Starting…" : (win.upd.step || "")
                color: updateDlg.phase === "result" && win.upd.state === "failed" ? "#e05555" : palette.windowText }
            ProgressBar { Layout.fillWidth: true; visible: updateDlg.phase === "running" || updateDlg.phase === "starting"; from: 0; to: 100
                value: win.upd.pct || 0; indeterminate: updateDlg.phase === "starting" }
            Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; opacity: 0.6; font.pixelSize: 11; visible: updateDlg.phase === "running"
                text: "EGPU Buddy restarts itself when the update is done." }
            RowLayout { Layout.alignment: Qt.AlignRight
                Button { text: "Update"; visible: updateDlg.phase === "confirm"; onClicked: { updateDlg.askedAt = Date.now() / 1000 - 2; win.act("update") } }
                Button { text: updateDlg.phase === "running" || updateDlg.phase === "starting" ? "Hide" : "Close"; onClicked: updateDlg.close() } }
        }
    }

    component Badge: Rectangle {
        property string text; property bool lit
        radius: 10; height: 22; width: lbl.implicitWidth + 18
        color: lit ? palette.highlight : "transparent"; border.color: lit ? palette.highlight : palette.mid
        Label { id: lbl; anchors.centerIn: parent; text: parent.text; font.pixelSize: 11; font.capitalization: Font.AllUppercase
                color: parent.lit ? palette.highlightedText : palette.windowText }
    }
    component Cell: Frame {
        property string value; property string unit; property string label
        Layout.fillWidth: true; Layout.preferredWidth: 1
        ColumnLayout { anchors.fill: parent; spacing: 2
            Label { Layout.alignment: Qt.AlignHCenter; text: value + (unit ? " " + unit : ""); font.pixelSize: 20; font.bold: true }
            Label { Layout.alignment: Qt.AlignHCenter; text: label; font.pixelSize: 11; opacity: 0.7; font.capitalization: Font.AllUppercase } }
    }

    ScrollView {
        id: view
        anchors.fill: parent; contentWidth: availableWidth
        background: Rectangle { color: palette.window }
        ColumnLayout {
            width: win.width - 32; x: 16; y: 12; spacing: 12
            RowLayout { Layout.fillWidth: true; spacing: 10
                Label { text: "EGPU Buddy"; font.pixelSize: 22; font.bold: true }
                Label { text: (win.g.name && win.s.dock ? win.s.dock + " · " + win.g.name.replace(/^NVIDIA\s+(GeForce\s+)?/i, "") : win.g.name) || (win.s.present ? "NVIDIA GPU (driver not loaded)" : "not detected"); opacity: 0.75; Layout.fillWidth: true; Layout.preferredWidth: 120; wrapMode: Text.WordWrap; maximumLineCount: 2 }   // wraps: the dock + full GPU name was cut off in a narrow window
                Badge { text: win.s.present ? "On the bus" : "No eGPU"; lit: !!win.s.present }
                Badge { text: win.s.tunnel ? "Tunnel up" : "No tunnel"; lit: !!win.s.tunnel }
                Badge { text: win.s.driver_loaded ? "Driver loaded" : "Driver unloaded"; lit: !!win.s.driver_loaded }
                Badge { text: win.s.game_mode ? "Game Mode" : "Desktop"; lit: true }
            }
            GridLayout { Layout.fillWidth: true; columns: 4; columnSpacing: 8; rowSpacing: 8
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
            Flow { Layout.fillWidth: true; spacing: 14
                Label { text: "Driver  <b>" + (win.g.driver_version || "—") + "</b>"; textFormat: Text.StyledText }
                Label { text: "Bus  <b>" + (win.s.bdf || "—") + "</b>"; textFormat: Text.StyledText }
                Label { text: "VRAM  <b>" + (win.g["memory.total"] ? win.num(win.g["memory.total"] / 1024) + " GB" : "—") + "</b>"; textFormat: Text.StyledText }
                Label { text: "Displays  <b>" + ((win.s.displays || []).map(function(d) { return d.name + (d.enabled ? "" : " (off)") }).join(", ") || "none") + "</b>"; textFormat: Text.StyledText }
                Label { text: "Handheld panel  <b>" + (win.s.panel_enabled == null ? "—" : win.s.panel_enabled ? "on" : "off") + "</b>"; textFormat: Text.StyledText }
            }
            Label { text: "Power"; font.bold: true; opacity: 0.7; font.capitalization: Font.AllUppercase; font.pixelSize: 11 }
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
            }
            Label { text: "Lifecycle"; font.bold: true; opacity: 0.7; font.capitalization: Font.AllUppercase; font.pixelSize: 11 }
            RowLayout { Layout.fillWidth: true; spacing: 10
                Button { text: "Safe Detach"; Layout.fillWidth: true; enabled: !!win.s.present; opacity: enabled ? 1 : 0.4; onClicked: confirmDetach.open() }
                Button { text: "Re-attach"; Layout.fillWidth: true; enabled: !(win.s.present && win.s.driver_loaded); opacity: enabled ? 1 : 0.4; onClicked: win.act("attach") }
                Button { text: "Reset clocks"; Layout.fillWidth: true; enabled: win.on; opacity: enabled ? 1 : 0.4; onClicked: { win.clkTouched = false; win.ptTouched = false; win.offTouched = false; win.act("reset-clocks") } }
                Button { text: win.updRunning ? "Updating…" : "Update"; Layout.fillWidth: true; onClicked: updateDlg.open() }
            }
            Frame { Layout.fillWidth: true
                Label { width: parent.width; wrapMode: Text.WordWrap; text: win.msg; color: win.msgErr ? "#e05555" : palette.windowText } }
            Label { Layout.fillWidth: true; wrapMode: Text.WordWrap; opacity: 0.6; font.pixelSize: 11
                text: "Safe Detach moves the desktop back to the handheld and removes the card; only then unplug. Closing this window keeps EGPU Buddy in the system tray." }
        }
    }

    // ---- self-test: one frame to a PNG, then quit ----
    readonly property string shot: Qt.application.arguments.indexOf("--shot") >= 0 ? (Qt.application.arguments[Qt.application.arguments.indexOf("--shot") + 1] || "") : ""
    Timer { id: shotTimer; interval: 600; onTriggered: view.grabToImage(function(r) { console.log("shot saved: " + r.saveToFile(win.shot)); Qt.quit() }) }
}
