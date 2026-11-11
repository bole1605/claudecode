import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.openURL) private var openURL
    @State private var confirmReset = false

    private var anyStrict: Bool { TrackedApp.allCases.contains { model.settings($0).strictMode } }

    var body: some View {
        List {
            Section {
                Toggle("Mitteilungen", isOn: Binding(get: { model.notificationsEnabled }, set: { on in
                    if on { Task { await model.requestNotifications() } } else { model.setNotifications(false) }
                }))
            } footer: { Text("Warnung kurz vor dem Limit und Hinweis, wenn es erreicht ist. Alles lokal, ohne Server.") }

            Section {
                Button("iOS-Einstellungen öffnen") {
                    if let u = URL(string: UIApplication.openSettingsURLString) { openURL(u) }
                }
            } header: { Text("Mehr Verbindlichkeit") } footer: {
                Text("Tipp: Lege in den iOS-Einstellungen unter „Bildschirmzeit“ einen Code fest, den eine vertraute Person wählt. Nur so lässt sich Fokus nicht einfach deaktivieren oder löschen.")
            }

            Section("Datenschutz") {
                Label("Kein Konto, kein Login", systemImage: "person.crop.circle.badge.xmark")
                Label("Keine Internetverbindung nötig", systemImage: "wifi.slash")
                Label("Keine Daten verlassen dein iPhone", systemImage: "lock.shield")
            }

            Section {
                Button("Alle Einstellungen zurücksetzen", role: .destructive) { confirmReset = true }.disabled(anyStrict)
            } footer: { if anyStrict { Text("Im Strengen Modus gesperrt.") } }

            Section("Info") {
                LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")
                Text("Fokus ist nicht mit Instagram, Meta oder TikTok verbunden oder von ihnen unterstützt. Namen dienen nur der Beschreibung.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Einstellungen")
        .confirmationDialog("Alle Limits und Auswahlen löschen?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Zurücksetzen", role: .destructive) { model.resetAll() }
        }
    }
}
