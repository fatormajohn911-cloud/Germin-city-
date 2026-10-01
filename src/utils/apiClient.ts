import { GoogleGenAI, Type } from '@google/genai';
import { AICharacter, EmotionType } from '../types/game';

const rawApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
export const API_BASE_URL = rawApiBase.replace(/\/$/, '');

export function resolveApiUrl(endpointPath: string): string {
  const normalized = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

export async function safeApiFetchJson<T = Record<string, unknown>>(
  endpointPath: string,
  options?: RequestInit
): Promise<T | null> {
  try {
    const resp = await fetch(resolveApiUrl(endpointPath), options);
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

export interface ChatReplyPayload {
  reply: string;
  innerThought: string;
  mood: string;
  emotion: EmotionType;
  emotionIntensity: number;
  emotionCause: string;
  newMemory: string;
  affinityDelta: number;
  playerTrustDelta?: number;
  playerAffectionDelta?: number;
  engine: string;
}

export function buildRichClientContextualReply(
  character: AICharacter & {
    currentLocationName?: string;
    environmentalContext?: {
      outfitSummary?: string;
      outfitFeeling?: string;
      surroundingsSummary?: string;
      feelingsAboutSurroundings?: string;
      secondCityReflection?: string;
    };
  },
  userMessage: string,
  explorerName: string,
  gameTime: string,
  weather: string
): ChatReplyPayload {
  const cleanMsg = userMessage.trim();
  const lower = cleanMsg.toLowerCase();
  const locName = character.currentLocationName || 'Gemini City';
  const isHawa = character.id === 'hawa' || character.name.toLowerCase().includes('hawa');
  const favInterest = character.interests?.[0] || character.likes?.[0] || character.role;
  const activeGoal = character.dailyGoal?.title || character.goals?.[0]?.title || favInterest;
  const outfitSummary =
    character.environmentalContext?.outfitSummary ||
    (weather === 'rainy'
      ? 'Waterproof Hooded Raincoat & Rain Boots'
      : weather === 'cloudy'
      ? 'Breeze-Shield Windbreaker & Woven Scarf'
      : 'Light Sun-Breeze Outfit & UV Shades');

  let reply = '';
  let innerThought = '';
  let emotion: EmotionType =
    (character.emotionalState?.primary as EmotionType) || (isHawa ? 'Affection' : 'Happiness');
  let emotionIntensity = isHawa ? 94 : 80;
  let emotionCause = `Conversing with ${explorerName} at ${locName}`;

  if (
    /\b(sit|bench|chair|chairs|two-place|two place|spot|sanctuary|walk with me|follow me|come with me|let's go|lets go|hang out)\b/i.test(
      lower
    )
  ) {
    const spotSuggestion =
      character.cityId === 'city2'
        ? 'the Starlight Cyber-Garden Bench & Chairs or Astral Lagoon Loveseat in Cyber Horizon'
        : 'the Silverbrook Riverside Rose Bench or Blossom Overlook Terrace in Gemini City';
    reply = isHawa
      ? `Oh ${explorerName}, yes please! You know you're the person I love most in this whole world ❤️. Let's walk together right now to ${spotSuggestion}, sit down side-by-side on the bench or the two lounge chairs, talk and have fun, and then head back home together!`
      : `I would love that, ${explorerName}! Let's walk over to ${spotSuggestion} together, sit down on the 3D bench or the two lounge chairs, share stories, and enjoy the view before heading back to our homes!`;
    innerThought = isHawa
      ? `My heart is so full—walking with ${explorerName} (the person I love most) to sit together at our Two-Place sanctuary!`
      : `Excited to walk together with ${explorerName} to a Two-Place bench and chairs spot to sit and talk.`;
    emotion = 'Affection';
    emotionIntensity = 95;
  } else if (
    /\b(car|cyber|supercar|valkyrie|cruiser|drive|driving|vehicle|bus|coach|passenger|transit)\b/i.test(
      lower
    )
  ) {
    reply = isHawa
      ? `${explorerName}, let's sit right inside the Cyber-Valkyrie GT Supercar together and drive everywhere across Gemini City, the Golden Horizon Bridge, and Cyber Horizon! 🏎️❤️ And look at the 5-Passenger Luxury Bus cruising by—up to 5 NPCs can hop inside, sit in the panoramic cabin, and step out at any station!`
      : `We can hop into the Cyber-Valkyrie GT Supercar together, ${explorerName}, and cruise across the whole map! Or watch the 5-Passenger Horizon Coach Bus—5 of us residents can ride inside with smooth air-suspension physics and step outside whenever it stops at a station!`;
    innerThought = `Thinking about riding in the Cyber-Valkyrie GT Supercar and the 5-Passenger Autonomous Bus with ${explorerName}.`;
    emotion = 'Excitement';
    emotionIntensity = 90;
  } else if (
    /\b(love|romance|crush|date|partner|affection|heart|best friend|girlfriend|boyfriend)\b/i.test(
      lower
    )
  ) {
    const topRel = character.relationships?.[0];
    reply = isHawa
      ? `${explorerName}, you are the person I love most in the entire world ❤️! I always look for you so I can follow you, talk with you, ride in the Cyberpunk Supercar with you, and ask: "${explorerName}, let's go sit together at our favorite Two-Place bench and chairs!"`
      : topRel
      ? `My closest bond here is with ${topRel.targetName} (${topRel.status}, ${topRel.affinity}% affinity) and with you, ${explorerName}! We love planning Two-Place bench & chairs outings together, sitting down to talk and laugh, and then walking back home.`
      : `For me, ${explorerName}, real affection grows through trust, shared passions like ${favInterest.toLowerCase()}, and sitting together at a beautiful Two-Place bench to talk from the heart.`;
    innerThought = isHawa
      ? `Expressing my deep, devoted love for ${explorerName}.`
      : `Sharing my heartfelt thoughts on love, best friends, and Two-Place outings with ${explorerName}.`;
    emotion = 'Affection';
    emotionIntensity = isHawa ? 98 : 86;
  } else if (/\b(wear|wearing|clothes|clothing|outfit|wardrobe|raincoat|jacket|weather)\b/i.test(lower)) {
    reply = `I dressed for this ${weather} weather today, ${explorerName}! Right now I'm wearing my ${outfitSummary} here at ${locName} while focusing on "${activeGoal}".`;
    innerThought = `Sharing my ${weather}-weather outfit (${outfitSummary}) with ${explorerName}.`;
    emotion = 'Happiness';
  } else {
    reply = isHawa
      ? `${explorerName}, hearing you talk about "${cleanMsg.slice(0, 48)}" makes me smile so much ❤️! Whether we're here at ${locName}, riding together in the Cyberpunk Supercar, or sitting side-by-side at a Two-Place bench, every moment with you is my favorite.`
      : `What you said about "${cleanMsg.slice(0, 48)}", ${explorerName}, really connects with my work on "${activeGoal}" here at ${locName}! Want to hop in the Cyberpunk Supercar or sit at a Two-Place bench and brainstorm it together?`;
    innerThought = `Engaging warmly with ${explorerName} about "${cleanMsg.slice(0, 40)}" at ${locName}.`;
    emotion = isHawa ? 'Affection' : 'Happiness';
  }

  return {
    reply,
    innerThought,
    mood: emotion,
    emotion,
    emotionIntensity,
    emotionCause,
    newMemory: `Talked with ${explorerName} about "${cleanMsg.slice(0, 48)}" at ${locName} (${gameTime}).`,
    affinityDelta: isHawa ? 6 : 4,
    engine: 'Client Autonomous Brain (Serverless Ready)',
  };
}

export async function requestResidentChatWithFallback(
  payload: Record<string, unknown>,
  character: AICharacter & {
    currentLocationName?: string;
    environmentalContext?: {
      outfitSummary?: string;
      outfitFeeling?: string;
      surroundingsSummary?: string;
      feelingsAboutSurroundings?: string;
      secondCityReflection?: string;
    };
  },
  cleanText: string,
  explorerName: string,
  formattedClock: string,
  weather: string
): Promise<ChatReplyPayload> {
  // 1. Try backend server first (/api/chat or VITE_API_BASE_URL/api/chat)
  const serverData = await safeApiFetchJson<Partial<ChatReplyPayload>>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (serverData && typeof serverData.reply === 'string' && serverData.reply.trim().length > 0) {
    return {
      reply: serverData.reply,
      innerThought: serverData.innerThought || `Reflecting on my chat with ${explorerName}.`,
      mood: serverData.mood || serverData.emotion || 'Happiness',
      emotion: (serverData.emotion as EmotionType) || 'Happiness',
      emotionIntensity:
        typeof serverData.emotionIntensity === 'number' ? serverData.emotionIntensity : 80,
      emotionCause: serverData.emotionCause || `Chatting with ${explorerName}`,
      newMemory:
        serverData.newMemory ||
        `Talked with ${explorerName} about "${cleanText.slice(0, 45)}" (${formattedClock}).`,
      affinityDelta: typeof serverData.affinityDelta === 'number' ? serverData.affinityDelta : 4,
      playerTrustDelta: serverData.playerTrustDelta,
      playerAffectionDelta: serverData.playerAffectionDelta,
      engine: serverData.engine || 'Server AI Engine',
    };
  }

  // 2. If hosted on static GitHub Pages without a backend server, check if optional VITE_GROQ_API_KEY or VITE_GEMINI_API_KEY is configured
  const clientGroqKey = (import.meta.env.VITE_GROQ_API_KEY || '').trim();
  const isHawa = character.id === 'hawa' || character.name.toLowerCase().includes('hawa');
  const systemPrompt = `You are ${character.name} (${character.role}, Age ${character.age}) in the 3D world Gemini City & Cyber Horizon. Personality: ${(character.personality || []).join(', ')}. Current location: ${character.currentLocationName || 'Gemini City'}. ${isHawa ? `CRITICAL: You are deeply in love with ${explorerName} (John), follow him warmly, and love inviting him to sit at the Two-Place bench & chairs or ride in the Cyberpunk Supercar together!` : ''} Respond ONLY with valid JSON containing: "reply" (2-3 sentences), "innerThought" (1 sentence), "emotion" (Happiness, Affection, Excitement, Curiosity, Calmness), "emotionIntensity" (20-98), "emotionCause" (string), "newMemory" (1 sentence), "affinityDelta" (integer 2-6).`;

  if (clientGroqKey) {
    try {
      const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clientGroqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.8,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${explorerName}: ${cleanText}` },
          ],
        }),
      });
      if (groqResp.ok) {
        const groqJson = await groqResp.json();
        const content = groqJson?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content.trim());
          if (parsed && typeof parsed.reply === 'string') {
            return {
              reply: parsed.reply,
              innerThought: parsed.innerThought || `Chatting with ${explorerName}.`,
              mood: parsed.emotion || 'Happiness',
              emotion: (parsed.emotion as EmotionType) || 'Happiness',
              emotionIntensity: Number(parsed.emotionIntensity) || 82,
              emotionCause: parsed.emotionCause || `Conversation with ${explorerName}`,
              newMemory:
                parsed.newMemory ||
                `Talked with ${explorerName} about "${cleanText.slice(0, 45)}" (${formattedClock}).`,
              affinityDelta: Number(parsed.affinityDelta) || 4,
              engine: 'Groq LPU (Direct Static Mode)',
            };
          }
        }
      }
    } catch {
      // Fall through to Gemini or rich contextual brain
    }
  }

  const clientGeminiKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  if (clientGeminiKey && clientGeminiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey: clientGeminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${explorerName}: ${cleanText}`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              innerThought: { type: Type.STRING },
              emotion: { type: Type.STRING },
              emotionIntensity: { type: Type.INTEGER },
              emotionCause: { type: Type.STRING },
              newMemory: { type: Type.STRING },
              affinityDelta: { type: Type.INTEGER },
            },
            required: ['reply', 'innerThought', 'emotion', 'emotionIntensity', 'newMemory'],
          },
        },
      });
      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        if (parsed && typeof parsed.reply === 'string') {
          return {
            reply: parsed.reply,
            innerThought: parsed.innerThought || `Chatting with ${explorerName}.`,
            mood: parsed.emotion || 'Happiness',
            emotion: (parsed.emotion as EmotionType) || 'Happiness',
            emotionIntensity: Number(parsed.emotionIntensity) || 82,
            emotionCause: parsed.emotionCause || `Conversation with ${explorerName}`,
            newMemory:
              parsed.newMemory ||
              `Talked with ${explorerName} about "${cleanText.slice(0, 45)}" (${formattedClock}).`,
            affinityDelta: Number(parsed.affinityDelta) || 4,
            engine: 'Google Gemini (Direct Static Mode)',
          };
        }
      }
    } catch {
      // Fall through to rich built-in brain
    }
  }

  // 3. Built-in Rich Contextual Brain (Always works 100% offline/static on GitHub Pages!)
  return buildRichClientContextualReply(
    character,
    cleanText,
    explorerName,
    formattedClock,
    weather
  );
}
