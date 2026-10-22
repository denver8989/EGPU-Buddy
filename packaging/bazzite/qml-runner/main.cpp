// SteamOS EGPU Buddy - a minimal QML runner for Bazzite (Fedora ships Qt's own "qml" tool only in qt6-qtdeclarative-devel,
// which Bazzite does not have; the Qt Quick runtime itself is part of every Plasma 6 system).
//   egpu-buddy-qml <file.qml> [-- args...]     Qt.application.arguments carries every argument, as with Qt's qml tool.
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QUrl>
#include <cstdio>

int main(int argc, char *argv[])
{
    if (argc < 2) { std::fprintf(stderr, "usage: egpu-buddy-qml <file.qml> [-- args]\n"); return 2; }
    QGuiApplication app(argc, argv);
    QGuiApplication::setQuitOnLastWindowClosed(false);   // the window may be hidden to the tray
    QQmlApplicationEngine engine;
    engine.load(QUrl::fromLocalFile(QString::fromLocal8Bit(argv[1])));
    if (engine.rootObjects().isEmpty()) return 1;
    return app.exec();
}
