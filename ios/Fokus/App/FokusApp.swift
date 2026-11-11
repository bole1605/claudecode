import SwiftUI
import FamilyControls
import UserNotifications

@main
struct FokusApp: App {
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("onboardingDone") private var onboardingDone = false

    var body: some Scene {
        WindowGroup {
            Group {
                if onboardingDone { RootView() } else { OnboardingView { onboardingDone = true } }
            }
            .environmentObject(model)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { model.refresh() }
        }
    }
}

@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var settings: [TrackedApp: AppSettings] = [:]
    @Published private(set) var selections: [TrackedApp: FamilyActivitySelection] = [:]
    @Published private(set) var authStatus = AuthorizationCenter.shared.authorizationStatus
    @Published var errorMessage: String?
    @Published var notificationsEnabled = SharedStore.shared.notificationsEnabled

    private let store = SharedStore.shared

    init() { reload() }

    private func reload() {
        for app in TrackedApp.allCases {
            settings[app] = store.settings(app)
            selections[app] = store.selection(app)
        }
    }

    /// Beim Öffnen: Zustand laden, Pläne neu setzen (falls iOS sie verworfen hat).
    func refresh() {
        authStatus = AuthorizationCenter.shared.authorizationStatus
        guard authStatus == .approved else { return }
        TrackedApp.allCases.forEach { ShieldEngine.apply($0) }
        reload()
    }

    func settings(_ app: TrackedApp) -> AppSettings { settings[app] ?? AppSettings() }
    func selection(_ app: TrackedApp) -> FamilyActivitySelection { selections[app] ?? FamilyActivitySelection() }

    func update(_ app: TrackedApp, _ change: (inout AppSettings) -> Void) {
        let old = settings(app)
        var new = old
        change(&new)
        guard new != old else { return }
        settings[app] = new
        store.save(new, for: app)
        // Wurde das heutige Limit geändert, darf eine bereits ausgelöste Sperre neu bewertet werden.
        if new.minutes(on: .now) != old.minutes(on: .now) {
            var st = store.state(app)
            st.limitReachedDay = nil
            store.save(st, for: app)
        }
        if authStatus == .approved { ShieldEngine.apply(app) }
    }

    func selectionBinding(_ app: TrackedApp) -> Binding<FamilyActivitySelection> {
        Binding(
            get: { self.selection(app) },
            set: {
                self.selections[app] = $0
                self.store.save($0, for: app)
                if self.authStatus == .approved { ShieldEngine.apply(app) }
            })
    }

    func requestAuthorization() async {
        do { try await AuthorizationCenter.shared.requestAuthorization(for: .individual) }
        catch { errorMessage = "Der Zugriff wurde nicht erteilt. Du kannst es jederzeit erneut versuchen." }
        authStatus = AuthorizationCenter.shared.authorizationStatus
        if authStatus == .approved { refresh() }
    }

    func requestNotifications() async {
        let ok = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) ?? false
        setNotifications(ok)
    }

    func setNotifications(_ on: Bool) {
        notificationsEnabled = on
        store.notificationsEnabled = on
    }

    func resetAll() {
        for app in TrackedApp.allCases {
            ShieldEngine.store(app).clearAllSettings()
            ShieldEngine.apply(app)
        }
        store.resetAll()
        reload()
        TrackedApp.allCases.forEach { ShieldEngine.apply($0) }
    }
}
