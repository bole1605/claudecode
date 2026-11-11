import Foundation
import FamilyControls
import ManagedSettings

/// Gemeinsamer, rein lokaler Speicher (App Group). Es gibt keinerlei Netzwerkzugriff.
final class SharedStore {
    static let shared = SharedStore()
    private let defaults: UserDefaults

    private init() { defaults = UserDefaults(suiteName: Constants.appGroup) ?? .standard }

    private func load<T: Decodable>(_ key: String) -> T? {
        defaults.data(forKey: key).flatMap { try? JSONDecoder().decode(T.self, from: $0) }
    }
    private func save<T: Encodable>(_ value: T, _ key: String) {
        defaults.set(try? JSONEncoder().encode(value), forKey: key)
    }

    func settings(_ app: TrackedApp) -> AppSettings { load("settings.\(app.rawValue)") ?? AppSettings() }
    func save(_ s: AppSettings, for app: TrackedApp) { save(s, "settings.\(app.rawValue)") }

    func selection(_ app: TrackedApp) -> FamilyActivitySelection { load("selection.\(app.rawValue)") ?? FamilyActivitySelection() }
    func save(_ s: FamilyActivitySelection, for app: TrackedApp) { save(s, "selection.\(app.rawValue)") }

    func state(_ app: TrackedApp) -> RuntimeState { load("state.\(app.rawValue)") ?? RuntimeState() }
    func save(_ s: RuntimeState, for app: TrackedApp) { save(s, "state.\(app.rawValue)") }

    var notificationsEnabled: Bool {
        get { defaults.object(forKey: "notificationsEnabled") as? Bool ?? true }
        set { defaults.set(newValue, forKey: "notificationsEnabled") }
    }

    func app(for token: ApplicationToken) -> TrackedApp? {
        TrackedApp.allCases.first { selection($0).applicationTokens.contains(token) }
    }

    func resetAll() {
        for app in TrackedApp.allCases {
            ["settings.", "selection.", "state."].forEach { defaults.removeObject(forKey: $0 + app.rawValue) }
        }
    }
}
