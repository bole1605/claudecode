import SwiftUI
import FamilyControls
import DeviceActivity

struct RootView: View {
    var body: some View {
        TabView {
            NavigationStack { HomeView() }
                .tabItem { Label("Limits", systemImage: "hourglass") }
            NavigationStack { InstagramFeedView() }
                .tabItem { Label("Instagram-Feed", systemImage: "person.2.fill") }
            NavigationStack { SettingsView() }
                .tabItem { Label("Einstellungen", systemImage: "gearshape") }
        }
    }
}

struct HomeView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        List {
            if model.authStatus != .approved {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Zugriff erforderlich", systemImage: "exclamationmark.triangle.fill").font(.headline)
                        Text("Ohne die Erlaubnis für Bildschirmzeit kann Fokus keine Limits setzen.").font(.subheadline).foregroundStyle(.secondary)
                        Button("Zugriff erlauben") { Task { await model.requestAuthorization() } }.buttonStyle(.borderedProminent)
                    }
                }
            }
            Section {
                ForEach(TrackedApp.allCases) { app in
                    NavigationLink(value: app) { AppRow(app: app) }
                }
            } footer: {
                Text("Alle Daten bleiben auf diesem iPhone. Fokus benötigt kein Konto und keine Internetverbindung.")
            }
        }
        .navigationTitle("Fokus")
        .navigationDestination(for: TrackedApp.self) { AppDetailView(app: $0) }
    }
}

private struct AppRow: View {
    @EnvironmentObject private var model: AppModel
    let app: TrackedApp

    private var filter: DeviceActivityFilter {
        let sel = model.selection(app)
        return DeviceActivityFilter(
            segment: .daily(during: Calendar.current.dateInterval(of: .day, for: .now) ?? DateInterval(start: .now, duration: 86_400)),
            users: .all, devices: .init([.iPhone]),
            applications: sel.applicationTokens, categories: sel.categoryTokens, webDomains: sel.webDomainTokens)
    }

    private var summary: String {
        let s = model.settings(app)
        guard s.isEnabled else { return "Aus" }
        guard !model.selection(app).isEmptySelection else { return "App noch nicht ausgewählt" }
        return "Mo–Fr \(formatMinutes(s.weekdayMinutes)) · Sa/So \(formatMinutes(s.weekendMinutes))"
    }

    var body: some View {
        let s = model.settings(app)
        HStack(spacing: 14) {
            Image(systemName: app.symbol).font(.largeTitle).foregroundStyle(.tint).frame(width: 44).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(app.title).font(.headline)
                Text(summary).font(.subheadline).foregroundStyle(.secondary)
                if s.isEnabled && !model.selection(app).isEmptySelection && model.authStatus == .approved {
                    DeviceActivityReport(.today, filter: filter).frame(height: 22)
                }
            }
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }
}
