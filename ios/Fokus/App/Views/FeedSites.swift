import Foundation

/// Webseiten, die im eingebauten Browser geöffnet werden können.
enum FeedSite: String, CaseIterable, Identifiable {
    case instagram, youtube
    var id: String { rawValue }
    var title: String { self == .instagram ? "Instagram" : "YouTube" }

    func homeURL(following: Bool) -> URL {
        switch self {
        case .instagram: return URL(string: following ? "https://www.instagram.com/?variant=following" : "https://www.instagram.com/")!
        case .youtube: return URL(string: "https://m.youtube.com/")!
        }
    }

    /// Hosts, die im Browser bleiben dürfen (inkl. Anmeldung). Alles andere öffnet in Safari.
    private var hostSuffixes: [String] {
        switch self {
        case .instagram: return ["instagram.com", "cdninstagram.com", "facebook.com", "fbcdn.net", "meta.com"]
        case .youtube: return ["youtube.com", "google.com", "gstatic.com", "googleusercontent.com", "ytimg.com", "googlevideo.com", "youtube-nocookie.com"]
        }
    }

    func isAllowed(host: String) -> Bool {
        hostSuffixes.contains { host == $0 || host.hasSuffix("." + $0) }
    }

    /// Ziel, falls die URL ausgeblendete Inhalte betrifft; sonst nil.
    func redirect(for url: URL, options: FeedOptions) -> URL? {
        let path = url.path
        switch self {
        case .instagram:
            let reel = path.range(of: #"^/(reels?)(/|$)"#, options: .regularExpression) != nil
            let explore = path.hasPrefix("/explore")
            if (options.hideReels && reel) || (options.hideExplore && explore) { return homeURL(following: options.startFollowing) }
        case .youtube:
            if options.hideShorts, path.hasPrefix("/shorts") {
                let id = path.dropFirst("/shorts/".count)
                if path.hasPrefix("/shorts/"), !id.isEmpty { return URL(string: "https://m.youtube.com/watch?v=\(id)") }
                return homeURL(following: false)
            }
        }
        return nil
    }
}

struct FeedOptions: Equatable {
    var hideReels = true
    var hideExplore = true
    var hideShorts = true
    var startFollowing = true
}

/// CSS + JavaScript, das beim Laden der Seite eingeschleust wird.
/// Es blendet nur Elemente aus und blockiert Links – es liest keine Inhalte aus und sendet nichts.
enum FeedScripts {
    static func source(for site: FeedSite, options: FeedOptions) -> String {
        let css: String
        let rewrite: String   // JS-Funktion target(url) -> Zielpfad oder null
        switch site {
        case .instagram:
            var rules: [String] = []
            var blocks: [String] = []
            if options.hideReels {
                rules += ["a[href=\"/reels/\"]", "a[href^=\"/reels/\"]", "a[href*=\"/reel/\"]", "a[href$=\"/reels/\"]",
                          "article:has(a[href*=\"/reel/\"])", "div:has(> a[href=\"/reels/\"])"]
                blocks.append(#"/^\/(reels?)(\/|$)/.test(u.pathname)"#)
            }
            if options.hideExplore {
                rules += ["a[href=\"/explore/\"]", "a[href^=\"/explore\"]"]
                blocks.append(#"/^\/explore/.test(u.pathname)"#)
            }
            css = rules.isEmpty ? "" : rules.joined(separator: ",\n") + " { display: none !important; }"
            let home = options.startFollowing ? "/?variant=following" : "/"
            let cond = blocks.isEmpty ? "false" : blocks.joined(separator: " || ")
            rewrite = "function target(u){ if (u.hostname.indexOf('instagram.com') < 0) return null; return (\(cond)) ? '\(home)' : null; }"
        case .youtube:
            if options.hideShorts {
                css = """
                ytm-reel-shelf-renderer, ytd-reel-shelf-renderer, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2,
                ytm-rich-section-renderer:has(ytm-reel-shelf-renderer), ytm-rich-section-renderer:has(a[href^="/shorts"]),
                ytm-pivot-bar-item-renderer:has(a[href^="/shorts"]), ytm-video-with-context-renderer:has(a[href^="/shorts/"]),
                ytm-compact-video-renderer:has(a[href^="/shorts/"]), grid-shelf-view-model:has(a[href^="/shorts"]),
                a[href^="/shorts"] { display: none !important; }
                """
            } else { css = "" }
            rewrite = options.hideShorts
                ? "function target(u){ if (u.hostname.indexOf('youtube.com') < 0) return null; var m = u.pathname.match(/^\\/shorts\\/([\\w-]+)/); return m ? '/watch?v=' + m[1] : (u.pathname === '/shorts' ? '/' : null); }"
                : "function target(u){ return null; }"
        }
        let cssLiteral = jsString(css)
        return """
        (function () {
          if (window.__fokus) return; window.__fokus = true;
          var css = \(cssLiteral);
          function ensureStyle() {
            if (!css || document.getElementById('fokus-style')) return;
            var s = document.createElement('style'); s.id = 'fokus-style'; s.textContent = css;
            (document.head || document.documentElement).appendChild(s);
          }
          ensureStyle();
          new MutationObserver(ensureStyle).observe(document.documentElement, { childList: true, subtree: false });
          \(rewrite)
          function check() { var t = target(location); if (t) location.replace(t); }
          check();
          ['pushState', 'replaceState'].forEach(function (k) {
            var orig = history[k];
            history[k] = function () { var r = orig.apply(this, arguments); setTimeout(check, 0); return r; };
          });
          window.addEventListener('popstate', check);
          document.addEventListener('click', function (e) {
            var a = e.target && e.target.closest ? e.target.closest('a') : null;
            if (!a || !a.href) return;
            var t = target(new URL(a.href, location.href));
            if (t) { e.preventDefault(); e.stopPropagation(); location.href = t; }
          }, true);
        })();
        """
    }

    private static func jsString(_ s: String) -> String {
        guard let d = try? JSONEncoder().encode(s), let out = String(data: d, encoding: .utf8) else { return "\"\"" }
        return out
    }
}
