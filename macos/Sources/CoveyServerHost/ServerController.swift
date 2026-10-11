import AppKit
import Foundation

@MainActor
final class ServerController: ObservableObject {
    enum State: Equatable {
        case stopped
        case starting
        case running
        case failed(String)

        var title: String {
            switch self {
            case .stopped: return "Stopped"
            case .starting: return "Starting…"
            case .running: return "Running"
            case .failed: return "Needs attention"
            }
        }

        var symbol: String {
            switch self {
            case .stopped: return "stop.circle"
            case .starting: return "arrow.triangle.2.circlepath"
            case .running: return "checkmark.circle.fill"
            case .failed: return "exclamationmark.triangle.fill"
            }
        }
    }

    @Published private(set) var state: State = .stopped
    @Published private(set) var recentLog = ""

    let port: Int
    private var process: Process?
    private var healthTask: Task<Void, Never>?
    private var isStopping = false

    init(port: Int = 3030, startAutomatically: Bool = true) {
        self.port = port
        if startAutomatically {
            DispatchQueue.main.async { [weak self] in self?.start() }
        }
    }

    var serverURL: URL {
        URL(string: "http://127.0.0.1:\(port)")!
    }

    var failureMessage: String? {
        if case let .failed(message) = state { return message }
        return nil
    }

    func start() {
        guard process == nil else { return }
        state = .starting
        recentLog = ""
        isStopping = false

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
                "COVEY_HOST": "127.0.0.1",
                "PORT": String(port),
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
        healthTask?.cancel()
        healthTask = nil
        guard let process else {
            state = .stopped
            return
        }
        isStopping = true
        if process.isRunning { process.terminate() }
        self.process = nil
        state = .stopped
    }

    func restart() {
        stop()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in self?.start() }
    }

    func openCovey() {
        NSWorkspace.shared.open(serverURL)
    }

    func copyAddress() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(serverURL.absoluteString, forType: .string)
    }

    func copyDiagnostics() {
        let text = "Covey Server: \(state.title)\nAddress: \(serverURL.absoluteString)\n\n\(recentLog)"
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    private func waitForHealth() {
        healthTask?.cancel()
        healthTask = Task { [weak self] in
            guard let self else { return }
            for _ in 0..<30 {
                if Task.isCancelled { return }
                guard self.process?.isRunning == true else { return }
                do {
                    let (data, response) = try await URLSession.shared.data(from: self.serverURL.appendingPathComponent("api/health"))
                    if let http = response as? HTTPURLResponse,
                       http.statusCode == 200,
                       let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       value["service"] as? String == "covey-server" {
                        self.state = .running
                        return
                    }
                } catch {}
                try? await Task.sleep(nanoseconds: 250_000_000)
            }
            if self.process?.isRunning == true {
                self.state = .failed("The server started but did not become ready.")
            }
        }
    }

    private func handleTermination(status: Int32) {
        healthTask?.cancel()
        healthTask = nil
        process = nil
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
