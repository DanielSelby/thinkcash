import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODEL = 'gemini-2.0-flash'

export async function POST(req: NextRequest) {
  try {
    const { messages, system } = await req.json()

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: { message: 'GEMINI_API_KEY is not configured on the server' } },
        { status: 500 }
      )
    }

    // Gemini's API shape differs from Anthropic's:
    // - "system" is a separate top-level field (systemInstruction), not a message
    // - messages use "contents" with role "user" | "model" (not "assistant")
    // - message content is an array of { text } parts, not a plain string
    const contents = (messages || []).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          generationConfig: { maxOutputTokens: 1024 },
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data?.error || data }, { status: response.status })
    }

    // Normalize Gemini's response shape into the same { content: [{ text }] }
    // shape the chat UI already expects, so the frontend needs no changes.
    const replyText = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? ''

    return NextResponse.json({ content: [{ text: replyText }] })
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 })
  }
}