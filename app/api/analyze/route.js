// app/api/analyze/route.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getClients } from "@/lib/server-clients"; // Import our central helper
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const bucketName = process.env.GCS_BUCKET_NAME;

export async function POST(request) {
  let tempFileName = '';
  let outputPrefix = '';
  
  try {
    // Initialize clients safely inside the request handler
    const { visionClient, storage } = getClients();

    const formData = await request.formData();
    const file = formData.get("file");
    const targetLanguage = formData.get("language") || "English";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    
    const fileBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(fileBuffer);

    // STEP 1: UPLOAD FILE TO GCS
    tempFileName = `${uuidv4()}-${file.name}`;
    const gcsFile = storage.bucket(bucketName).file(tempFileName);
    await gcsFile.save(imageBuffer, { contentType: file.type });
    
    // STEP 2: CALL VISION API WITH GCS PATH
    const gcsSourceUri = `gs://${bucketName}/${tempFileName}`;
    outputPrefix = `ocr-output/${uuidv4()}/`;
    const gcsDestinationUri = `gs://${bucketName}/${outputPrefix}`;

    const visionRequest = {
      requests: [{
        inputConfig: { mimeType: file.type, gcsSource: { uri: gcsSourceUri } },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        outputConfig: { gcsDestination: { uri: gcsDestinationUri }, batchSize: 20 },
      }],
    };

    const [operation] = await visionClient.asyncBatchAnnotateFiles(visionRequest);
    const [filesResponse] = await operation.promise();
    
    // STEP 3: READ OCR RESULTS
    const [outputFiles] = await storage.bucket(bucketName).getFiles({ prefix: outputPrefix });
    let fullText = '';
    for (const outputFile of outputFiles) {
      if (outputFile.name.endsWith('.json')) {
        const [contents] = await outputFile.download();
        const jsonData = JSON.parse(contents.toString());
        jsonData.responses.forEach(response => {
          if (response.fullTextAnnotation && response.fullTextAnnotation.text) {
            fullText += response.fullTextAnnotation.text;
          } else if (response.textAnnotations && response.textAnnotations.length > 0) {
            fullText += response.textAnnotations[0].description;
          }
        });
      }
    }

    if (!fullText || fullText.trim() === '') {
      return NextResponse.json({ error: "We couldn't find any readable text in your document. Please try a different file." }, { status: 400 });
    }

    // STEP 4: SEND TO GEMINI
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `
      You are an expert legal document analyzer named "Lexi सिंपलीफाई". 
      Your task is to analyze the following document text and provide a structured JSON output.
      All explanations must be in extremely simple, clear, and plain language.
      
      Document Text:
      """
      ${fullText.substring(0, 25000)} 
      """

      Based on the text, provide the following in a single JSON object:
      1. "category": A one or two-word category for the document.
      2. "summary": A comprehensive and highly detailed summary of the entire document.
      3. "risks": An array of strings, where each string is a potential risk or obligation.
      4. "jargon": An array of objects, each with a "term" and an "explanation".
      5. "translations": An object containing the translation of the 'summary' and 'risks' fields into **${targetLanguage}**. The object must have two keys: "summary" (a string) and "risks" (an array of strings).
    `;

    const geminiResult = await model.generateContent(prompt);
    const response = await geminiResult.response;
    const text = response.text();
    const jsonResponse = JSON.parse(text.replace(/```json/g, "").replace(/```/g, ""));

    return NextResponse.json(jsonResponse);

  } catch (error) {
    console.error("🔥🔥🔥 CRITICAL ERROR in analysis API:", error);
    return NextResponse.json({ error: "Failed to analyze document." }, { status: 500 });
  } finally {
    // STEP 5: CLEANUP
    const { storage } = getClients(); // Also get client for cleanup
    console.log("Cleaning up temporary files...");
    if (tempFileName) {
      await storage.bucket(bucketName).file(tempFileName).delete().catch(console.error);
    }
    if (outputPrefix) {
      const [outputFiles] = await storage.bucket(bucketName).getFiles({ prefix: outputPrefix });
      await Promise.all(outputFiles.map(file => file.delete().catch(console.error)));
    }
    console.log("Cleanup complete.");
  }
}