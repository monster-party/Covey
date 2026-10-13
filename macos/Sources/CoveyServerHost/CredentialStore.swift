import Foundation
import Security

struct ICloudCredentials: Equatable {
    let email: String
    let appSpecificPassword: String
}

struct CredentialStore {
    private let service = "com.covey.server.icloud"

    func load() throws -> ICloudCredentials? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnAttributes as String: true,
            kSecReturnData as String: true,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess,
              let value = item as? [String: Any],
              let email = value[kSecAttrAccount as String] as? String,
              let data = value[kSecValueData as String] as? Data,
              let password = String(data: data, encoding: .utf8)
        else { throw CredentialStoreError.keychain(status) }
        return ICloudCredentials(email: email, appSpecificPassword: password)
    }

    func save(_ credentials: ICloudCredentials) throws {
        try remove()
        let item: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: credentials.email,
            kSecValueData as String: Data(credentials.appSpecificPassword.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else { throw CredentialStoreError.keychain(status) }
    }

    func remove() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw CredentialStoreError.keychain(status)
        }
    }
}

private enum CredentialStoreError: LocalizedError {
    case keychain(OSStatus)

    var errorDescription: String? {
        switch self {
        case let .keychain(status):
            let detail = SecCopyErrorMessageString(status, nil) as String? ?? "Unknown Keychain error"
            return "Covey could not access Keychain: \(detail)."
        }
    }
}
