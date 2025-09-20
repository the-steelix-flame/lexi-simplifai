// app/api/ask/route.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export async function POST(request) {
  try {
    const { summary, question } = await request.json();

    if (!summary || !question) {
      return NextResponse.json({ error: "Summary and question are required." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const prompt = `
      You are a helpful Q&A assistant for a legal document analysis tool.
      Your task is to answer the user's question based ONLY on the provided summary of a legal document.
      The question can be anything about the summary and related to it but if the question is not at all related to the summary, you MUST respond with: "I'm sorry, but the answer to that question cannot be found in the document's summary."

      Here is the document summary:
      """
      ${summary}
      """

      Here is the user's question:
      """
      ${question}
      """

      Provide your answer:
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text();

    return NextResponse.json({ answer });

  } catch (error) {
    console.error("🔥🔥🔥 CRITICAL ERROR in Q&A API:", error);
    return NextResponse.json({ error: "Failed to get an answer." }, { status: 500 });
  }
}