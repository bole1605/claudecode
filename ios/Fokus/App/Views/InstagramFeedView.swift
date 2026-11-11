import SwiftUI

/// Instagram erlaubt es Drittanbieter-Apps nicht, Feed-Inhalte zu lesen oder zu filtern.
/// Statt Inhalte zu verändern führt diese Seite zur eingebauten „Folge ich“-Ansicht von Instagram.
struct InstagramFeedView: View {
    @Environment(\.openURL) private var openURL
    @State private var showUnavailable = false

    var body: some View {
        List {
            Section {
                Text("Instagram bringt eine eigene Ansicht mit, die nur Beiträge von Konten zeigt, denen du folgst – ohne Vorschläge. Fokus kann Instagram nicht verändern und greift nie auf dein Konto zu, deshalb führt dich diese Anleitung dorthin.")
                    .font(.subheadline)
            }
            Section("So geht's") {
                step(1, "Instagram öffnen und auf „Home“ bleiben.")
                step(2, "Oben links auf das Instagram-Logo tippen.")
                step(3, "„Folge ich“ wählen – nur Beiträge von Konten, denen du folgst, in zeitlicher Reihenfolge.")
                step(4, "Optional: „Favoriten“ zeigt nur Konten, die du dort markiert hast.")
            }
            Section {
                Label("Stories-Leiste: nur Konten, denen du folgst, erscheinen oben. Vorschläge findest du vor allem im Tab „Reels“ und in „Entdecken“ – diese lassen sich mit einem Limit eindämmen.", systemImage: "lightbulb")
                    .font(.subheadline)
            } header: { Text("Weniger Fremdes") } footer: {
                Text("Die Bezeichnungen können sich mit Instagram-Updates ändern. Kommt die App nicht zurück zu „Folge ich“, wiederhole die Schritte – Instagram merkt sich die Auswahl nicht.")
            }
            Section {
                Button { open() } label: { Label("Instagram öffnen", systemImage: "arrow.up.forward.app") }
            } footer: { Text("Ist ein Bewusster Start aktiv, erscheint zuerst die Pause.") }
        }
        .navigationTitle("Instagram-Feed")
        .alert("Instagram nicht gefunden", isPresented: $showUnavailable) { Button("OK", role: .cancel) {} }
    }

    private func step(_ n: Int, _ text: LocalizedStringKey) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("\(n)").font(.headline).foregroundStyle(.white).frame(width: 26, height: 26)
                .background(Circle().fill(.tint)).accessibilityHidden(true)
            Text(text)
        }
        .accessibilityElement(children: .combine)
    }

    private func open() {
        guard let url = URL(string: "instagram://app") else { return }
        openURL(url) { accepted in if !accepted { showUnavailable = true } }
    }
}
