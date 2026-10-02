import AppIntents
import Foundation

struct AskAlHudaIntent: AppIntent {
    static let title: LocalizedStringResource = "Ask Al-Huda"
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Question")
    var question: String

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let normalized = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            throw $question.needsValueError("A question is required.")
        }
        let answer = try await AlHudaIntentRuntime.shared.ask(normalized)
        return .result(value: answer)
    }
}

struct AlHudaAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        [
            AppShortcut(
                intent: AskAlHudaIntent(),
                phrases: [
                    "Ask Al-Huda about \(.applicationName)",
                    "اسأل الهُدَى عن \(.applicationName)"
                ],
                shortTitle: "Ask Al-Huda",
                systemImageName: "waveform"
            )
        ]
    }
}

/// The native app wires this actor to the actual Mobile Runtime Bridge.
actor AlHudaIntentRuntime {
    static let shared = AlHudaIntentRuntime()
    private var handler: ((String) async throws -> String)?

    func install(handler: @escaping (String) async throws -> String) {
        self.handler = handler
    }

    func ask(_ question: String) async throws -> String {
        guard let handler else { throw NSError(domain: "AlHudaIntentRuntime", code: 1) }
        return try await handler(question)
    }
}
