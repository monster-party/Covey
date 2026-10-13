import SwiftUI

struct OnboardingView: View {
    @ObservedObject var server: ServerController
    @Environment(\.dismiss) private var dismiss
    @State private var step = 0
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Group {
                switch step {
                case 0: welcome
                case 1: credentials
                default: readiness
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            HStack(spacing: 10) {
                if step == 1 {
                    Button("Back") { errorMessage = ""; step = 0 }
                }
                Spacer()
                if step == 0 {
                    Button("Set up Covey") { step = 1 }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                } else if step == 1 {
                    Button("Connect iCloud", action: saveCredentials)
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                        .disabled(email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || password.isEmpty)
                } else if server.state == .running {
                    Button("Open Covey") {
                        server.openCovey()
                        dismiss()
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            }
            .padding(.top, 22)
        }
        .padding(32)
        .frame(width: 560, height: 430)
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 18) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 42, weight: .medium))
                .foregroundStyle(.tint)
            Text("Welcome to Covey Server")
                .font(.system(size: 30, weight: .medium))
            Text("Covey runs privately on this Mac and gives your household devices a shared Today, calendar, and task display.")
                .font(.title3)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Label("Your calendar data stays on your local network", systemImage: "house")
            Label("iCloud credentials are stored securely in Keychain", systemImage: "key")
        }
    }

    private var credentials: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Connect iCloud")
                .font(.system(size: 28, weight: .medium))
            Text("Use an app-specific password—not your regular Apple ID password.")
                .foregroundStyle(.secondary)
            TextField("Apple ID email", text: $email)
                .textFieldStyle(.roundedBorder)
            SecureField("App-specific password", text: $password)
                .textFieldStyle(.roundedBorder)
            Link("Create an app-specific password", destination: URL(string: "https://account.apple.com/")!)
            if !errorMessage.isEmpty {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
                    .font(.callout)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
            Text("Covey never stores these credentials in its configuration files or diagnostics.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var readiness: some View {
        VStack(alignment: .leading, spacing: 18) {
            Image(systemName: server.state == .running ? "checkmark.circle.fill" : "arrow.triangle.2.circlepath")
                .font(.system(size: 42, weight: .medium))
                .foregroundStyle(server.state == .running ? Color.green : Color.accentColor)
            Text(server.state == .running ? "Covey is ready" : "Starting Covey Server")
                .font(.system(size: 28, weight: .medium))
            Text(server.state == .running
                 ? "Your private household server is available on your network at \(server.networkURL.absoluteString)."
                 : "Covey is preparing the local server and checking that it is available.")
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if let message = server.failureMessage {
                Label(message, systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
                Button("Review credentials") { step = 1 }
            } else if server.state != .running {
                ProgressView()
                    .controlSize(.large)
            }
        }
    }

    private func saveCredentials() {
        do {
            try server.configureCredentials(email: email, password: password)
            password = ""
            errorMessage = ""
            step = 2
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
