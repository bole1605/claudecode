import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var model: AppModel
    let finish: () -> Void
    @State private var page = 0

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $page) {
                OnboardingPage(symbol: "hourglass.circle.fill", title: "Weniger scrollen",
                               text: "Setze Zeitlimits für Instagram und TikTok. Ist das Limit erreicht, wird die App bis zum nächsten Tag pausiert.")
                    .tag(0)
                OnboardingPage(symbol: "lock.shield.fill", title: "Komplett privat",
                               text: "Fokus braucht keinen Instagram- oder TikTok-Login und keine Internetverbindung. Es gibt keine Konten, keine Werbung und kein Tracking. Alles bleibt auf deinem iPhone.")
                    .tag(1)
                VStack(spacing: 20) {
                    OnboardingPage(symbol: "checkmark.circle.fill", title: "Zugriff auf Bildschirmzeit",
                                   text: "Dafür braucht Fokus die Erlaubnis von iOS, Apps zu begrenzen. Du wählst die Apps selbst aus – Fokus sieht nicht, was du darin tust.")
                    if let msg = model.errorMessage {
                        Text(msg).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center).padding(.horizontal, 32)
                    }
                }
                .tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .always))

            Button(action: next) {
                Text(page < 2 ? "Weiter" : "Zugriff erlauben").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding(.horizontal, 24).padding(.bottom, 24)
        }
    }

    private func next() {
        if page < 2 { withAnimation { page += 1 }; return }
        Task {
            await model.requestAuthorization()
            await model.requestNotifications()
            if model.authStatus == .approved { finish() }
        }
    }
}

private struct OnboardingPage: View {
    let symbol: String, title: LocalizedStringKey, text: LocalizedStringKey
    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: symbol).font(.system(size: 72)).foregroundStyle(.tint).accessibilityHidden(true)
            Text(title).font(.title.bold()).multilineTextAlignment(.center)
            Text(text).font(.body).foregroundStyle(.secondary).multilineTextAlignment(.center)
            Spacer()
        }
        .padding(.horizontal, 32)
    }
}
