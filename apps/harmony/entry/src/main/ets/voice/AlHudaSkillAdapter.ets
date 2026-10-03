export interface AlHudaSystemIntent {
  action: string;
  query?: string;
  locale?: string;
  source?: string;
}

export interface AlHudaSystemResult {
  handled: boolean;
  assistant: string;
  text: string;
  speechOutput: boolean;
  source: string;
}

export class AlHudaSkillAdapter {
  readonly assistantName: string = 'Al-Huda';
  readonly arabicName: string = 'الهُدَى';

  handle(intent: AlHudaSystemIntent): AlHudaSystemResult {
    const query = (intent.query ?? '').trim();
    if (!query) {
      return {
        handled: false,
        assistant: this.assistantName,
        text: 'Al-Huda requires a spoken or textual question.',
        speechOutput: false,
        source: intent.source ?? 'harmony-system-entry'
      };
    }

    return {
      handled: true,
      assistant: this.assistantName,
      text: query,
      speechOutput: true,
      source: intent.source ?? 'harmony-system-entry'
    };
  }
}
