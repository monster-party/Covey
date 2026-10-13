import AppKit
import Darwin
import Foundation

@MainActor
final class ServerController: ObservableObject {
    enum State: Equatable {
        case stopped
        case starting
        case running
        case needsSetup
        case failed(String)

        var title: String {
            switch self {
            case .stopped: return "Stopped"
            case .starting: return "Starting…"
            case .running: return "Running"
            case .needsSetup: return "Setup required"
            case .failed: return "Needs attention"
            }
        }

        var symbol: String {
            switch self {
            case .stopped: return "stop.circle"
            case .starting: return "arrow.triangle.2.circlepath"
            case .running: return "checkmark.circle.fill"
            case .needsSetup: return "person.crop.circle.badge.exclamationmark"
            case .failed: return "exclamationmark.triangle.fill"
            }
        }
    }

    @Published private(set) var state: State = .stopped
    @Published private(set) var recentLog = ""
    @Published private(set) var isUsingExistingServer = false
    @Published private(set) var onboardingRequired = false

    let port: Int
    private var process: Process?
    private var startupTask: Task<Void, Never>?
    private var healthTask: Task<Void, Never>?
    private var isStopping = false
    private let credentialStore = CredentialStore()

    init(port: Int = 3030, startAutomatically: Bool = true) {
        self.port = port
        if startAutomatically {
            DispatchQueue.main.async { [weak self] in self?.start() }
        }
    }

    var serverURL: URL {
        URL(string: "http://127.0.0.1:\(port)")!
    }

    var networkURL: URL {
        URL(string: "http://\(Self.localIPv4Address() ?? ProcessInfo.processInfo.hostName):\(port)")!
    }

    var failureMessage: String? {
        if case let .failed(message) = state { return message }
        return nil
    }

    func start() {
        guard process == nil, startupTask == nil else { return }
        state = .starting
        recentLog = ""
        isStopping = false
        isUsingExistingServer = false

        startupTask = Task { [weak self] in
            guard let self else { return }
            if await self.serverIsHealthy() {
                self.recentLog = "Connected to an existing healthy Covey Server on port \(self.port)."
                self.isUsingExistingServer = true
                self.state = .running
                self.startupTask = nil
                return
            }
            if Task.isCancelled { return }
            guard let credentials = self.resolvedCredentials() else {
                self.state = .needsSetup
                self.onboardingRequired = true
                self.startupTask = nil
                return
            }
            self.startupTask = nil
            self.launchBundledServer(credentials: credentials)
        }
    }

    private func launchBundledServer(credentials: ICloudCredentials) {
        do {
            let paths = try runtimePaths()
            let inheritedEnvironment = ProcessInfo.processInfo.environment
            let dataDirectory: URL
            if let override = inheritedEnvironment["COVEY_DATA_DIR"] {
                dataDirectory = URL(fileURLWithPath: override, isDirectory: true)
            } else {
                dataDirectory = try applicationSupportDirectory()
            }
            let process = Process()
            let output = Pipe()
            process.executableURL = paths.node
            process.arguments = [paths.server.path]
            process.currentDirectoryURL = paths.root
            process.standardOutput = output
            process.standardError = output
            process.environment = inheritedEnvironment.merging([
                "COVEY_RUNTIME_ROOT": paths.root.path,
                "COVEY_ASSETS_DIR": paths.publicAssets.path,
                "COVEY_DATA_DIR": dataDirectory.path,
                "COVEY_HOST": "0.0.0.0",
                "PORT": String(port),
                "ICLOUD_EMAIL": credentials.email,
                "ICLOUD_APP_PASSWORD": credentials.appSpecificPassword,
            ]) { _, hostValue in hostValue }

            output.fileHandleForReading.readabilityHandler = { [weak self] handle in
                let data = handle.availableData
                guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
                Task { @MainActor [weak self] in self?.appendLog(text) }
            }
            process.terminationHandler = { [weak self] process in
                Task { @MainActor [weak self] in
                    self?.handleTermination(status: process.terminationStatus)
                }
            }
            try process.run()
            self.process = process
            waitForHealth()
        } catch {
            process = nil
            state = .failed(friendlyError(error))
        }
    }

    func stop() {
        Task { await stopAndWait() }
    }

    func stopAndWait() async {
        startupTask?.cancel()
        startupTask = nil
        healthTask?.cancel()
        healthTask = nil
        guard let process else {
            isUsingExistingServer = false
            state = .stopped
            return
        }
        isStopping = true
        if process.isRunning { process.terminate() }
        for _ in 0..<20 where process.isRunning {
            try? await Task.sleep(nanoseconds: 50_000_000)
        }
        if process.isRunning {
            process.interrupt()
            for _ in 0..<10 where process.isRunning {
                try? await Task.sleep(nanoseconds: 50_000_000)
            }
        }
        self.process = nil
        isUsingExistingServer = false
        state = .stopped
    }

    func restart() {
        Task { [weak self] in
            guard let self else { return }
            await self.stopAndWait()
            try? await Task.sleep(nanoseconds: 350_000_000)
            self.start()
        }
    }

    func configureCredentials(email: String, password: String) throws {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedPassword = password.filter { !$0.isWhitespace }
        guard normalizedEmail.contains("@"), normalizedEmail.count <= 254 else {
            throw OnboardingError.invalidEmail
        }
        guard !normalizedPassword.isEmpty else {
            throw OnboardingError.missingPassword
        }
        try credentialStore.save(ICloudCredentials(
            email: normalizedEmail,
            appSpecificPassword: normalizedPassword
        ))
        onboardingRequired = false
        start()
    }

    private func resolvedCredentials() -> ICloudCredentials? {
        if let stored = try? credentialStore.load() { return stored }
        let environment = ProcessInfo.processInfo.environment
        let email = String(environment["ICLOUD_EMAIL"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let password = String(environment["ICLOUD_APP_PASSWORD"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !email.isEmpty, !password.isEmpty else { return nil }
        return ICloudCredentials(email: email, appSpecificPassword: password)
    }

    func openCovey() {
        NSWorkspace.shared.open(serverURL)
    }

    func copyAddress() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(networkURL.absoluteString, forType: .string)
    }

    func copyDiagnostics() {
        let text = "Covey Server: \(state.title)\nLocal address: \(serverURL.absoluteString)\nNetwork address: \(networkURL.absoluteString)\n\n\(recentLog)"
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    private static func localIPv4Address() -> String? {
        var interfaces: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&interfaces) == 0, let first = interfaces else { return nil }
        defer { freeifaddrs(interfaces) }

        var fallback: String?
        for pointer in sequence(first: first, next: { $0.pointee.ifa_next }) {
            let interface = pointer.pointee
            guard let address = interface.ifa_addr, address.pointee.sa_family == UInt8(AF_INET) else { continue }
            let flags = Int32(interface.ifa_flags)
            guard flags & IFF_UP != 0, flags & IFF_LOOPBACK == 0 else { continue }

            var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            let length = socklen_t(address.pointee.sa_len)
            guard getnameinfo(
                address,
                length,
                &hostname,
                socklen_t(hostname.count),
                nil,
                0,
                NI_NUMERICHOST
            ) == 0 else { continue }

            let value = String(cString: hostname)
            let name = String(cString: interface.ifa_name)
            if name == "en0" || name == "en1" { return value }
            fallback = fallback ?? value
        }
        return fallback
    }

    private func waitForHealth() {
        healthTask?.cancel()
        healthTask = Task { [weak self] in
            guard let self else { return }
            for _ in 0..<30 {
                if Task.isCancelled { return }
                guard self.process?.isRunning == true else { return }
                if await self.serverIsHealthy() {
                    self.state = .running
                    return
                }
                try? await Task.sleep(nanoseconds: 250_000_000)
            }
            if self.process?.isRunning == true {
                self.state = .failed("The server started but did not become ready.")
            }
        }
    }

    private func serverIsHealthy() async -> Bool {
        var request = URLRequest(url: serverURL.appendingPathComponent("api/health"))
        request.timeoutInterval = 1
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse,
                  http.statusCode == 200,
                  let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else { return false }
            return value["service"] as? String == "covey-server"
        } catch {
            return false
        }
    }

    private func handleTermination(status: Int32) {
        healthTask?.cancel()
        healthTask = nil
        process = nil
        isUsingExistingServer = false
        if isStopping {
            isStopping = false
            state = .stopped
            return
        }
        let message: String
        if recentLog.contains("EADDRINUSE") {
            message = "Port \(port) is already in use."
        } else if recentLog.contains("Missing ICLOUD_EMAIL") {
            message = "iCloud credentials are not configured yet."
        } else {
            message = "Server exited with status \(status)."
        }
        state = .failed(message)
    }

    private func appendLog(_ text: String) {
        recentLog = String((recentLog + text).suffix(12_000))
    }

    private func friendlyError(_ error: Error) -> String {
        if let error = error as? HostError { return error.localizedDescription }
        return error.localizedDescription
    }

    private func runtimePaths() throws -> RuntimePaths {
        guard let resources = Bundle.main.resourceURL else { throw HostError.missingResources }
        let root = resources.appendingPathComponent("Server", isDirectory: true)
        let node = root.appendingPathComponent("bin/node")
        let server = root.appendingPathComponent("server.cjs")
        let publicAssets = root.appendingPathComponent("public", isDirectory: true)
        for url in [node, server, publicAssets.appendingPathComponent("index.html")] where !FileManager.default.fileExists(atPath: url.path) {
            throw HostError.missingRuntime(url.path)
        }
        return RuntimePaths(root: root, node: node, server: server, publicAssets: publicAssets)
    }

    private func applicationSupportDirectory() throws -> URL {
        let base = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = base.appendingPathComponent("Covey Server", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
}

private struct RuntimePaths {
    let root: URL
    let node: URL
    let server: URL
    let publicAssets: URL
}

private enum HostError: LocalizedError {
    case missingResources
    case missingRuntime(String)

    var errorDescription: String? {
        switch self {
        case .missingResources: return "The application resource directory is unavailable."
        case let .missingRuntime(path): return "The bundled server is incomplete: \(path)"
        }
    }
}

private enum OnboardingError: LocalizedError {
    case invalidEmail
    case missingPassword

    var errorDescription: String? {
        switch self {
        case .invalidEmail: return "Enter a valid Apple ID email address."
        case .missingPassword: return "Enter an Apple app-specific password."
        }
    }
}
