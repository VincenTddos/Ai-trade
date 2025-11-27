
import { GoogleGenAI, Type } from "@google/genai";
import { MarketData, DerivativeMetrics, AIAnalysisResult, GroundingSource } from "../types";

const apiKey = process.env.API_KEY;
// Strict initialization: If no key, the app should alert the user rather than faking it.
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const analyzeMarketWithGemini = async (
  symbol: string,
  marketData: MarketData[],
  derivatives: DerivativeMetrics,
  mode: 'FAST' | 'DEEP' = 'FAST'
): Promise<AIAnalysisResult> => {
  
  if (!ai) {
    throw new Error("API_KEY is missing. Please configure your environment to use real AI analysis.");
  }

  const latest = marketData[marketData.length - 1];
  const prev = marketData[marketData.length - 2] || latest;
  
  // Base prompt data
  const dataContext = `
    交易對：${symbol}
    時間週期：15m
    最新價格：${latest.close}
    前一K線收盤：${prev.close}
    技術指標：
      - MA7: ${latest.ma7.toFixed(2)}
      - MA25: ${latest.ma25.toFixed(2)}
      - MA99: ${latest.ma99.toFixed(2)}
      - BB上軌: ${latest.bb_upper.toFixed(2)}
      - BB下軌: ${latest.bb_lower.toFixed(2)}
      - MACD: ${latest.macd_line.toFixed(2)}
      - 成交量: ${latest.volume}
    衍生品數據：
      - 資金費率=${derivatives.fundingRate}%
      - 多空比=${derivatives.longShortRatio}
  `;

  // Define schema object for reuse
  const schemaObj = {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: ["BUY", "SELL", "HOLD"] },
        confidence: { type: Type.NUMBER, description: "0 to 100" },
        reason: { type: Type.STRING },
        suggested_entry: { type: Type.STRING },
        suggested_take_profit: { type: Type.STRING },
        suggested_stop_loss: { type: Type.STRING },
        suggested_leverage: { type: Type.STRING, description: "Suggest leverage e.g. 5x, 10x, 20x based on volatility" },
        primary_driver: { type: Type.STRING, enum: ["TECHNICAL", "DERIVATIVES", "HYBRID"] }
      },
      required: ["action", "confidence", "reason", "suggested_entry", "suggested_take_profit", "suggested_stop_loss", "suggested_leverage", "primary_driver"]
  };

  let modelName = "gemini-2.5-flash";
  let tools: any[] = [];
  let config: any = {}; 
  let systemInstruction = "你是一名專業的加密貨幣量化交易員。請根據提供的市場數據進行分析。";
  let promptSuffix = "";

  if (mode === 'FAST') {
    // Mode 1: Fast + Google Search (Grounding)
    modelName = "gemini-2.5-flash";
    tools = [{ googleSearch: {} }];
    
    // NOTE: 'responseMimeType: application/json' is NOT supported with Tools.
    // We must instruct the model via prompt to output JSON.
    systemInstruction += " 請務必利用 Google 搜尋檢查與該幣種相關的最新即時新聞（如監管、ETF、黑客攻擊等），並將其納入分析原因中。";
    
    promptSuffix = `
      IMPORTANT: Return the result in pure JSON format only. Do not include markdown code blocks.
      Expected JSON Structure:
      {
        "action": "BUY" | "SELL" | "HOLD",
        "confidence": number,
        "reason": "string",
        "suggested_entry": "string",
        "suggested_take_profit": "string",
        "suggested_stop_loss": "string",
        "suggested_leverage": "string",
        "primary_driver": "TECHNICAL" | "DERIVATIVES" | "HYBRID"
      }
    `;
  } else {
    // Mode 2: Deep Thinking (Gemini 3 Pro)
    modelName = "gemini-3-pro-preview";
    
    // JSON Mode is supported here (no tools used)
    config = {
      responseMimeType: "application/json",
      responseSchema: schemaObj,
      thinkingConfig: { thinkingBudget: 32768 } 
    };
    systemInstruction += " 請使用深度思考模式，詳細推演市場心理、技術結構與大戶博弈邏輯。最終輸出必須是嚴格的 JSON 格式。";
  }

  const prompt = `
    ${systemInstruction}
    
    【市場數據】：
    ${dataContext}

    請輸出 JSON 格式決策，包括針對合約交易的建議槓桿倍數 (suggested_leverage)，需考量當前波動率與風險。
    ${promptSuffix}
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        ...config,
        tools: tools.length > 0 ? tools : undefined
      }
    });

    if (response.text) {
      // Clean up markdown code blocks if present (common with LLM text output)
      let jsonStr = response.text.trim();
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

      let result;
      try {
        result = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse JSON from AI response:", jsonStr);
        throw new Error("AI response was not valid JSON.");
      }

      // Extract Grounding Metadata if available (for Google Search)
      const groundingSources: GroundingSource[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web?.uri && chunk.web?.title) {
            groundingSources.push({
              title: chunk.web.title,
              url: chunk.web.uri
            });
          }
        });
      }

      return {
        ...result,
        timestamp: latest.timestamp, // Use Market Data Timestamp for consistency
        groundingSources
      };
    }
    throw new Error("Empty response from AI");

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw error;
  }
};
