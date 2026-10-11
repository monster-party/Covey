// swift-tools-version: 5.8
import PackageDescription

let package = Package(
    name: "CoveyServerHost",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "CoveyServerHost", targets: ["CoveyServerHost"]),
    ],
    targets: [
        .executableTarget(
            name: "CoveyServerHost",
            path: "Sources/CoveyServerHost"
        ),
    ]
)
