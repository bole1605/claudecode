import DeviceActivity
import SwiftUI

@main
struct FokusReport: DeviceActivityReportExtension {
    var body: some DeviceActivityReportScene {
        TodayScene { TodayView(duration: $0) }
    }
}

/// Zeigt die heutige Nutzungszeit der vom Host-Filter gewählten Apps.
/// Läuft in einer Sandbox des Systems – die Daten verlassen das Gerät nie.
struct TodayScene: DeviceActivityReportScene {
    let context: DeviceActivityReport.Context = .today
    let content: (TimeInterval) -> TodayView

    func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> TimeInterval {
        var total: TimeInterval = 0
        for await d in data {
            for await segment in d.activitySegments { total += segment.totalActivityDuration }
        }
        return total
    }
}

struct TodayView: View {
    let duration: TimeInterval

    private var text: String {
        let m = Int(duration / 60)
        return m < 1 ? "Heute noch nicht genutzt" : "Heute: \(formatMinutes(m))"
    }

    var body: some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
