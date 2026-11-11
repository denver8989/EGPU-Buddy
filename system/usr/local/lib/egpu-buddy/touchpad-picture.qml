// The touchpad picture on the handheld screen while KDE drives it (no eGPU, desktop): a layer-shell overlay on that
// screen alone, above everything (wallpaper, panels, windows), never focused. egpu-touchpad starts it as the session
// user with the connector name as the last argument and the picture in /run/egpu-touchpad-picture.pgm, and ends it.
// KDE re-homes a layer surface to another screen when its screen goes away for a moment (a layout change): it is
// checked every second, hidden while its screen is missing, and put back on it (it showed on the XR glasses).
import QtQuick
import QtQuick.Window
import org.kde.layershell 1.0 as LayerShell

Window {
    id: w
    readonly property string want: Qt.application.arguments[Qt.application.arguments.length - 1]
    color: "black"
    flags: Qt.FramelessWindowHint | Qt.WindowDoesNotAcceptFocus
    LayerShell.Window.scope: "egpu-touchpad-picture"
    LayerShell.Window.layer: LayerShell.Window.LayerOverlay
    LayerShell.Window.anchors: LayerShell.Window.AnchorTop | LayerShell.Window.AnchorBottom | LayerShell.Window.AnchorLeft | LayerShell.Window.AnchorRight
    LayerShell.Window.exclusionZone: -1
    LayerShell.Window.keyboardInteractivity: LayerShell.Window.KeyboardInteractivityNone
    LayerShell.Window.wantsToBeOnActiveScreen: false
    LayerShell.Window.screenConfiguration: LayerShell.Window.ScreenFromQWindow   // this window's screen, not the active one
    Image { anchors.fill: parent; source: "file:///run/egpu-touchpad-picture.pgm"; cache: false; fillMode: Image.Stretch; smooth: false }

    function target() {
        for (const s of Qt.application.screens) if (s.name === want) return s
        return null
    }
    function place() {
        const t = target()
        if (!t) { if (visible) visible = false; return }
        if (visible && screen && screen.name === want) return   // by name: the objects never compared equal (it flickered)
        visible = false
        screen = t; width = t.width; height = t.height
        visible = true
    }
    Timer { interval: 1000; repeat: true; running: true; onTriggered: w.place() }
    Component.onCompleted: place()
}
