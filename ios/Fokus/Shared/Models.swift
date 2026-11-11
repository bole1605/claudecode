import Foundation
import FamilyControls

// MARK: - Konstanten

enum Constants {
    /// Wird pro Target aus der Info.plist gelesen (siehe project.yml → BUNDLE_PREFIX).
    static var appGroup: String {
        (Bundle.main.object(forInfoDictionaryKey: "FokusAppGroup") as? String) ?? "group.com.example.fokus"
    }
}

enum Day {
    static func key(_ date: Date = .now) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
    static func isWeekend(_ date: Date) -> Bool { Calendar.current.isDateInWeekend(date) }
    static func minuteOfDay(_ date: Date) -> Int {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (c.hour ?? 0) * 60 + (c.minute ?? 0)
    }
}

func formatMinutes(_ minutes: Int) -> String {
    let h = minutes / 60, m = minutes % 60
    switch (h, m) {
    case (0, _): return "\(m) Min"
    case (_, 0): return "\(h) Std"
    default: return "\(h) Std \(m) Min"
    }
}

// MARK: - Apps

enum TrackedApp: String, CaseIterable, Codable, Identifiable {
    case instagram, tiktok
    var id: String { rawValue }
    var title: String { self == .instagram ? "Instagram" : "TikTok" }
    /// Bewusst generische SF Symbols – keine fremden Logos (Markenrichtlinien / App-Review 5.2).
    var symbol: String { self == .instagram ? "camera.circle.fill" : "play.circle.fill" }
}

// MARK: - Einstellungen (vom Nutzer, pro App)

struct AppSettings: Codable, Equatable {
    var isEnabled = false

    // Tageslimit
    var weekdayMinutes = 30
    var weekendMinutes = 45
    var warningPercent = 80            // 0 = keine Warnung

    // Schlafenszeit (Minuten seit Mitternacht)
    var bedtimeEnabled = false
    var bedtimeStart = 22 * 60
    var bedtimeEnd = 7 * 60

    // Bewusster Start: Sperre vor jedem Öffnen
    var gateEnabled = false
    var gateMinutes = 5

    // Zusatzzeit nach Limit
    var extraMinutes = 5
    var extrasPerDay = 1               // 0 = keine

    // Strenger Modus
    var strictMode = false
    var strictOffRequestedDay: String?
    var pending: Pending?

    struct Pending: Codable, Equatable {
        var weekday: Int
        var weekend: Int
        var since: String
    }

    func minutes(on date: Date) -> Int { Day.isWeekend(date) ? weekendMinutes : weekdayMinutes }

    func isInBedtime(_ date: Date) -> Bool {
        let m = Day.minuteOfDay(date)
        return bedtimeStart <= bedtimeEnd
            ? (m >= bedtimeStart && m < bedtimeEnd)
            : (m >= bedtimeStart || m < bedtimeEnd)
    }

    var bedtimeDuration: Int {
        let d = bedtimeEnd - bedtimeStart
        return d > 0 ? d : d + 24 * 60
    }

    /// Im strengen Modus wirken Erhöhungen erst ab morgen, Senkungen sofort.
    mutating func requestLimits(weekday: Int, weekend: Int, today: String) {
        if strictMode && (weekday > weekdayMinutes || weekend > weekendMinutes) {
            pending = Pending(weekday: weekday, weekend: weekend, since: today)
            weekdayMinutes = min(weekdayMinutes, weekday)
            weekendMinutes = min(weekendMinutes, weekend)
        } else {
            weekdayMinutes = weekday
            weekendMinutes = weekend
            pending = nil
        }
    }

    mutating func applyPendingIfDue(today: String) {
        if let p = pending, p.since != today {
            weekdayMinutes = p.weekday
            weekendMinutes = p.weekend
            pending = nil
        }
        if let d = strictOffRequestedDay, d != today {
            strictMode = false
            strictOffRequestedDay = nil
        }
    }
}

// MARK: - Laufzeitzustand (von Extensions geschrieben)

struct RuntimeState: Codable, Equatable {
    var limitReachedDay: String?
    var session: Session?
    var extraUsedDay: String?
    var extraUsed = 0
    var scheduledDay: String?

    struct Session: Codable, Equatable {
        enum Kind: String, Codable { case gate, extra }
        var kind: Kind
        var until: Date
    }

    func activeSession(at now: Date) -> Session? {
        guard let s = session, s.until > now else { return nil }
        return s
    }

    func extrasUsedToday(_ today: String) -> Int { extraUsedDay == today ? extraUsed : 0 }
}

extension FamilyActivitySelection {
    var isEmptySelection: Bool {
        applicationTokens.isEmpty && categoryTokens.isEmpty && webDomainTokens.isEmpty
    }
}
