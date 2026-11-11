import DeviceActivity

/// Wird vom System im Hintergrund aufgerufen (auch wenn die App nicht läuft).
final class FokusMonitor: DeviceActivityMonitor {
    override func intervalDidStart(for activity: DeviceActivityName) {
        guard let (kind, app) = activity.parsed else { return }
        switch kind {
        case .daily: ShieldEngine.dayDidStart(app)
        case .bedtime: ShieldEngine.reconcile(app)
        case .session: break
        }
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        guard let (kind, app) = activity.parsed else { return }
        switch kind {
        case .bedtime: ShieldEngine.reconcile(app)
        case .session: ShieldEngine.endSession(app)
        case .daily: break
        }
    }

    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        guard let (kind, app) = activity.parsed else { return }
        switch (kind, event) {
        case (.daily, .limit): ShieldEngine.limitReached(app)
        case (.daily, .warning): ShieldEngine.warningReached(app)
        case (.session, _): ShieldEngine.endSession(app)
        default: break
        }
    }
}
