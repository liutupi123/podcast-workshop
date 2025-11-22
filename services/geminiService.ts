import { PodcastContent } from "../types";
// @ts-ignore
import JSZip from "jszip";

// 我们在 Netlify 上的云函数的固定访问地址
const GEMINI_FUNCTION_URL = "/.netlify/functions/openai";

/**
 * 一个通用的函数，用于向我们的 Netlify 云函数发送请求。
 * @param action - 要执行的操作 (例如 'generateScript' 或 'generateCover')
 * @param payload - 发送给云函数的数据
 */
async function callGeminiFunction(action: string, payload: any) {
  const response = await fetch(GEMINI_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  const responseData = await response.json();

  if (!response.ok) {
    // 如果云函数返回错误，则抛出错误信息
    throw new Error(responseData.error || '云函数调用失败，请检查服务器日志');
  }
  return responseData;
}

// 导出 DEFAULT_SCRIPT_PROMPT
export const DEFAULT_SCRIPT_PROMPT = `我叫刘土皮，我正在录制一个播客，是读书情感类的播客，播客的名字叫《nothing impossible》,请通读这本书的内容，写一个播客稿给我，要求语言自然流畅，有趣味性，通俗易懂，并且富有情感，有感染力，时间1小时左右生成我需要的播客文稿跟这一期的播客简介`;

// 修改后的 generatePodcastScript 函数
// 免费套餐的安全阈值：大约 200,000 个字符（对应约 50,000 个 Token）
const SAFETY_THRESHOLD = 200000;

export const generatePodcastScript = async (
  fileBase64: string,
  fileText: string, // 新增：用于检查长度的原始文本

  mimeType: string,
  setWarning: (warning: string) => void, // 新增：用于设置警告信息

  customPrompt?: string
): Promise<PodcastContent> => {
  let finalBase64 = fileBase64;
  let finalMimeType = mimeType;

  // 1. 检查文本长度并进行安全截断
  if (mimeType === 'text/plain' && fileText.length > SAFETY_THRESHOLD) {
    const truncatedText = fileText.substring(0, SAFETY_THRESHOLD);
    finalBase64 = stringToBase64(truncatedText);
    setWarning(`⚠️ 注意：您上传的书籍文本过长 (${fileText.length} 字符)，已自动截取前 ${SAFETY_THRESHOLD} 字符进行处理，以避免超出免费配额限制。`);
  } else {
    setWarning(''); // 清除警告
  }

  // 2. 调用云函数
  return callGeminiFunction('generateScript', { finalBase64, finalMimeType, customPrompt: customPrompt || DEFAULT_SCRIPT_PROMPT });
};


// 修改后的 generatePodcastCover 函数
export const generatePodcastCover = async (
  bookTitle: string
): Promise<string> => {
  // 其他参数（useCleanMode, modelName）现在由云函数硬编码，不再需要从前端传递
  return callGeminiFunction('generateCover', { bookTitle });
};


// --- 以下是客户端文件处理函数，保持不变 ---

async function parseXml(zip: any, path: string) {
  const file = zip.file(path);
  if (!file) return null;
  const text = await file.async("text");
  return new DOMParser().parseFromString(text, "application/xml");
}

function resolvePath(base: string, relative: string) {
  const stack = base.split('/');
  stack.pop();
  const parts = relative.split('/');
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

export const parseEpub = async (file: File): Promise<string> => {
  const zip = await JSZip.loadAsync(file);
  const containerXml = await parseXml(zip, "META-INF/container.xml");
  if (!containerXml) throw new Error("Invalid EPUB: META-INF/container.xml missing");
  const rootFileNode = containerXml.querySelector("rootfile");
  const opfPath = rootFileNode?.getAttribute("full-path");
  if (!opfPath) throw new Error("Invalid EPUB: No rootfile in container.xml");
  const opfXml = await parseXml(zip, opfPath);
  if (!opfXml) throw new Error("Invalid EPUB: OPF file missing");
  const manifestItems = Array.from(opfXml.querySelectorAll("manifest > item"));
  const manifest: Record<string, string> = {};
  manifestItems.forEach((item: any) => {
    manifest[item.getAttribute("id")] = item.getAttribute("href");
  });
  const spineItems = Array.from(opfXml.querySelectorAll("spine > itemref"));
  let fullText = "";
  for (const item of spineItems) {
    const idref = (item as Element).getAttribute("idref");
    if (idref && manifest[idref]) {
      const relativeHref = manifest[idref];
      const absolutePath = resolvePath(opfPath, relativeHref);
      const htmlFile = zip.file(absolutePath);
      if (htmlFile) {
        const htmlContent = await htmlFile.async("text");
        const doc = new DOMParser().parseFromString(htmlContent, "text/html");
        fullText += doc.body.textContent + "\n\n";
      }
    }
  }
  if (fullText.length < 100) {
    throw new Error("EPUB text extraction failed or file is empty.");
  }
  return fullText;
};

export const fileToGenerativePart = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const stringToBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};
