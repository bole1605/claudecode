import SwiftUI
import FamilyControls

struct AppDetailView: View {
    @EnvironmentObject private var model: AppModel
    let app: TrackedApp
    @State private var pickerShown = false

    private var s: AppSettings { model.settings(app) }
    private var locked: Bool { s.strictMode }
    private func bind<T>(_ kp: WritableKeyPath<AppSettings, T>) -> Binding<T> {
        Binding(get: { s[keyPath: kp] }, set: { v in model.update(app) { $0[keyPath: kp] = v } })
    }
    private var weekday: Binding<Int> {
        Binding(get: { s.pending?.weekday ?? s.weekdayMinutes },
                set: { v in model.update(app) { $0.requestLimits(weekday: v, weekend: $0.pending?.weekend ?? $0.weekendMinutes, today: Day.key()) } })
    }
    private var weekend: Binding<Int> {
        Binding(get: { s.pending?.weekend ?? s.weekendMinutes },
                set: { v in model.update(app) { $0.requestLimits(weekday: $0.pending?.weekday ?? $0.weekdayMinutes, weekend: v, today: Day.key()) } })
    }

    var body: some View {
        Form {
            Section {
                Toggle("Zeitlimit aktivieren", isOn: bind(\.isEnabled)).disabled(locked)
            }

            Section {
                Button { pickerShown = true } label: {
                    Label(model.selection(app).isEmptySelection ? "\(app.title) auswählen" : "Auswahl ändern", systemImage: "app.badge.checkmark")
                }
                ForEach(Array(model.selection(app).applicationTokens), id: \.self) { Label($0) }
            } header: { Text("App") } footer: {
                Text("Wähle in der Liste \(app.title) aus. Die Auswahl bleibt privat auf diesem Gerät – Fokus erfährt keine Namen oder Inhalte.")
            }

            Section {
                Stepper(value: weekday, in: 5...240, step: 5) { LabeledContent("Mo–Fr", value: formatMinutes(weekday.wrappedValue)) }
                Stepper(value: weekend, in: 5...240, step: 5) { LabeledContent("Sa & So", value: formatMinutes(weekend.wrappedValue)) }
                Picker("Warnung", selection: bind(\.warningPercent)) {
                    Text("Aus").tag(0); Text("Bei 50 %").tag(50); Text("Bei 80 %").tag(80); Text("Bei 90 %").tag(90)
                }
            } header: { Text("Tageslimit") } footer: {
                if s.pending != nil { Text("Die Erhöhung gilt ab morgen (Strenger Modus).") }
                else { Text("Nach Ablauf wird \(app.title) bis Mitternacht pausiert. Die Warnung kommt als Mitteilung.") }
            }

            Section {
                Toggle("Schlafenszeit", isOn: bind(\.bedtimeEnabled))
                if s.bedtimeEnabled {
                    DatePicker("Von", selection: minutesBinding(\.bedtimeStart), displayedComponents: .hourAndMinute)
                    DatePicker("Bis", selection: minutesBinding(\.bedtimeEnd), displayedComponents: .hourAndMinute)
                }
            } header: { Text("Nachts pausieren") } footer: {
                if s.bedtimeEnabled && s.bedtimeDuration < 15 { Text("Der Zeitraum muss mindestens 15 Minuten lang sein.").foregroundStyle(.red) }
            }
            .disabled(locked)

            Section {
                Toggle("Vor dem Öffnen nachfragen", isOn: bind(\.gateEnabled))
                if s.gateEnabled {
                    Picker("Zeit pro Öffnen", selection: bind(\.gateMinutes)) {
                        ForEach([3, 5, 10, 15], id: \.self) { Text("\($0) Min").tag($0) }
                    }
                }
            } header: { Text("Bewusster Start") } footer: {
                Text(app == .instagram
                     ? "Jedes Öffnen beginnt mit einer kurzen Pause und dem Tipp, den „Folge ich“-Feed zu wählen."
                     : "Jedes Öffnen beginnt mit einer kurzen Pause. Das hilft gegen Autopilot-Scrollen.")
            }
            .disabled(locked)

            Section {
                Stepper(value: bind(\.extrasPerDay), in: 0...3) { LabeledContent("Zusatzzeiten pro Tag", value: "\(s.extrasPerDay)") }
                if s.extrasPerDay > 0 {
                    Picker("Dauer", selection: bind(\.extraMinutes)) {
                        ForEach([5, 10, 15], id: \.self) { Text("\($0) Min").tag($0) }
                    }
                }
            } header: { Text("Zusatzzeit nach Limit") } footer: { Text("Bei 0 gibt es keine Verlängerung.") }
            .disabled(locked)

            Section {
                if s.strictMode {
                    if s.strictOffRequestedDay != nil {
                        Label("Der Strenge Modus endet morgen.", systemImage: "clock")
                    } else {
                        Button("Strengen Modus ab morgen beenden", role: .destructive) {
                            model.update(app) { $0.strictOffRequestedDay = Day.key() }
                        }
                    }
                } else {
                    Toggle("Strenger Modus", isOn: bind(\.strictMode))
                }
            } header: { Text("Selbstschutz") } footer: {
                Text("Im Strengen Modus gibt es keine Zusatzzeit, Limits lassen sich nur senken, und Einstellungen sind gesperrt. Erhöhungen und das Beenden wirken erst ab morgen.")
            }
        }
        .familyActivityPicker(isPresented: $pickerShown, selection: model.selectionBinding(app))
        .navigationTitle(app.title)
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.selection, trigger: s)
    }

    private func minutesBinding(_ kp: WritableKeyPath<AppSettings, Int>) -> Binding<Date> {
        Binding(
            get: {
                let m = s[keyPath: kp]
                return Calendar.current.date(bySettingHour: m / 60, minute: m % 60, second: 0, of: .now) ?? .now
            },
            set: { d in model.update(app) { $0[keyPath: kp] = Day.minuteOfDay(d) } })
    }
}
