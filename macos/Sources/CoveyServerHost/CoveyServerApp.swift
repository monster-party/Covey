import AppKit
import SwiftUI

@main
struct CoveyServerApp: App {
    @StateObject private var server = ServerController()

    private static let menuBarIcon: NSImage = {
        guard
            let url = Bundle.main.url(forResource: "CoveyMenuBarTemplate", withExtension: "png"),
            let image = NSImage(contentsOf: url)
        else {
            return NSImage(systemSymbolName: "house", accessibilityDescription: "Covey Server")
                ?? NSImage(size: NSSize(width: 18, height: 18))
        }
        image.isTemplate = true
        image.size = NSSize(width: 18, height: 18)
        return image
    }()

    var body: some Scene {
        MenuBarExtra {
            ServerMenuView(server: server)
        } label: {
            Image(nsImage: Self.menuBarIcon)
                .accessibilityLabel("Covey Server")
        }
        .menuBarExtraStyle(.window)

        Window("Set up Covey Server", id: "onboarding") {
            OnboardingView(server: server)
        }
        .windowResizability(.contentSize)
        .defaultPosition(.center)
    }
}

private struct ServerMenuView: View {
    @ObservedObject var server: ServerController
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(server.state.title, systemImage: server.state.symbol)
                .font(.headline)

            if let message = server.failureMessage {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else if server.onboardingRequired {
                Text("Complete first-time setup before starting the server.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text(server.networkURL.absoluteString)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                if server.isUsingExistingServer {
                    Text("Connected to an existing Covey Server")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Divider()

            if server.onboardingRequired {
                Button("Set up Covey…") { openWindow(id: "onboarding") }
            } else {
                Button("Open Covey") { server.openCovey() }
                    .disabled(server.state != .running)
                Button("Copy address") { server.copyAddress() }
                    .disabled(server.state != .running)

                Divider()

                if server.state == .stopped {
                    Button("Start Server") { server.start() }
                } else if case .failed = server.state {
                    Button("Try Again") { server.restart() }
                } else if server.isUsingExistingServer {
                    Button("Reconnect") { server.restart() }
                } else {
                    Button("Stop Server") { server.stop() }
                }
                Button("Copy diagnostics") { server.copyDiagnostics() }
            }

            Divider()

            Button("Quit Covey Server") {
                Task {
                    await server.stopAndWait()
                    NSApplication.shared.terminate(nil)
                }
            }
        }
        .padding(12)
        .frame(width: 260)
        .onChange(of: server.onboardingRequired) { required in
            if required {
                NSApplication.shared.activate(ignoringOtherApps: true)
                openWindow(id: "onboarding")
            }
        }
    }
}
