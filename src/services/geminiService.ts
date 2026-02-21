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
            2. structured_data: An object containing:
               - time: Time of visit or document.
               - hospital: Name of the hospital or clinic.
               - reason_for_visit: Primary reason for the visit.
               - symptoms: A list of symptoms mentioned.
               - lab_results: A list of lab results, each with { test, result, unit, reference_range, interpretation }.
               - diagnosis: Any diagnosis mentioned.
               - plan: The recommended treatment plan or next steps.
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
          structured_data: {
            type: Type.OBJECT,
            properties: {
              time: { type: Type.STRING },
              hospital: { type: Type.STRING },
              reason_for_visit: { type: Type.STRING },
              symptoms: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              lab_results: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    test: { type: Type.STRING },
                    result: { type: Type.STRING },
                    unit: { type: Type.STRING },
                    reference_range: { type: Type.STRING },
                    interpretation: { type: Type.STRING }
                  },
                  required: ["test", "result"]
                }
              },
              diagnosis: { type: Type.STRING },
              plan: { type: Type.STRING }
            }
          },
          date: { type: Type.STRING },
          type: { type: Type.STRING },
          follow_ups: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["summary", "structured_data", "date", "type", "follow_ups"]
      }
    }
  });

  const data = JSON.parse(response.text || "{}");
  // We'll store structured_data in full_text for the UI to consume
  return {
    ...data,
    full_text_translated: JSON.stringify(data.structured_data)
  };
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

export const chatWithAI = async (history: any[], chatHistory: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
  const ai = getAI();
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: `You are MedLeaf Advice, an AI health strategy assistant. 
      You have access to the user's medical history: ${JSON.stringify(history)}.
      Your goal is to provide personalized health strategies, explain medical jargon, and help users understand their insurance benefits.
      Be professional, empathetic, and clear. Always remind users to consult with a medical professional for actual medical advice.`,
    },
    history: chatHistory.slice(0, -1),
  });

  const lastMessage = chatHistory[chatHistory.length - 1].parts[0].text;
  const response = await chat.sendMessage({ message: lastMessage });
  return response.text;
};
