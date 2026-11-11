import ManagedSettings
import ManagedSettingsUI
import UIKit

/// Gestaltet den Sperrbildschirm, der über Instagram/TikTok erscheint.
final class FokusShieldConfiguration: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        make(for: application.token.flatMap { SharedStore.shared.app(for: $0) })
    }
    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
        make(for: application.token.flatMap { SharedStore.shared.app(for: $0) })
    }
    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration { make(for: nil) }
    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration { make(for: nil) }

    private func make(for app: TrackedApp?) -> ShieldConfiguration {
        guard let app, let reason = ShieldEngine.reason(app) else {
            return build(icon: "hourglass", title: "Kurze Pause", subtitle: "Diese App ist gerade pausiert.", primary: "Schließen", secondary: nil)
        }
        let settings = SharedStore.shared.settings(app)
        switch reason {
        case .bedtime:
            return build(icon: "moon.stars.fill", title: "Gute Nacht",
                         subtitle: "\(app.title) ist bis \(clock(settings.bedtimeEnd)) Uhr pausiert.",
                         primary: "Schließen", secondary: nil)
        case .limit:
            let extra = ShieldEngine.canGrantExtra(app)
                ? "\(settings.extraMinutes) Min extra" : nil
            return build(icon: "hourglass", title: "Tageslimit erreicht",
                         subtitle: "Du hast heute genug Zeit in \(app.title) verbracht.",
                         primary: "Schließen", secondary: extra)
        case .gate:
            let tip = app == .instagram
                ? "\n\nTipp: Tippe oben links auf das Instagram-Logo und wähle „Folge ich“, um nur Konten zu sehen, denen du folgst."
                : ""
            return build(icon: "hand.raised.fill", title: "Bewusst öffnen?",
                         subtitle: "Was möchtest du in \(app.title) tun?\(tip)",
                         primary: "Für \(settings.gateMinutes) Min öffnen", secondary: "Doch nicht")
        }
    }

    private func clock(_ minutes: Int) -> String { String(format: "%02d:%02d", minutes / 60, minutes % 60) }

    private func build(icon: String, title: String, subtitle: String, primary: String, secondary: String?) -> ShieldConfiguration {
        ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterial,
            backgroundColor: nil,
            icon: UIImage(systemName: icon),
            title: .init(text: title, color: .label),
            subtitle: .init(text: subtitle, color: .secondaryLabel),
            primaryButtonLabel: .init(text: primary, color: .white),
            primaryButtonBackgroundColor: .systemIndigo,
            secondaryButtonLabel: secondary.map { .init(text: $0, color: .systemIndigo) })
    }
}
