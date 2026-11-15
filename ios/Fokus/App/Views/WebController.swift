import SwiftUI
import WebKit

@MainActor
final class WebController: NSObject, ObservableObject {
    let site: FeedSite
    let webView: WKWebView
    private(set) var options: FeedOptions
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var progress = 0.0
    private var observers: [NSKeyValueObservation] = []

    init(site: FeedSite, options: FeedOptions) {
        self.site = site
        self.options = options
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()            // Anmeldung bleibt lokal gespeichert
        config.allowsInlineMediaPlayback = true
        config.applicationNameForUserAgent = "Version/17.0 Mobile/15E148 Safari/604.1"
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        installScript()
        observers = [
            webView.observe(\.canGoBack) { [weak self] w, _ in Task { @MainActor in self?.canGoBack = w.canGoBack } },
            webView.observe(\.canGoForward) { [weak self] w, _ in Task { @MainActor in self?.canGoForward = w.canGoForward } },
            webView.observe(\.estimatedProgress) { [weak self] w, _ in Task { @MainActor in self?.progress = w.estimatedProgress } },
        ]
        loadHome()
    }

    private func installScript() {
        let ucc = webView.configuration.userContentController
        ucc.removeAllUserScripts()
        ucc.addUserScript(WKUserScript(source: FeedScripts.source(for: site, options: options),
                                       injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    func apply(_ new: FeedOptions) {
        guard new != options else { return }
        options = new
        installScript()
        loadHome()
    }

    func loadHome() { webView.load(URLRequest(url: site.homeURL(following: options.startFollowing))) }
    func pauseMedia() { webView.evaluateJavaScript("document.querySelectorAll('video,audio').forEach(function(m){m.pause()})") }

    static func clearAllData() async {
        let store = WKWebsiteDataStore.default()
        await store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast)
    }
}

extension WebController: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, navigationAction.targetFrame?.isMainFrame ?? true,
              let host = url.host else { return decisionHandler(.allow) }
        if !site.isAllowed(host: host) {
            // Fremde Seiten nie im Browser öffnen, sondern in Safari (Anmelde-Weiterleitungen bleiben erlaubt).
            if navigationAction.navigationType == .linkActivated, url.scheme?.hasPrefix("http") == true {
                UIApplication.shared.open(url)
                return decisionHandler(.cancel)
            }
            return decisionHandler(.allow)
        }
        if let target = site.redirect(for: url, options: options) {
            decisionHandler(.cancel)
            webView.load(URLRequest(url: target))
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil { webView.load(navigationAction.request) }
        return nil
    }
}

struct WebViewContainer: UIViewRepresentable {
    let controller: WebController
    func makeUIView(context: Context) -> WKWebView { controller.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

@MainActor
final class BrowserHub: ObservableObject {
    private var controllers: [FeedSite: WebController] = [:]

    func controller(_ site: FeedSite, options: FeedOptions) -> WebController {
        if let c = controllers[site] { return c }
        let c = WebController(site: site, options: options)
        controllers[site] = c
        return c
    }
    func apply(_ options: FeedOptions) { controllers.values.forEach { $0.apply(options) } }
    func pauseAll() { controllers.values.forEach { $0.pauseMedia() } }
    func clearAll() async {
        await WebController.clearAllData()
        controllers.values.forEach { $0.loadHome() }
    }
}
