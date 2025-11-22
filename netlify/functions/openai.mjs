import { OpenAI } from "openai";

// Netlify 云函数的核心处理器
export const handler = async (event) => {
  // 仅允许 POST 方法的请求
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 从前端发送的请求体中解析出指令 (action) 和数据 (payload)
    const { action, payload } = JSON.parse(event.body);
    
    // 从 Netlify 的环境变量中安全地获取 API Key。这个 Key 对外不可见。
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found in server environment");
    }
    
    // 使用 OpenAI 客户端，兼容国内中转站
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://new.wuxuai.com/v1", // 使用用户提供的中转站 Base URL
    });

    let result;

    // 根据前端的指令，执行不同的 API 调用
    if (action === 'generateScript') {
      const { finalBase64, finalMimeType, customPrompt } = payload;
      
      // 1. 将 base64 文本解码
      let textContent = '';
      if (finalMimeType === 'text/plain') {
        const buffer = Buffer.from(finalBase64, 'base64');
        textContent = buffer.toString('utf8');
      } else {
        // 暂不支持非文本文件通过 OpenAI 接口生成文稿
        throw new Error("OpenAI 模式下，文稿生成仅支持纯文本内容。");
      }

      // 2. 构造 OpenAI Chat Completion 请求
      const response = await openai.chat.completions.create({
        model: "gemini-2.5-pro", // 使用中转站推荐的 Gemini 模型名称
        messages: [
          {
            role: "system",
            content: "你是一个专业的播客文稿撰写助手。你需要根据用户提供的书籍内容和要求，生成一个包含标题(title)、简介(intro)和完整文稿(script)的JSON对象。请严格遵守JSON格式要求。",
          },
          {
            role: "user",
            content: `书籍内容：\n\n---\n${textContent}\n---\n\n用户要求：${customPrompt}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const jsonString = response.choices[0].message.content;
      result = JSON.parse(jsonString);

    } else if (action === 'generateCover') {
      // 封面生成（DALL-E 3）
      const { bookTitle } = payload;
      const cleanPrompt = `Design a high-quality, artistic, square podcast cover for a book episode about "${bookTitle}". The style should be abstract, emotional, and visually striking. Important: Do NOT include any text or characters on the image. Focus on visual storytelling and symbolism related to the book's theme.`;
      
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: cleanPrompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      });

      const base64Image = response.data[0].b64_json;
      if (!base64Image) throw new Error("No image generated from API");

      // 返回 data URL 格式
      result = `data:image/png;base64,${base64Image}`;
    
    } else {
      throw new Error(`Invalid action provided: ${action}`);
    }

    // 将成功的结果以 JSON 格式返回给前端
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error("Netlify Function Error:", error);
    // 将错误信息返回给前端，便于调试
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
