import Foundation
import DeviceActivity
import FamilyControls
import ManagedSettings
import UserNotifications
import os

enum ShieldReason { case bedtime, limit, gate }

enum ActivityKind: String { case daily, bedtime, session }

extension DeviceActivityName {
    init(_ kind: ActivityKind, _ app: TrackedApp) { self.init("\(kind.rawValue).\(app.rawValue)") }
    var parsed: (ActivityKind, TrackedApp)? {
        let parts = rawValue.split(separator: ".").map(String.init)
        guard parts.count == 2, let k = ActivityKind(rawValue: parts[0]), let a = TrackedApp(rawValue: parts[1]) else { return nil }
        return (k, a)
    }
}

extension DeviceActivityEvent.Name {
    static let limit = Self("limit")
    static let warning = Self("warning")
    static let session = Self("session")
}

extension DeviceActivityReport.Context {
    static let today = Self(rawValue: "today")
}

/// Zentrale Logik: aus Einstellungen + Zustand wird entschieden, ob eine App gesperrt ist.
/// Läuft identisch in App und Extensions. Pro App gibt es einen eigenen ManagedSettingsStore.
enum ShieldEngine {
    private static let log = Logger(subsystem: "fokus", category: "engine")
    private static let center = DeviceActivityCenter()

    static func store(_ app: TrackedApp) -> ManagedSettingsStore { ManagedSettingsStore(named: .init(app.rawValue)) }

    // MARK: Entscheidung

    static func reason(_ app: TrackedApp, now: Date = .now) -> ShieldReason? {
        let s = SharedStore.shared
        let settings = s.settings(app)
        guard settings.isEnabled, !s.selection(app).isEmptySelection else { return nil }
        let st = s.state(app)
        let session = st.activeSession(at: now)?.kind
        if settings.bedtimeEnabled && settings.isInBedtime(now) { return .bedtime }
        if st.limitReachedDay == Day.key(now) && session != .extra { return .limit }
        if settings.gateEnabled && session == nil { return .gate }
        return nil
    }

    static func canGrantExtra(_ app: TrackedApp, now: Date = .now) -> Bool {
        let s = SharedStore.shared
        let settings = s.settings(app)
        return !settings.strictMode && settings.extrasPerDay > s.state(app).extrasUsedToday(Day.key(now))
    }

    static func reconcile(_ app: TrackedApp, now: Date = .now) {
        let sel = SharedStore.shared.selection(app)
        let store = store(app)
        guard reason(app, now: now) != nil else { store.clearAllSettings(); return }
        store.shield.applications = sel.applicationTokens.isEmpty ? nil : sel.applicationTokens
        store.shield.applicationCategories = sel.categoryTokens.isEmpty ? nil : .specific(sel.categoryTokens)
        store.shield.webDomains = sel.webDomainTokens.isEmpty ? nil : sel.webDomainTokens
    }

    // MARK: Planung (DeviceActivity)

    /// Plant Tageslimit + Schlafenszeit neu und gleicht den Zustand ab.
    static func apply(_ app: TrackedApp, now: Date = .now) {
        let s = SharedStore.shared
        var settings = s.settings(app)
        settings.applyPendingIfDue(today: Day.key(now))
        s.save(settings, for: app)

        center.stopMonitoring([DeviceActivityName(.daily, app), DeviceActivityName(.bedtime, app)])
        let sel = s.selection(app)
        guard settings.isEnabled, !sel.isEmptySelection else {
            center.stopMonitoring([DeviceActivityName(.session, app)])
            store(app).clearAllSettings()
            return
        }

        var state = s.state(app)
        state.scheduledDay = Day.key(now)
        s.save(state, for: app)

        // Tageslimit
        let limit = max(1, settings.minutes(on: now))
        var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [
            .limit: event(sel, minutes: limit)
        ]
        if let w = warningMinutes(limit: limit, percent: settings.warningPercent) {
            events[.warning] = event(sel, minutes: w)
        }
        let daily = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: 0, minute: 0),
            intervalEnd: DateComponents(hour: 23, minute: 59),
            repeats: true)
        start(DeviceActivityName(.daily, app), daily, events)

        // Schlafenszeit (iOS verlangt mindestens 15 Minuten)
        if settings.bedtimeEnabled && settings.bedtimeDuration >= 15 {
            let sched = DeviceActivitySchedule(
                intervalStart: DateComponents(hour: settings.bedtimeStart / 60, minute: settings.bedtimeStart % 60),
                intervalEnd: DateComponents(hour: settings.bedtimeEnd / 60, minute: settings.bedtimeEnd % 60),
                repeats: true)
            start(DeviceActivityName(.bedtime, app), sched, [:])
        }
        reconcile(app, now: now)
    }

    static func warningMinutes(limit: Int, percent: Int) -> Int? {
        guard percent > 0 else { return nil }
        let w = max(1, limit * percent / 100)
        return w < limit ? w : nil
    }

    private static func event(_ sel: FamilyActivitySelection, minutes: Int) -> DeviceActivityEvent {
        DeviceActivityEvent(
            applications: sel.applicationTokens,
            categories: sel.categoryTokens,
            webDomains: sel.webDomainTokens,
            threshold: DateComponents(hour: minutes / 60, minute: minutes % 60))
    }

    private static func start(_ name: DeviceActivityName, _ schedule: DeviceActivitySchedule,
                              _ events: [DeviceActivityEvent.Name: DeviceActivityEvent]) {
        do { try center.startMonitoring(name, during: schedule, events: events) }
        catch { log.error("startMonitoring \(name.rawValue, privacy: .public) failed: \(error.localizedDescription, privacy: .public)") }
    }

    // MARK: Zeitfenster (Bewusster Start / Zusatzzeit)

    /// Hebt die Sperre für `minutes` Nutzungsminuten auf. iOS erlaubt Zeitfenster ab 15 Minuten,
    /// das Fenster ist daher mindestens 15 Minuten lang.
    static func startSession(_ app: TrackedApp, kind: RuntimeState.Session.Kind, minutes: Int, now: Date = .now) {
        let s = SharedStore.shared
        let sel = s.selection(app)
        let window = max(15, minutes)
        let end = now.addingTimeInterval(Double(window) * 60)

        var state = s.state(app)
        state.session = .init(kind: kind, until: end)
        if kind == .extra {
            let today = Day.key(now)
            state.extraUsed = state.extrasUsedToday(today) + 1
            state.extraUsedDay = today
        }
        s.save(state, for: app)

        let comps: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
        let sched = DeviceActivitySchedule(
            intervalStart: Calendar.current.dateComponents(comps, from: now),
            intervalEnd: Calendar.current.dateComponents(comps, from: end),
            repeats: false)
        center.stopMonitoring([DeviceActivityName(.session, app)])
        start(DeviceActivityName(.session, app), sched, [.session: event(sel, minutes: minutes)])
        reconcile(app, now: now)
    }

    static func endSession(_ app: TrackedApp, now: Date = .now) {
        let s = SharedStore.shared
        var state = s.state(app)
        state.session = nil
        s.save(state, for: app)
        center.stopMonitoring([DeviceActivityName(.session, app)])
        reconcile(app, now: now)
    }

    // MARK: Callbacks der Monitor-Extension

    static func dayDidStart(_ app: TrackedApp, now: Date = .now) {
        let state = SharedStore.shared.state(app)
        if state.scheduledDay != Day.key(now) { apply(app, now: now) } else { reconcile(app, now: now) }
    }

    static func limitReached(_ app: TrackedApp, now: Date = .now) {
        let s = SharedStore.shared
        var state = s.state(app)
        state.limitReachedDay = Day.key(now)
        s.save(state, for: app)
        reconcile(app, now: now)
        Notifier.post(title: "\(app.title)-Limit erreicht", body: "Zeit für etwas anderes – bis morgen ist \(app.title) pausiert.")
    }

    static func warningReached(_ app: TrackedApp, now: Date = .now) {
        let s = SharedStore.shared
        let settings = s.settings(app)
        let limit = settings.minutes(on: now)
        guard let w = warningMinutes(limit: limit, percent: settings.warningPercent) else { return }
        Notifier.post(title: "Gleich ist Schluss", body: "Noch \(formatMinutes(limit - w)) für \(app.title) heute.")
    }
}

enum Notifier {
    static func post(title: String, body: String) {
        guard SharedStore.shared.notificationsEnabled else { return }
        let c = UNMutableNotificationContent()
        c.title = title
        c.body = body
        c.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: c, trigger: nil))
    }
}
