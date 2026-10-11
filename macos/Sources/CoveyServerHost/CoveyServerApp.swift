import AppKit
import SwiftUI

@main
struct CoveyServerApp: App {
    @StateObject private var server = ServerController()

    var body: some Scene {
        MenuBarExtra("Covey Server", systemImage: server.state.symbol) {
            VStack(alignment: .leading, spacing: 10) {
                Label(server.state.title, systemImage: server.state.symbol)
                    .font(.headline)

                if let message = server.failureMessage {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    Text(server.serverURL.absoluteString)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }

                Divider()

                Button("Open Covey") { server.openCovey() }
                    .disabled(server.state != .running)
                Button("Copy address") { server.copyAddress() }
                    .disabled(server.state != .running)

                Divider()

                if server.state == .stopped {
                    Button("Start Server") { server.start() }
                } else if case .failed = server.state {
                    Button("Try Again") { server.restart() }
                } else {
                    Button("Stop Server") { server.stop() }
                }
                Button("Copy diagnostics") { server.copyDiagnostics() }

                Divider()

                Button("Quit Covey Server") {
                    server.stop()
                    NSApplication.shared.terminate(nil)
                }
            }
            .padding(12)
            .frame(width: 260)
        }
        .menuBarExtraStyle(.window)
    }
}
