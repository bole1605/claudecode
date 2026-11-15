import SwiftUI

/// Tageszähler für die Zeit im eingebauten Browser (nur lokal, UserDefaults).
enum FeedUsage {
    private static func key(_ site: FeedSite) -> String { "feedUsed.\(site.rawValue).\(Day.key())" }
    static func seconds(_ site: FeedSite) -> Int { UserDefaults.standard.integer(forKey: key(site)) }
    @discardableResult static func add(_ s: Int, _ site: FeedSite) -> Int {
        let v = seconds(site) + s
        UserDefaults.standard.set(v, forKey: key(site))
        return v
    }
    static func limitMinutes(_ site: FeedSite) -> Int { UserDefaults.standard.integer(forKey: "feedLimit.\(site.rawValue)") }
}

struct FeedBrowserView: View {
    @StateObject private var hub = BrowserHub()
    @AppStorage("feed.site") private var siteRaw = FeedSite.instagram.rawValue
    @AppStorage("feed.hideReels") private var hideReels = true
    @AppStorage("feed.hideExplore") private var hideExplore = true
    @AppStorage("feed.hideShorts") private var hideShorts = true
    @AppStorage("feed.startFollowing") private var startFollowing = true

    private var site: FeedSite { FeedSite(rawValue: siteRaw) ?? .instagram }
    private var options: FeedOptions {
        FeedOptions(hideReels: hideReels, hideExplore: hideExplore, hideShorts: hideShorts, startFollowing: startFollowing)
    }

    var body: some View {
        NavigationStack {
            BrowserPane(controller: hub.controller(site, options: options), hub: hub, siteRaw: $siteRaw)
                .id(site)
        }
        .onChange(of: options) { _, new in hub.apply(new) }
    }
}

private struct BrowserPane: View {
    @ObservedObject var controller: WebController
    let hub: BrowserHub
    @Binding var siteRaw: String
    @Environment(\.scenePhase) private var scenePhase
    @State private var used = 0
    @State private var showOptions = false

    private var site: FeedSite { controller.site }
    private var limitSeconds: Int { FeedUsage.limitMinutes(site) * 60 }
    private var locked: Bool { limitSeconds > 0 && used >= limitSeconds }

    var body: some View {
        ZStack(alignment: .top) {
            WebViewContainer(controller: controller).ignoresSafeArea(edges: .bottom)
            if controller.progress < 1 { ProgressView(value: controller.progress).progressViewStyle(.linear) }
            if locked {
                ContentUnavailableView {
                    Label("Tageslimit erreicht", systemImage: "hourglass")
                } description: {
                    Text("Du hast heute \(formatMinutes(FeedUsage.limitMinutes(site))) in \(site.title) verbracht. Morgen geht es weiter.")
                }
                .background(.regularMaterial)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Picker("Seite", selection: $siteRaw) {
                    ForEach(FeedSite.allCases) { Text($0.title).tag($0.rawValue) }
                }
                .pickerStyle(.segmented).frame(maxWidth: 220)
            }
            ToolbarItemGroup(placement: .topBarLeading) {
                Button { controller.webView.goBack() } label: { Image(systemName: "chevron.backward") }
                    .disabled(!controller.canGoBack).accessibilityLabel("Zurück")
                Button { controller.webView.goForward() } label: { Image(systemName: "chevron.forward") }
                    .disabled(!controller.canGoForward).accessibilityLabel("Vor")
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { controller.loadHome() } label: { Image(systemName: "house") }.accessibilityLabel("Startseite")
                Button { showOptions = true } label: { Image(systemName: "slider.horizontal.3") }.accessibilityLabel("Optionen")
            }
        }
        .sheet(isPresented: $showOptions) { FeedOptionsSheet(hub: hub) }
        .onAppear { used = FeedUsage.seconds(site) }
        .onChange(of: locked) { _, isLocked in if isLocked { hub.pauseAll() } }
        .task(id: "\(site.rawValue)-\(scenePhase == .active)") {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                if Task.isCancelled { break }
                if !locked { used = FeedUsage.add(1, site) }
            }
        }
    }
}

private struct FeedOptionsSheet: View {
    let hub: BrowserHub
    @Environment(\.dismiss) private var dismiss
    @AppStorage("feed.hideReels") private var hideReels = true
    @AppStorage("feed.hideExplore") private var hideExplore = true
    @AppStorage("feed.hideShorts") private var hideShorts = true
    @AppStorage("feed.startFollowing") private var startFollowing = true
    @AppStorage("feedLimit.instagram") private var igLimit = 0
    @AppStorage("feedLimit.youtube") private var ytLimit = 0
    @State private var confirmClear = false

    private let limits = [0, 15, 30, 45, 60, 90]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Reels ausblenden", isOn: $hideReels)
                    Toggle("Entdecken ausblenden", isOn: $hideExplore)
                    Toggle("Mit „Folge ich“ starten", isOn: $startFollowing)
                } header: { Text("Instagram") } footer: {
                    Text("Reels-Tab, Reels in Feed und Profilen sowie Entdecken werden ausgeblendet; Links dorthin führen zurück zur Startseite.")
                }
                Section {
                    Toggle("Shorts ausblenden", isOn: $hideShorts)
                } header: { Text("YouTube") } footer: {
                    Text("Shorts-Bereiche verschwinden; ein Shorts-Link öffnet das Video als normales Video.")
                }
                Section {
                    limitPicker("Instagram", $igLimit)
                    limitPicker("YouTube", $ytLimit)
                } header: { Text("Tageslimit im Browser") } footer: {
                    Text("Die Instagram-App-Limits von iOS zählen die Zeit in diesem Browser nicht. Nutze dafür dieses Limit.")
                }
                Section {
                    Button("Anmeldedaten und Browserdaten löschen", role: .destructive) { confirmClear = true }
                } footer: {
                    Text("Fokus speichert keine Passwörter und liest keine Inhalte. Anmeldung und Cookies verwaltet iOS (WebKit) lokal auf diesem Gerät.")
                }
            }
            .navigationTitle("Browser-Optionen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fertig") { dismiss() } } }
            .confirmationDialog("Abmelden und alle Browserdaten löschen?", isPresented: $confirmClear, titleVisibility: .visible) {
                Button("Löschen", role: .destructive) { Task { await hub.clearAll() } }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func limitPicker(_ title: String, _ value: Binding<Int>) -> some View {
        Picker(title, selection: value) {
            ForEach(limits, id: \.self) { Text($0 == 0 ? "Aus" : formatMinutes($0)).tag($0) }
        }
    }
}
