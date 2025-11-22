import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  UploadCloud, 
  Mic2, 
  Image as ImageIcon, 
  Share2, 
  Download, 
  FileText, 
  AlertCircle, 
  ExternalLink, 
  FileIcon,
  Loader2,
  CheckCircle2,
  Maximize2,
  X,
  History,
  Type as TypeIcon,
  Palette,
  RefreshCw,
  Settings2,
  Edit3,
  MoveVertical,
  Coffee,
  Quote
} from 'lucide-react';
import StepCard from './components/StepCard';
import Button from './components/Button';
import { WorkflowState, StepStatus, HistoryItem, PodcastContent } from './types';
import { 
  generatePodcastScript, 
  generatePodcastCover, 
  fileToGenerativePart, 
  parseEpub, 
  stringToBase64,
  DEFAULT_SCRIPT_PROMPT
} from './services/geminiService';

interface TextOverlayConfig {
  podcastTitle: string;
  mainText: string;
  color: 'white' | 'black' | 'orange';
}

const App: React.FC = () => {
  const [state, setState] = useState<WorkflowState>({
    currentStep: 1,
    bookFile: null,
    bookFileBase64: null,
    bookMimeType: null,
    contentStatus: StepStatus.IDLE,
    generatedContent: null,
    coverStatus: StepStatus.IDLE,
    generatedCover: null,
    error: null,
  });

  const [scriptPrompt, setScriptPrompt] = useState(DEFAULT_SCRIPT_PROMPT);
  const [isParsing, setIsParsing] = useState(false);
  const [safetyWarning, setSafetyWarning] = useState(''); // 新增：安全截断警告状态
  
  // New States for History and Full Screen
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [fullScreenContent, setFullScreenContent] = useState<{title: string, text: string} | null>(null);
  
  // Cover configuration - Locked values as per request
  const coverStyle = 'clean';
  const imageModel = 'gemini-2.5-flash-image';

  // Cover Editor State
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [textConfig, setTextConfig] = useState<TextOverlayConfig>({
    podcastTitle: 'NOTHING IMPOSSIBLE',
    mainText: '',
    color: 'white',
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Store the original AI generated image separate from the edited version
  const [originalImageBase64, setOriginalImageBase64] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('podcast_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const saveToHistory = (content: PodcastContent, bookName: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      bookName: bookName,
      content: content
    };
    const newHistory = [newItem, ...history];
    setHistory(newHistory);
    localStorage.setItem('podcast_history', JSON.stringify(newHistory));
  };

  // Updated: Allow free navigation to any step
  const handleStepClick = (step: number) => {
    setState(prev => ({ ...prev, currentStep: step }));
  };

  const getBookName = () => {
    if (state.bookFile) {
      // Remove file extension for cleaner display
      return state.bookFile.name.replace(/\.[^/.]+$/, "");
    }
    return state.generatedContent?.title || "Book Name";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Basic validation
      if (file.size > 50 * 1024 * 1024) {
        setState(prev => ({ ...prev, error: "文件大小不能超过 50MB" }));
        return;
      }

      setIsParsing(true);
      setState(prev => ({ ...prev, error: null }));

      try {
        let base64 = '';
        let mimeType = '';

        let textContent = '';
        if (file.name.toLowerCase().endsWith('.epub')) {
          // Extract text from EPUB
          textContent = await parseEpub(file);
          // Convert extracted text to base64 for the API
          base64 = stringToBase64(textContent);
          mimeType = 'text/plain';
        } else {
          // Handle PDF
          base64 = await fileToGenerativePart(file);
          mimeType = file.type;
        }
        
        // 存储原始文本内容，用于安全截断
        const bookText = textContent || '';
        
        setState(prev => ({
          ...prev,
          bookFile: file,
          bookFileBase64: base64,
          bookMimeType: mimeType,
          bookText: bookText, // 新增：存储原始文本
          error: null,
          // currentStep: 2 // Keep current step, don't force jump
        }));
      } catch (err) {
        console.error(err);
        setState(prev => ({ ...prev, error: "文件读取失败：如果是 EPUB 文件，请确保文件未损坏。" }));
      } finally {
        setIsParsing(false);
      }
    }
  };

  const handleGenerateScript = async () => {
    if (!state.bookFileBase64 || !state.bookMimeType) return;

    setState(prev => ({ ...prev, contentStatus: StepStatus.LOADING, error: null }));
    
    try {
      const content = await generatePodcastScript(
        state.bookFileBase64, 
        state.bookText, // 传入原始文本
        state.bookMimeType, 
        setSafetyWarning, // 传入设置警告的函数
        scriptPrompt
      );
      
      // Save to history automatically
      if (state.bookFile) {
        saveToHistory(content, state.bookFile.name);
      }

      setState(prev => ({
        ...prev,
        generatedContent: content,
        contentStatus: StepStatus.SUCCESS,
        // No auto advance
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        contentStatus: StepStatus.ERROR, 
        error: "文稿生成失败，请检查 API Key 是否有效。" 
      }));
    }
  };

  const handleGenerateCover = async () => {
    // We rely on the book file name primarily
    const bookName = getBookName();
    if (!bookName) return;

    setState(prev => ({ ...prev, coverStatus: StepStatus.LOADING, error: null }));
    setIsEditingCover(false); // Reset edit mode

    try {
      const imageUrl = await generatePodcastCover(
        bookName,
        true, // Always use clean mode
        imageModel
      );
      
      setOriginalImageBase64(imageUrl);
      
      // Initialize text config with Book Name from file
      setTextConfig({
        podcastTitle: 'NOTHING IMPOSSIBLE',
        mainText: bookName,
        color: 'white'
      });

      setState(prev => ({
        ...prev,
        generatedCover: { url: imageUrl, base64: imageUrl },
        coverStatus: StepStatus.SUCCESS,
        // No auto advance
      }));
    } catch (error: any) {
      console.error("Generate Cover Error", error);
      
      setState(prev => ({ 
        ...prev, 
        coverStatus: StepStatus.ERROR, 
        error: "封面生成失败，请重试。" 
      }));
    }
  };

  // Canvas Drawing Effect
  useEffect(() => {
    if (isEditingCover && originalImageBase64 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Set canvas size to match image (square)
        canvas.width = 1024;
        canvas.height = 1024;
        
        // Draw original image
        ctx?.drawImage(img, 0, 0, 1024, 1024);
        
        if (ctx) {
          // Common Shadows
          ctx.shadowColor = textConfig.color === 'black' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = 20;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;
          
          const colorMap = { 
            white: '#FFFFFF', 
            black: '#0c0a09', 
            orange: '#f97316' 
          };
          ctx.fillStyle = colorMap[textConfig.color];
          ctx.textAlign = 'center';

          // 1. Draw Podcast Title (Top, Sans-serif, Spaced)
          if (textConfig.podcastTitle) {
            ctx.font = 'bold 50px "Inter", sans-serif';
            // Add letter spacing
            const titleUpper = textConfig.podcastTitle.toUpperCase();
            const spacedTitle = titleUpper.split('').join('  ');
            ctx.fillText(spacedTitle, 512, 120);
            
            // Add a small separator line
            ctx.lineWidth = 2;
            ctx.strokeStyle = colorMap[textConfig.color];
            ctx.beginPath();
            ctx.moveTo(412, 150);
            ctx.lineTo(612, 150);
            ctx.stroke();
          }

          // 2. Draw Book Name (Center, Serif, Large)
          if (textConfig.mainText) {
             const fontSize = 110;
             ctx.font = `bold ${fontSize}px "Noto Serif SC", serif`;
             ctx.textBaseline = 'middle';
             
             // Text Wrapping Logic
             const maxWidth = 900;
             const lineHeight = fontSize * 1.4;
             const words = textConfig.mainText.split('');
             let line = '';
             const lines = [];

             for (let n = 0; n < words.length; n++) {
               const testLine = line + words[n];
               const metrics = ctx.measureText(testLine);
               if (metrics.width > maxWidth && n > 0) {
                 lines.push(line);
                 line = words[n];
               } else {
                 line = testLine;
               }
             }
             lines.push(line);

             // Calculate vertical center based on number of lines
             const totalHeight = lines.length * lineHeight;
             const startY = 512 - (totalHeight / 2) + (lineHeight / 2);

             lines.forEach((l, i) => {
               ctx.fillText(l, 512, startY + (i * lineHeight));
             });
          }
        }
      };
      
      img.src = originalImageBase64;
    }
  }, [isEditingCover, originalImageBase64, textConfig]);

  const handleSaveEditedCover = () => {
    if (canvasRef.current) {
      const newBase64 = canvasRef.current.toDataURL('image/png');
      setState(prev => ({
        ...prev,
        generatedCover: { url: newBase64, base64: newBase64 }
      }));
      setIsEditingCover(false);
    }
  };

  const downloadText = (text: string, filename: string) => {
    const element = document.createElement("a");
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setState(prev => ({
      ...prev,
      generatedContent: item.content,
      contentStatus: StepStatus.SUCCESS,
      currentStep: 3, // Go to script step
      error: null,
      generatedCover: null, // Reset cover as it doesn't match history yet
      coverStatus: StepStatus.IDLE
    }));
    setShowHistory(false);
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem('podcast_history', JSON.stringify(newHistory));
  };

  // --- RENDERERS ---

  return (
    // Warm Background Color: Soft Rice Paper / Warm Cream
    <div className="min-h-screen bg-[#FDFCF8] pb-20 text-[#4A4036] font-sans">
      
      {/* Full Screen Modal */}
      {fullScreenContent && (
        <div className="fixed inset-0 z-50 bg-[#FDFCF8] flex flex-col animate-fadeIn">
          <div className="bg-[#2C241B] text-[#EBE5DE] p-4 flex justify-between items-center shadow-md">
            <h2 className="text-lg font-bold font-serif tracking-wide">{fullScreenContent.title}</h2>
            <button 
              onClick={() => setFullScreenContent(null)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-grow overflow-y-auto p-8 max-w-3xl mx-auto w-full">
            <div className="prose prose-lg prose-stone prose-headings:font-serif max-w-none">
              <pre className="whitespace-pre-wrap font-serif text-lg leading-loose text-[#4A4036] bg-transparent border-none p-0">
                {fullScreenContent.text}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* History Modal/Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-40 bg-[#2C241B]/60 flex justify-end backdrop-blur-sm" onClick={() => setShowHistory(false)}>
          <div className="w-full max-w-md bg-[#FDFCF8] h-full shadow-2xl p-6 overflow-y-auto animate-fadeIn border-l border-[#EBE5DE]" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-serif font-bold text-[#2C241B]">往期节目</h2>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-[#8C7E72]" />
                </button>
             </div>
             {history.length === 0 ? (
               <div className="text-center mt-20 text-[#8C7E72]">
                 <Coffee className="w-12 h-12 mx-auto mb-4 opacity-50" />
                 <p>这里还空空如也<br/>去创作你的第一个故事吧</p>
               </div>
             ) : (
               <div className="space-y-4">
                 {history.map(item => (
                   <div 
                    key={item.id} 
                    className="border border-[#EBE5DE] rounded-xl p-5 hover:border-orange-300 hover:bg-orange-50/30 cursor-pointer group relative transition-all shadow-sm"
                    onClick={() => loadFromHistory(item)}
                   >
                     <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-serif font-bold text-lg text-[#2C241B] line-clamp-1">{item.content.title}</h3>
                          <p className="text-sm text-[#8C7E72] mt-1 font-medium">
                            Book: {item.bookName}
                          </p>
                          <p className="text-xs text-[#B0A69C] mt-2">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => deleteHistoryItem(e, item.id)}
                          className="text-[#D6CEC5] hover:text-red-400 p-2 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      )}

      {/* Warm, Creative Header */}
      <header className="bg-[#2C241B] text-[#EBE5DE] pt-12 pb-16 px-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')] opacity-10 pointer-events-none"></div>
        <div className="max-w-3xl mx-auto relative z-10">
          
          {/* Top Bar */}
          <div className="flex justify-between items-center mb-12">
             <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity cursor-default">
                <div className="w-10 h-10 rounded-full bg-orange-600/20 flex items-center justify-center text-orange-500">
                  <Mic2 className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium tracking-widest uppercase text-orange-100/60">Podcast Workshop</span>
             </div>
             <button 
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 text-[#EBE5DE]/70 hover:text-white transition-colors text-sm border border-[#EBE5DE]/20 px-4 py-2 rounded-full hover:bg-[#EBE5DE]/10"
            >
              <History className="w-3 h-3" />
              <span>历史记录</span>
            </button>
          </div>

          {/* Content */}
          <div className="text-center space-y-8">
            <div>
              <h1 className="text-5xl font-serif font-bold text-white mb-2 tracking-tight">Nothing Impossible</h1>
              <p className="text-orange-200/80 font-medium text-lg">刘土皮的读书 · 情感播客</p>
            </div>

            <div className="max-w-xl mx-auto relative py-6">
               <Quote className="w-8 h-8 text-orange-500/20 absolute -top-2 -left-4 transform -scale-x-100" />
               <div className="space-y-4 font-serif text-[#EBE5DE]/90 leading-relaxed text-lg">
                  <p>在这里，我们用温柔的声音，<br/>讲述那些关于思想、爱与时间的故事。</p>
                  <p className="text-base text-[#EBE5DE]/70 italic pt-2">
                    有时是一本文学经典，有时是一部科幻哲学，<br/>它们共同指向一个问题：<br/>——在不断变化的世界里，我们该如何理解自己？
                  </p>
               </div>
               <Quote className="w-8 h-8 text-orange-500/20 absolute -bottom-2 -right-4" />
            </div>

            <div className="inline-block px-6 py-2 border-t border-b border-orange-500/30 text-sm text-orange-100/60 tracking-widest uppercase">
              在宇宙的尽头，在日常的缝隙，总有一束光
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-10 relative z-20">
        
        {/* Step 1: Resource */}
        <StepCard
          stepNumber={1}
          title="寻书 · 遇见故事"
          description="前往读书派，寻找触动心弦的文字"
          icon={BookOpen}
          isActive={state.currentStep === 1}
          isCompleted={!!state.bookFile}
          onClick={() => handleStepClick(1)}
        >
          <div className="space-y-4">
            <p className="text-[#4A4036] leading-relaxed">
              一切始于阅读。请前往 <strong>读书派</strong> 获取 EPUB 或 PDF 格式的电子书。<br/>
              <span className="text-sm text-[#8C7E72]">好的故事，值得被声音记录。</span>
            </p>
            
            <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 flex-shrink-0"></div>
              <div className="text-sm text-[#8C7E72]">
                <strong className="text-orange-800 block mb-1">温馨提示</strong>
                 系统已支持直接解析 EPUB 格式，自动提取精华内容。无需手动转换，让创作更简单。
              </div>
            </div>

            <div className="pt-2">
              <a 
                href="https://www.dushupai.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Button variant="secondary">
                  <ExternalLink className="w-4 h-4" />
                  前往读书派 (Dushupai)
                </Button>
              </a>
            </div>
          </div>
        </StepCard>

        {/* Step 2: Upload */}
        <StepCard
          stepNumber={2}
          title="上传 · 开启旅程"
          description="将书籍文件交付给 Gemini"
          icon={UploadCloud}
          isActive={state.currentStep === 2}
          isCompleted={!!state.bookFileBase64}
          onClick={() => handleStepClick(2)}
        >
          <div className="space-y-6">
            <div className="border-2 border-dashed border-[#D6CEC5] rounded-2xl p-10 text-center bg-[#FAF9F6] hover:bg-white hover:border-orange-300 transition-all duration-300 relative group cursor-pointer">
              <input 
                type="file" 
                accept=".pdf,.epub" 
                onChange={handleFileChange}
                disabled={isParsing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
              />
              <div className="pointer-events-none relative z-0 transition-transform group-hover:scale-105 duration-300">
                {isParsing ? (
                   <div className="flex flex-col items-center text-orange-600">
                     <Loader2 className="w-12 h-12 mb-4 animate-spin opacity-80" />
                     <p className="font-serif font-bold text-lg">正在翻阅书页...</p>
                     <p className="text-sm mt-2 opacity-70">提取文字精华中，请稍候</p>
                   </div>
                ) : state.bookFile ? (
                  <div className="flex flex-col items-center text-[#4A4036]">
                    <div className="w-16 h-16 bg-[#EBE5DE] rounded-2xl flex items-center justify-center mb-4 text-[#8C7E72]">
                       <BookOpen className="w-8 h-8" />
                    </div>
                    <p className="font-serif font-bold text-xl mb-1">{state.bookFile.name}</p>
                    <p className="text-xs text-[#8C7E72] uppercase tracking-wide">
                      {(state.bookFile.size / 1024 / 1024).toFixed(2)} MB · 已就绪
                    </p>
                    {state.bookMimeType === 'text/plain' && (
                      <span className="mt-3 px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                        EPUB 解析成功
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-[#8C7E72]">
                    <UploadCloud className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-serif font-bold text-lg text-[#4A4036]">点击上传电子书</p>
                    <p className="text-sm mt-2 opacity-60">支持 PDF 或 EPUB 格式</p>
                  </div>
                )}
              </div>
            </div>
            
            {state.error && (
              <div className="text-red-600 bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{state.error}</span>
              </div>
            )}

            <div className="flex justify-end">
              <Button 
                variant="outline"
                disabled={!state.bookFileBase64 || isParsing} 
                onClick={() => handleStepClick(3)}
              >
                下一步：生成文稿
              </Button>
            </div>
          </div>
        </StepCard>

        {/* Step 3: Script Generation */}
        <StepCard
          stepNumber={3}
          title="创作 · 思想流淌"
          description="AI 深度阅读，生成充满情感的播客文稿"
          icon={Mic2}
          isActive={state.currentStep === 3}
          isCompleted={state.contentStatus === StepStatus.SUCCESS}
          onClick={() => handleStepClick(3)}
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-[#4A4036] font-serif flex justify-between items-center">
                <span>给 AI 的创作指令 (Prompt)</span>
                <span className="text-xs font-sans font-normal text-[#8C7E72] bg-[#EBE5DE] px-2 py-0.5 rounded-full">可自由编辑</span>
              </label>
              <textarea 
                className="w-full h-40 p-4 border border-[#D6CEC5] rounded-2xl bg-[#FAF9F6] text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-300 text-[#4A4036] leading-relaxed outline-none resize-none transition-shadow"
                value={scriptPrompt}
                onChange={(e) => setScriptPrompt(e.target.value)}
              />
            </div>

            {state.contentStatus === StepStatus.LOADING && (
              <div className="flex flex-col items-center justify-center py-10 text-[#8C7E72] bg-[#FAF9F6] rounded-2xl">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-orange-400" />
                <p className="font-serif">Gemini 正在静心阅读并撰写文稿...</p>
              </div>
            )}

            {state.contentStatus === StepStatus.ERROR && (
              <div className="text-red-600 bg-red-50 p-4 rounded-2xl border border-red-100">
                <p className="font-bold mb-1">生成遇到了一点问题</p>
                <p className="text-sm opacity-80 mb-3">{state.error}</p>
                <Button variant="outline" onClick={handleGenerateScript} className="bg-white">重试</Button>
              </div>
            )}

            {state.contentStatus === StepStatus.SUCCESS && state.generatedContent && (
              <div className="space-y-4 animate-fadeIn mt-2">
                {/* Title Card */}
                <div className="border-l-4 border-orange-400 pl-5 py-3 bg-white shadow-sm rounded-r-xl">
                  <h3 className="text-2xl font-serif font-bold text-[#2C241B]">{state.generatedContent.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">AI Generated</span>
                    <span className="text-xs text-[#8C7E72]">已自动归档至历史记录</span>
                  </div>
                </div>
                
                {/* Show Notes Preview */}
                <div className="bg-white p-5 rounded-2xl border border-[#EBE5DE] relative group shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                   <div className="flex justify-between items-center mb-3">
                     <strong className="text-[#4A4036] font-serif flex items-center gap-2"><FileText className="w-4 h-4 text-orange-400"/> 简介 (Show Notes)</strong>
                     <button 
                      onClick={() => setFullScreenContent({ title: '简介 (Show Notes)', text: state.generatedContent!.intro })}
                      className="p-1.5 text-[#8C7E72] hover:text-[#2C241B] hover:bg-[#FAF9F6] rounded-full transition-colors"
                      title="全屏阅读"
                     >
                       <Maximize2 className="w-4 h-4" />
                     </button>
                   </div>
                   <div className="max-h-32 overflow-hidden text-[#4A4036] text-sm leading-relaxed relative">
                     {state.generatedContent.intro}
                     <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-white to-transparent"></div>
                   </div>
                </div>

                {/* Script Preview */}
                <div className="bg-white p-5 rounded-2xl border border-[#EBE5DE] relative group shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                   <div className="flex justify-between items-center mb-3">
                     <strong className="text-[#4A4036] font-serif flex items-center gap-2"><Mic2 className="w-4 h-4 text-orange-400"/> 播客文稿 (Script)</strong>
                     <button 
                      onClick={() => setFullScreenContent({ title: '播客文稿 (Script)', text: state.generatedContent!.script })}
                      className="p-1.5 text-[#8C7E72] hover:text-[#2C241B] hover:bg-[#FAF9F6] rounded-full transition-colors"
                      title="全屏阅读"
                     >
                       <Maximize2 className="w-4 h-4" />
                     </button>
                   </div>
                   <div className="max-h-48 overflow-hidden text-[#4A4036] font-serif leading-loose relative">
                     {state.generatedContent.script}
                     <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-white to-transparent"></div>
                   </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button variant="outline" onClick={() => downloadText(state.generatedContent!.script, 'podcast-script.txt')}>
                    <Download className="w-4 h-4" /> 下载文稿
                  </Button>
                  <Button variant="outline" onClick={() => downloadText(state.generatedContent!.intro, 'shownotes.txt')}>
                    <Download className="w-4 h-4" /> 下载简介
                  </Button>
                </div>
              </div>
            )}

            {state.contentStatus === StepStatus.IDLE && (
              <Button onClick={handleGenerateScript} className="w-full py-4 shadow-lg shadow-orange-200/50 mt-2">
                开始生成文稿
              </Button>
            )}
            
            {state.contentStatus === StepStatus.SUCCESS && (
               <div className="flex justify-between mt-8 pt-6 border-t border-[#EBE5DE]">
                 <Button variant="outline" onClick={handleGenerateScript} className="text-[#8C7E72] border-transparent hover:bg-[#FAF9F6]">
                   <RefreshCw className="w-4 h-4" /> 不满意？重写
                 </Button>
                 <Button onClick={() => handleStepClick(4)}>
                   下一步：制作封面
                 </Button>
               </div>
            )}
          </div>
        </StepCard>

        {/* Step 4: Cover Art */}
        <StepCard
          stepNumber={4}
          title="视觉 · 艺术封面"
          description="为声音赋予色彩，书名自动排版"
          icon={ImageIcon}
          isActive={state.currentStep === 4}
          isCompleted={state.coverStatus === StepStatus.SUCCESS}
          onClick={() => handleStepClick(4)}
        >
          <div className="space-y-4">
             
             {!isEditingCover ? (
               /* Normal View */
               <>
                 {/* Simplified Config - Just info */}
                 <div className="bg-[#FAF9F6] px-5 py-3 rounded-full border border-[#EBE5DE] inline-flex items-center gap-2 text-sm text-[#8C7E72]">
                     <div className="w-2 h-2 rounded-full bg-green-500"></div>
                     <span>当前模式：Gemini 2.5 Flash (纯艺术) + 智能排版</span>
                 </div>
                
                {/* Error Message */}
                {state.coverStatus === StepStatus.ERROR && (
                   <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3 text-red-800 animate-fadeIn">
                     <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                     <div className="flex-grow">
                       <p className="font-bold text-sm">封面生成失败</p>
                       <p className="text-sm mt-1 opacity-80">{state.error}</p>
                       <div className="mt-3">
                          <Button variant="outline" size="sm" className="h-8 text-xs bg-white" onClick={handleGenerateCover}>
                              重试
                          </Button>
                       </div>
                     </div>
                   </div>
                )}

                 {state.coverStatus === StepStatus.LOADING && (
                  <div className="flex flex-col items-center justify-center py-12 text-[#8C7E72] bg-[#FAF9F6] rounded-3xl">
                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-orange-400" />
                    <p className="font-serif text-lg">正在构思画面...</p>
                    <p className="text-sm opacity-60 mt-1">AI 正在绘制艺术底图</p>
                  </div>
                )}

                {state.coverStatus === StepStatus.SUCCESS && state.generatedCover && (
                  <div className="flex flex-col items-center space-y-6 animate-fadeIn mt-4">
                    <div className="relative group shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] rounded-xl overflow-hidden transition-transform duration-500 hover:scale-[1.02]">
                      <img 
                        src={state.generatedCover.url} 
                        alt="Podcast Cover" 
                        className="w-full max-w-sm aspect-square object-cover"
                      />
                      <div className="absolute inset-0 bg-[#2C241B]/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                        <Button onClick={() => setIsEditingCover(true)} className="bg-white text-[#2C241B] hover:bg-orange-50">
                          <Edit3 className="w-4 h-4" /> 调整文字排版
                        </Button>
                        <Button variant="secondary" onClick={() => downloadImage(state.generatedCover!.url, 'cover.png')} className="bg-orange-500 text-white border-none hover:bg-orange-600">
                          <Download className="w-4 h-4" /> 保存图片
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-[#8C7E72] flex items-center gap-1 bg-[#FAF9F6] px-3 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      完美适配小宇宙 & 喜马拉雅 (1:1)
                    </p>
                  </div>
                )}
              </>
             ) : (
               /* Editor View - Deep Coffee Theme */
               <div className="bg-[#2C241B] p-6 rounded-3xl text-[#EBE5DE] animate-fadeIn shadow-2xl">
                 <div className="flex justify-between items-center mb-6 border-b border-[#EBE5DE]/10 pb-4">
                    <h3 className="font-bold font-serif text-xl flex items-center gap-2 text-white">
                      <Edit3 className="w-5 h-5 text-orange-500" /> 封面排版
                    </h3>
                    <button onClick={() => setIsEditingCover(false)} className="text-[#8C7E72] hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                      <X className="w-5 h-5"/>
                    </button>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Canvas Preview */}
                    <div className="aspect-square bg-black/30 rounded-xl overflow-hidden border border-[#EBE5DE]/10 flex items-center justify-center shadow-inner">
                      <canvas 
                        ref={canvasRef} 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    
                    {/* Controls */}
                    <div className="space-y-8 py-2">
                      {/* Podcast Title Input */}
                      <div className="space-y-3">
                        <label className="text-xs text-orange-200/60 uppercase font-bold tracking-widest flex items-center justify-between">
                          <span>顶部小字 (Podcast Name)</span>
                          <span className="text-[10px] bg-[#EBE5DE]/10 px-2 py-0.5 rounded text-[#EBE5DE]/50">Sans-serif</span>
                        </label>
                        <input 
                          type="text" 
                          value={textConfig.podcastTitle}
                          onChange={(e) => setTextConfig({...textConfig, podcastTitle: e.target.value})}
                          className="w-full bg-[#EBE5DE]/5 border border-[#EBE5DE]/10 rounded-lg p-4 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none font-sans tracking-widest text-sm transition-all"
                          placeholder="NOTHING IMPOSSIBLE"
                        />
                      </div>

                      {/* Main Title Input */}
                      <div className="space-y-3">
                        <label className="text-xs text-orange-200/60 uppercase font-bold tracking-widest flex items-center justify-between">
                           <span>中部大字 (Book Title)</span>
                           <span className="text-[10px] bg-[#EBE5DE]/10 px-2 py-0.5 rounded text-[#EBE5DE]/50">Serif Display</span>
                        </label>
                        <textarea 
                          value={textConfig.mainText}
                          onChange={(e) => setTextConfig({...textConfig, mainText: e.target.value})}
                          className="w-full bg-[#EBE5DE]/5 border border-[#EBE5DE]/10 rounded-lg p-4 text-white focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none font-serif text-xl h-28 resize-none transition-all"
                          placeholder="输入书名..."
                        />
                        <p className="text-xs text-[#8C7E72] italic">* 默认读取文件名，可手动修改</p>
                      </div>

                      {/* Color Selection */}
                      <div className="space-y-3">
                        <label className="text-xs text-orange-200/60 uppercase font-bold tracking-widest flex items-center gap-2">
                          <Palette className="w-3 h-3"/> 文字配色
                        </label>
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setTextConfig({...textConfig, color: 'white'})}
                            className={`w-12 h-12 rounded-full bg-white shadow-lg transform transition-transform active:scale-95 ${textConfig.color === 'white' ? 'ring-4 ring-orange-500/50 scale-110' : 'opacity-70 hover:opacity-100'}`}
                            title="白色"
                          />
                          <button 
                            onClick={() => setTextConfig({...textConfig, color: 'black'})}
                            className={`w-12 h-12 rounded-full bg-[#0c0a09] border border-[#EBE5DE]/20 shadow-lg transform transition-transform active:scale-95 ${textConfig.color === 'black' ? 'ring-4 ring-orange-500/50 scale-110' : 'opacity-70 hover:opacity-100'}`}
                            title="黑色"
                          />
                          <button 
                            onClick={() => setTextConfig({...textConfig, color: 'orange'})}
                            className={`w-12 h-12 rounded-full bg-orange-500 shadow-lg transform transition-transform active:scale-95 ${textConfig.color === 'orange' ? 'ring-4 ring-white/50 scale-110' : 'opacity-70 hover:opacity-100'}`}
                            title="橙色"
                          />
                        </div>
                      </div>

                      <div className="pt-6 border-t border-[#EBE5DE]/10">
                        <Button onClick={handleSaveEditedCover} className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white border-none font-bold tracking-wide">
                           <CheckCircle2 className="w-5 h-5"/> 完成排版
                        </Button>
                      </div>
                    </div>
                 </div>
               </div>
             )}

            {state.coverStatus === StepStatus.IDLE && !isEditingCover && (
              <Button onClick={handleGenerateCover} className="w-full py-4 text-lg shadow-lg shadow-orange-200/50">
                开始设计封面
              </Button>
            )}

            {state.coverStatus === StepStatus.SUCCESS && !isEditingCover && (
               <div className="flex justify-between mt-8 pt-6 border-t border-[#EBE5DE]">
                 <Button variant="outline" onClick={handleGenerateCover} className="text-[#8C7E72] border-transparent hover:bg-[#FAF9F6]">
                   <RefreshCw className="w-4 h-4" /> 重新生成底图
                 </Button>
                 <Button onClick={() => handleStepClick(5)}>
                   下一步：发布
                 </Button>
               </div>
            )}
          </div>
        </StepCard>

        {/* Step 5: Publish */}
        <StepCard
          stepNumber={5}
          title="发布 · 传递声音"
          description="将你的思想上传至云端，与世界连接"
          icon={Share2}
          isActive={state.currentStep === 5}
          isCompleted={false}
          onClick={() => handleStepClick(5)}
        >
          <div className="space-y-8">
            <div className="bg-green-50/50 border border-green-100 rounded-2xl p-6 text-green-800 flex gap-4 items-center">
               <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-green-600">
                 <CheckCircle2 className="w-6 h-6" />
               </div>
               <div>
                  <h4 className="font-serif font-bold text-lg">工作流圆满完成</h4>
                  <p className="text-sm mt-1 opacity-80">
                    文稿已备好，封面已设计。现在，请带上耳机，开始录制属于你的声音吧。
                  </p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <a 
                href="https://podcaster.xiaoyuzhoufm.com/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="border border-[#EBE5DE] bg-white rounded-3xl p-8 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-100/50 transition-all duration-300 h-full flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-[#F0F9FF] mb-6 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform duration-300">
                    🪐
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-[#2C241B]">小宇宙创作中心</h3>
                  <p className="text-[#8C7E72] text-sm">Nothing Impossible, Start here.</p>
                </div>
              </a>

              <a 
                href="https://studio.ximalaya.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="border border-[#EBE5DE] bg-white rounded-3xl p-8 hover:border-red-200 hover:shadow-xl hover:shadow-red-100/50 transition-all duration-300 h-full flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-[#FFF1F0] mb-6 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform duration-300">
                    🏔️
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-[#2C241B]">喜马拉雅创作中心</h3>
                  <p className="text-[#8C7E72] text-sm">让声音传得更远</p>
                </div>
              </a>
            </div>
          </div>
        </StepCard>
      </main>
      
      <footer className="text-center py-10 text-[#8C7E72] text-sm">
        <p className="font-serif italic opacity-60">Nothing impossible. Created with Gemini & Love.</p>
      </footer>
    </div>
  );
};

export default App;