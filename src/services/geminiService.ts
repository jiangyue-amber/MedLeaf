import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const analyzeMedicalDocument = async (base64Data: string, mimeType: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Data.split(',')[1] || base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: `Analyze this medical document (Doctor's note, lab result, or discharge summary). 
            Extract the following information in JSON format:
            1. summary: A concise summary of the document in plain English.
            2. full_text_translated: A translation of complex medical jargon into simple terms.
            3. date: The date of the document (YYYY-MM-DD).
            4. type: The type of document (e.g., "Lab Result", "Doctor Note").
            5. follow_ups: A list of 3-4 smart questions to ask the doctor next time.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          full_text_translated: { type: Type.STRING },
          date: { type: Type.STRING },
          type: { type: Type.STRING },
          follow_ups: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["summary", "full_text_translated", "date", "type", "follow_ups"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const analyzeInsuranceDocument = async (base64Data: string, mimeType: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Data.split(',')[1] || base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: `Analyze this insurance document (Card or EOB). 
            Extract the following information in JSON format:
            1. provider: The insurance provider name.
            2. type: The type of insurance (e.g., "Medical", "Dental", "Vision").
            3. benefits: An array of objects, each representing a benefit term (e.g., Copay, Deductible, Out-of-pocket maximum). 
               Each object should have:
               - term: The name of the benefit (e.g., "PCP Copay").
               - value: The cost or amount (e.g., "$20").
               - explanation: A simple, plain-English explanation of what this term means in this context.
            4. limits: An array of objects with { label, used, total, explanation } for any mentioned usage limits (e.g., "2 of 4 dental cleanings").
               - explanation: A simple, plain-English explanation of what this limit means.
            5. expiration: Any mentioned expiration or renewal date.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          provider: { type: Type.STRING },
          type: { type: Type.STRING },
          benefits: { 
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                value: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["term", "value", "explanation"]
            }
          },
          limits: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                used: { type: Type.NUMBER },
                total: { type: Type.NUMBER },
                explanation: { type: Type.STRING }
              },
              required: ["label", "used", "total", "explanation"]
            }
          },
          expiration: { type: Type.STRING }
        },
        required: ["provider", "type", "benefits", "limits", "expiration"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const getMacroRecommendations = async (history: any[]) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this medical history summary, provide 2-3 macro-level insurance strategy recommendations. 
    History: ${JSON.stringify(history)}
    Format: A short list of recommendations.`,
  });

  return response.text;
};
