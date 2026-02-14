import type { WidgetProps } from "../../types.js";
import { registerWidget } from "../registry.js";

interface QuestionDef {
  question: string;
  header?: string;
}

function parseAnswers(result: unknown): Record<string, string> | null {
  if (typeof result !== "string") return null;
  const answers: Record<string, string> = {};
  // Format: "question"="answer"
  const re = /"(.+?)"="(.+?)"/g;
  for (let match = re.exec(result); match !== null; match = re.exec(result)) {
    answers[match[1]] = match[2];
  }
  if (Object.keys(answers).length === 0) return null;
  return answers;
}

function AskUserQuestionWidget({ input, result }: WidgetProps<string>) {
  const questions = (input.questions ?? []) as QuestionDef[];
  const answers = parseAnswers(result);
  if (!questions.length || !answers) return null;

  return (
    <div className="space-y-1.5 py-1 text-xs">
      {questions.map((q) => {
        const answer = answers[q.question];
        return (
          <div key={q.question}>
            <span className="text-muted-foreground">{q.question}</span>
            {answer && <span className="ml-1.5 font-medium text-foreground">{answer}</span>}
          </div>
        );
      })}
    </div>
  );
}

registerWidget<string>({
  toolName: "AskUserQuestion",
  label: "Question",
  richLabel: (result: string, input: Record<string, unknown>) => {
    const questions = (input.questions ?? []) as QuestionDef[];
    const answers = parseAnswers(result);
    if (!questions.length || !answers) return null;
    const first = questions[0];
    const answer = answers[first.question];
    if (!answer) return null;
    const label = first.header ?? "Answer";
    return `${label}: ${answer}`;
  },
  component: AskUserQuestionWidget,
});
