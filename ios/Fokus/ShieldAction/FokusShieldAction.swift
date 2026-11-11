import ManagedSettings

/// Reagiert auf die Buttons im Sperrbildschirm.
/// Extensions dürfen keine Apps öffnen – daher wird die Sperre aufgehoben (.defer),
/// und die App ist danach normal erreichbar.
final class FokusShieldAction: ShieldActionDelegate {
    override func handle(action: ShieldAction, for application: ApplicationToken,
                         completionHandler: @escaping (ShieldActionResponse) -> Void) {
        guard let app = SharedStore.shared.app(for: application) else { return completionHandler(.close) }
        completionHandler(respond(to: action, app: app))
    }
    override func handle(action: ShieldAction, for webDomain: WebDomainToken,
                         completionHandler: @escaping (ShieldActionResponse) -> Void) { completionHandler(.close) }
    override func handle(action: ShieldAction, for category: ActivityCategoryToken,
                         completionHandler: @escaping (ShieldActionResponse) -> Void) { completionHandler(.close) }

    private func respond(to action: ShieldAction, app: TrackedApp) -> ShieldActionResponse {
        let settings = SharedStore.shared.settings(app)
        switch (ShieldEngine.reason(app), action) {
        case (.gate, .primaryButtonPressed):
            ShieldEngine.startSession(app, kind: .gate, minutes: settings.gateMinutes)
            return .defer
        case (.limit, .secondaryButtonPressed) where ShieldEngine.canGrantExtra(app):
            ShieldEngine.startSession(app, kind: .extra, minutes: settings.extraMinutes)
            return .defer
        default:
            return .close
        }
    }
}
