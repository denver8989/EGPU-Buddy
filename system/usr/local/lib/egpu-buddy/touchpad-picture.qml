// The touchpad picture on the handheld screen while KDE drives it (no eGPU, desktop): a layer-shell overlay on that
// screen alone, above everything (wallpaper, panels, windows), never focused. egpu-touchpad starts it as the session
// user with EGPU_PICTURE_SCREEN=<connector> and the picture in /run/egpu-touchpad-picture.pgm, and ends it.
import QtQuick
import QtQuick.Window
import org.kde.layershell 1.0 as LayerShell

Window {
    id: w
    color: "black"
    flags: Qt.FramelessWindowHint | Qt.WindowDoesNotAcceptFocus
    screen: {
        const want = Qt.application.arguments[Qt.application.arguments.length - 1]
        for (const s of Qt.application.screens) if (s.name === want) return s
        return Qt.application.screens[0]
    }
    width: screen.width; height: screen.height
    LayerShell.Window.scope: "egpu-touchpad-picture"
    LayerShell.Window.layer: LayerShell.Window.LayerOverlay
    LayerShell.Window.anchors: LayerShell.Window.AnchorTop | LayerShell.Window.AnchorBottom | LayerShell.Window.AnchorLeft | LayerShell.Window.AnchorRight
    LayerShell.Window.exclusionZone: -1
    LayerShell.Window.keyboardInteractivity: LayerShell.Window.KeyboardInteractivityNone
    LayerShell.Window.wantsToBeOnActiveScreen: false
    Image { anchors.fill: parent; source: "file:///run/egpu-touchpad-picture.pgm"; cache: false; fillMode: Image.Stretch; smooth: false }
    Component.onCompleted: visible = true
}
