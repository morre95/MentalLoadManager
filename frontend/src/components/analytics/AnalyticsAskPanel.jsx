import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function AnalyticsAskPanel({ vm }) {
    const {
        askQuestion,
        askLoading,
        askError,
        askResponse,
        suggestedFollowups,
    } = vm;
    const [question, setQuestion] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        await askQuestion(question);
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Ask Analytics</CardTitle>
                <CardDescription>Ask questions about trends, backlog, balance, or completion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <form className="space-y-3" onSubmit={handleSubmit}>
                    <Textarea
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        placeholder="Why did load balance drop this month?"
                        className="min-h-[96px]"
                    />
                    <div className="flex items-center gap-2">
                        <Button type="submit" disabled={askLoading || !question.trim()}>
                            {askLoading ? "Asking..." : "Ask"}
                        </Button>
                        {askResponse?.cached ? (
                            <span className="text-xs text-muted-foreground">Cached answer</span>
                        ) : null}
                    </div>
                </form>

                {askError ? <p className="text-sm text-destructive">{String(askError?.message || "Failed to answer question")}</p> : null}

                {askResponse?.answer ? (
                    <div className="space-y-3 rounded-md border border-border p-4">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Answer</p>
                            <p className="mt-1 text-sm text-foreground">{askResponse.answer}</p>
                        </div>

                        {(askResponse.evidence || []).length ? (
                            <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Evidence</p>
                                <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground space-y-1">
                                    {askResponse.evidence.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        {(suggestedFollowups || []).length ? (
                            <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Suggested follow-ups</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {suggestedFollowups.map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                                            onClick={() => {
                                                setQuestion(item);
                                                void askQuestion(item);
                                            }}
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}
