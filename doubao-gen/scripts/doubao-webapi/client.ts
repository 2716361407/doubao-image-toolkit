import { chromium, BrowserContext, Page, Response } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

// ============================================================
// Helper: download an image from URL to local file
// ============================================================
function downloadFile(url: string, destPath: string, referer?: string): Promise<string | null> {
    return new Promise((resolve) => {
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const file = fs.createWriteStream(destPath);
        const urlObj = new URL(url);
        const proto = urlObj.protocol === 'https:' ? https : http;

        const options: https.RequestOptions | http.RequestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                ...(referer ? { 'Referer': referer } : {}),
            },
        };

        const req = proto.get(options, (response) => {
            // Handle redirects (common with CDN URLs)
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                file.close();
                fs.unlink(destPath, () => {});
                const redirectUrl = response.headers.location.startsWith('http')
                    ? response.headers.location
                    : `${urlObj.protocol}//${urlObj.hostname}${response.headers.location}`;
                downloadFile(redirectUrl, destPath, referer).then(resolve);
                return;
            }
            if (response.statusCode !== 200) {
                console.error(`[DoubaoClient] 下载失败 HTTP ${response.statusCode}: ${url.substring(0, 100)}...`);
                file.close();
                fs.unlink(destPath, () => {});
                resolve(null);
                return;
            }
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(destPath); });
        });
        req.on('error', (err: Error) => {
            console.error(`[DoubaoClient] 下载网络错误: ${err.message}`);
            file.close();
            fs.unlink(destPath, () => {});
            resolve(null);
        });
        req.setTimeout(30000, () => {
            console.error('[DoubaoClient] 下载超时');
            req.destroy();
            file.close();
            fs.unlink(destPath, () => {});
            resolve(null);
        });
    });
}

// ============================================================
// Helper: extract best image URL from a set of candidates
// ============================================================
function pickBestImageUrl(urls: string[], quality: 'preview' | 'original' = 'original'): string | null {
    if (urls.length === 0) return null;

    // For preview: prefer downsize/watermark (smaller file, faster download)
    // For original: prefer image_pre_watermark (highest quality)
    const scored = urls.map(url => {
        let score = 0;
        if (quality === 'original') {
            // Prefer highest quality
            if (url.includes('image_ori')) score += 1000;
            if (url.includes('image_pre_watermark')) score += 500;
            if (!url.includes('downsize')) score += 200;
            if (!url.includes('watermark')) score += 50;
        } else {
            // Prefer smaller/faster: downsize > watermark > pre_watermark
            if (url.includes('downsize_watermark') || url.includes('downsize')) score += 500;
            if (url.includes('watermark') && !url.includes('image_pre_watermark')) score += 300;
            // Penalize large files
            if (url.includes('image_pre_watermark')) score -= 200;
            if (url.includes('image_ori')) score -= 500;
        }
        if (!url.includes('~tplv-')) score += 100;
        if (url.includes('p9-flow-imagex') || url.includes('p3-flow-imagex')) score += 10;
        return { url, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].url;
}

// ============================================================
// Helper: try to derive original-quality URL from a template URL
// ============================================================
function deriveOriginalUrl(templateUrl: string): string | null {
    // URL format:
    //   base.jpeg~tplv-ACCOUNT-TEMPLATE.ext?auth_params
    // CDN requires the ~tplv-* template for auth - cannot access base URL directly.
    // Instead, try to upgrade the template itself to get higher quality.
    
    // If URL already has image_ori marker, it IS the original
    if (templateUrl.includes('image_ori')) return templateUrl;
    
    // If already using image_pre_watermark, this is the best available
    if (templateUrl.includes('image_pre_watermark')) return null;
    
    // Try upgrading from downsize_watermark to image_pre_watermark
    // "downsize_watermark_1_5_b" -> "image_pre_watermark_1_5b"
    let upgraded = templateUrl;
    if (upgraded.includes('downsize_watermark')) {
        upgraded = upgraded.replace(/downsize_watermark_\d+_\d+_[a-z]/, (match) => {
            return match.replace('downsize_watermark', 'image_pre_watermark').replace(/_([a-z])$/, '$1');
        });
        if (upgraded !== templateUrl) {
            console.log(`[DoubaoClient] 模板升级: downsize_watermark -> image_pre_watermark`);
            return upgraded;
        }
    }
    
    // Try upgrading from watermark to image_pre_watermark
    if (upgraded.includes('watermark') && !upgraded.includes('image_pre_watermark')) {
        upgraded = upgraded.replace(/watermark_\d+_\d+_[a-z]/, (match) => {
            return 'image_pre_' + match;
        });
        if (upgraded !== templateUrl) {
            return upgraded;
        }
    }
    
    return null;
}

// ============================================================
// Main Doubao Client
// ============================================================
export class DoubaoClient {
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private userDataDir: string;
    // Collect image URLs from network responses during generation
    private capturedImageUrls: string[] = [];
    private isGenerating: boolean = false;
    private sseImageUrlResolve: ((url: string | null) => void) | null = null;
    /** Derived original-quality URL (without template processing), if available */
    public derivedOriginalUrl: string | null = null;
    /** URL captured from browser download event (usually highest quality) */
    public downloadUrl: string | null = null;
    /** Current quality mode for image selection */
    private currentQuality: 'preview' | 'original' = 'original';

    constructor() {
        this.userDataDir = path.join(os.homedir(), '.doubao-web-session');
        if (!fs.existsSync(this.userDataDir)) fs.mkdirSync(this.userDataDir, { recursive: true });
    }

    // ============================================================
    // Init: launch browser, navigate, handle login
    // ============================================================
    async init(headless: boolean = false) {
        console.log(`[DoubaoClient] Initializing Playwright (headless: ${headless})...`);
        console.log(`[DoubaoClient] User data directory: ${this.userDataDir}`);

        // Determine Chrome executable - use system Chrome on Windows, default on others
        const chromePath = process.platform === 'win32'
            ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            : undefined;

        const launchArgs: string[] = [
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
        ];

        // Only add --no-sandbox on non-Windows
        if (process.platform !== 'win32') {
            launchArgs.push('--no-sandbox');
        }

        this.context = await chromium.launchPersistentContext(this.userDataDir, {
            headless,
            executablePath: chromePath,
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            args: launchArgs,
        });

        const pages = this.context.pages();
        this.page = pages.length > 0 ? pages[0] : (await this.context.newPage());
        if (!this.page) throw new Error('Failed to create page');

        // ---- Set up network monitoring ----
        this.setupNetworkMonitoring();

        console.log('[DoubaoClient] Navigating to Doubao chat...');
        await this.page.goto('https://www.doubao.com/chat/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await this.page.waitForTimeout(2000);

        const url = this.page.url();
        const title = await this.page.title();
        console.log(`[DoubaoClient-Debug] URL: ${url}`);
        console.log(`[DoubaoClient-Debug] Title: ${title}`);

        // Check login state
        const loginTextVisible = await this.page.locator('text="登录/注册"').isVisible().catch(() => false);
        const hasLoginModal = url.includes('login') || loginTextVisible;

        if (hasLoginModal) {
            console.log('\n=============================================');
            console.log('❗️ 需要登录豆包 ❗️');

            if (headless) {
                console.error('⚠️ 当前处于无头模式(Headless)，无法进行手动登录。');
                console.error('👉 请运行带 --ui 参数的命令进行首次登录。');
                console.log('=============================================\n');
                throw new Error('Login required but running in headless mode.');
            }

            console.log('请在打开的浏览器窗口中完成登录。');
            console.log('=============================================\n');

            await this.page.screenshot({ path: 'debug-login-state.png' });
            console.log('[DoubaoClient] 等待用户登录...');

            // Wait for the chat interface to appear (textarea or input-engine)
            await this.page.waitForSelector('textarea, [class*="input-engine"]', { timeout: 0 });
            console.log('[DoubaoClient] 检测到输入框，登录成功！继续执行。');
        } else {
            console.log('[DoubaoClient] 已检测到登录状态。');
        }
    }

    // ============================================================
    // Network monitoring: capture image URLs from all sources
    // ============================================================
    private setupNetworkMonitoring() {
        if (!this.page) return;

        // Monitor ALL responses for image URLs + SSE data
        this.page.on('response', async (response: Response) => {
            if (!this.isGenerating) return;

            const url = response.url();

            // Capture flow-imagex URLs (these are the generated images)
            if (url.includes('flow-imagex-sign')) {
                this.capturedImageUrls.push(url);
                console.log(`[DoubaoClient-Net] 捕获图片响应: ${url.substring(0, 120)}...`);

                // If we have an SSE resolver waiting, try to resolve with best URL
                // Resolve on first valid URL for both modes (fast path)
                // Quality upgrade happens later if better URLs arrive
                if (this.sseImageUrlResolve && this.capturedImageUrls.length > 0) {
                    const best = pickBestImageUrl(this.capturedImageUrls, this.currentQuality);
                    const resolve = this.sseImageUrlResolve;
                    this.sseImageUrlResolve = null;
                    resolve(best);
                }
            }

            // Capture SSE chat completion response body
            if (url.includes('/samantha/chat/completion') && response.status() === 200) {
                try {
                    const body = await response.text();
                    if (body && body.length > 0) {
                        console.log(`[DoubaoClient-Net] 捕获 SSE 响应体 (${body.length} 字节)`);
                        this.parseSSEBody(body);
                    }
                } catch (e) {
                    // SSE response body may not be fully available yet for streaming responses
                    console.log(`[DoubaoClient-Net] SSE 响应体暂不可用: ${e}`);
                }
            }
        });

        // Monitor browser download events (triggered by viewer download button)
        this.page.on('download', async (download) => {
            if (!this.isGenerating) return;
            const url = download.url();
            console.log(`[DoubaoClient-Net] 🎯 捕获浏览器下载事件: ${download.suggestedFilename()}`);
            console.log(`[DoubaoClient-Net] 下载 URL: ${url}`);
            this.downloadUrl = url;
            // If we have a resolver waiting, resolve with this URL
            if (this.sseImageUrlResolve) {
                const resolve = this.sseImageUrlResolve;
                this.sseImageUrlResolve = null;
                resolve(url);
            }
            // Cancel the actual browser download (we'll download manually)
            await download.cancel();
        });

    }

    // ============================================================
    // Parse SSE (Server-Sent Events) body for image URLs
    // ============================================================
    private parseSSEBody(body: string) {
        const lines = body.split('\n');
        let fullData = '';

        for (const line of lines) {
            if (line.startsWith('data:')) {
                const dataStr = line.substring(5).trim();
                if (dataStr === '[DONE]') continue;
                fullData += dataStr;

                // Try to parse individual data chunks
                try {
                    const json = JSON.parse(dataStr);
                    const imageUrls = this.extractImageUrlsFromJSON(json);
                    for (const u of imageUrls) {
                        if (!this.capturedImageUrls.includes(u)) {
                            this.capturedImageUrls.push(u);
                            console.log(`[DoubaoClient-SSE] 从 SSE 提取图片URL: ${u.substring(0, 150)}...`);
                        }
                    }
                    // Also log any image_ori related data
                    const jsonStr = JSON.stringify(json);
                    if (jsonStr.includes('image_ori')) {
                        const oriMatch = jsonStr.match(/"image_ori"\s*:\s*"([^"]+)"/);
                        if (oriMatch) {
                            const oriUrl = oriMatch[1];
                            if (!this.capturedImageUrls.includes(oriUrl)) {
                                this.capturedImageUrls.push(oriUrl);
                                console.log(`[DoubaoClient-SSE] 🎯 发现 image_ori 原图URL: ${oriUrl.substring(0, 150)}...`);
                            }
                        }
                    }
                } catch (_) {
                    // May be partial JSON, try regex on raw string
                    const urlMatches = dataStr.match(/https?:\/\/[^"'\s]*?flow-imagex[^"'\s,}"]*/g);
                    if (urlMatches) {
                        for (const u of urlMatches) {
                            if (!this.capturedImageUrls.includes(u)) {
                                this.capturedImageUrls.push(u);
                                console.log(`[DoubaoClient-SSE] 从 SSE 正则提取: ${u.substring(0, 150)}...`);
                            }
                        }
                    }
                    // Check for image_ori in raw string
                    if (dataStr.includes('image_ori')) {
                        console.log(`[DoubaoClient-SSE] ⚡ SSE 数据包含 image_ori (前200字): ${dataStr.substring(0, 200)}`);
                    }
                }
            }
        }

        // Also try parsing the complete accumulated data
        if (fullData) {
            const imageUrls = this.extractImageUrlsFromJSONString(fullData);
            for (const u of imageUrls) {
                if (!this.capturedImageUrls.includes(u)) {
                    this.capturedImageUrls.push(u);
                    console.log(`[DoubaoClient-SSE] 从完整SSE数据提取: ${u.substring(0, 150)}...`);
                }
            }
            // Search for image_ori in full accumulated data
            if (fullData.includes('image_ori')) {
                const oriMatches = fullData.match(/"image_ori"\s*:\s*"([^"]+)"/g);
                if (oriMatches) {
                    console.log(`[DoubaoClient-SSE] 🎯 完整SSE数据中发现 image_ori: ${oriMatches.join(' | ')}`);
                }
            }
        }

        // If we have URLs and a resolver is waiting, resolve
        // Resolve on first available URL, quality upgrade deferred
        if (this.capturedImageUrls.length > 0 && this.sseImageUrlResolve) {
            const best = pickBestImageUrl(this.capturedImageUrls, this.currentQuality);
            const resolve = this.sseImageUrlResolve;
            this.sseImageUrlResolve = null;
            resolve(best);
        }
    }

    // ============================================================
    // Recursively extract image URLs from a JSON object
    // ============================================================
    private extractImageUrlsFromJSON(obj: any): string[] {
        const urls: string[] = [];
        if (!obj || typeof obj !== 'object') return urls;

        const stack = [obj];
        const visited = new Set();

        while (stack.length > 0) {
            const current = stack.pop();
            if (!current || typeof current !== 'object') continue;
            if (visited.has(current)) continue;
            visited.add(current);

            for (const [key, value] of Object.entries(current)) {
                // Check for image-related keys
                if (typeof value === 'string') {
                    if (
                        (key.includes('url') || key.includes('image') || key.includes('src') || key === 'uri') &&
                        value.includes('flow-imagex')
                    ) {
                        urls.push(value);
                    } else if (value.includes('flow-imagex-sign') && value.startsWith('http')) {
                        urls.push(value);
                    }
                } else if (typeof value === 'object' && value !== null) {
                    stack.push(value);
                }
            }
        }

        return urls;
    }

    // ============================================================
    // Extract image URLs from a JSON string (handles partial/multiple JSON)
    // ============================================================
    private extractImageUrlsFromJSONString(jsonStr: string): string[] {
        const urls: string[] = [];

        // Try to find all JSON objects in the string
        const jsonMatches = jsonStr.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || [];
        for (const match of jsonMatches) {
            try {
                const obj = JSON.parse(match);
                const extracted = this.extractImageUrlsFromJSON(obj);
                urls.push(...extracted);
            } catch (_) {}
        }

        // Also try regex on the raw string for URLs
        const urlRegex = /https?:\/\/[^"'\s,}]*?flow-imagex[^"'\s,}"]*/g;
        const rawMatches = jsonStr.match(urlRegex) || [];
        for (const m of rawMatches) {
            if (!urls.includes(m)) urls.push(m);
        }

        return urls;
    }

    // ============================================================
    // Find and interact with the chat input
    // ============================================================
    private async findAndFillInput(prompt: string): Promise<boolean> {
        if (!this.page) return false;

        // Strategy 1: Find the visible textarea (not the hidden sizing helper)
        // The visible textarea usually has a placeholder attribute
        const textareas = await this.page.locator('textarea').all();
        for (const ta of textareas) {
            const visible = await ta.isVisible();
            const placeholder = await ta.getAttribute('placeholder');
            const ariaHidden = await ta.getAttribute('aria-hidden');

            if (visible && ariaHidden !== 'true') {
                console.log(`[DoubaoClient] 找到可见文本域 (placeholder: ${placeholder})`);
                await ta.click();
                await ta.fill('');
                await ta.fill(prompt);
                await this.page.waitForTimeout(300);
                return true;
            }
        }

        // Strategy 2: Try the first textarea anyway
        const firstTA = this.page.locator('textarea').first();
        const isVis = await firstTA.isVisible().catch(() => false);
        if (isVis) {
            console.log('[DoubaoClient] 使用第一个文本域');
            await firstTA.click();
            await firstTA.fill('');
            await firstTA.fill(prompt);
            await this.page.waitForTimeout(300);
            return true;
        }

        // Strategy 3: Try contenteditable div
        const editableDiv = this.page.locator('[contenteditable="true"]').first();
        if (await editableDiv.isVisible().catch(() => false)) {
            console.log('[DoubaoClient] 使用 contenteditable div');
            await editableDiv.click();
            await editableDiv.fill(prompt);
            await this.page.waitForTimeout(300);
            return true;
        }

        // Strategy 4: Click the input area first then type
        try {
            const inputArea = this.page.locator('[class*="input-engine"], [class*="inputArea"], [class*="chat-input"]').first();
            await inputArea.click();
            await this.page.waitForTimeout(500);
            await this.page.keyboard.type(prompt);
            await this.page.waitForTimeout(300);
            return true;
        } catch (_) {}

        return false;
    }

    // ============================================================
    // Send the prompt (press Enter or click send button)
    // ============================================================
    private async sendPrompt(): Promise<boolean> {
        if (!this.page) return false;

        // Try Enter key first
        try {
            await this.page.keyboard.press('Enter');
            console.log('[DoubaoClient] 已按下 Enter 发送指令');
            await this.page.waitForTimeout(1000);
            return true;
        } catch (_) {}

        // Try click send button
        try {
            const sendBtn = this.page.locator('button:has(svg), [class*="send"]').last();
            await sendBtn.click();
            console.log('[DoubaoClient] 已点击发送按钮');
            await this.page.waitForTimeout(1000);
            return true;
        } catch (_) {}

        return false;
    }

    // ============================================================
    // Main: Generate image with multiple strategies (optimized)
    // ============================================================
    async generateImage(options: {
        prompt: string;
        quality?: 'preview' | 'original';
        ratio?: string;
        timeout?: number;
    }): Promise<string | null> {
        if (!this.page) throw new Error('Client not initialized. Call init() first.');

        const { prompt, quality = 'original', ratio, timeout = 120000 } = options;
        const finalPrompt = ratio ? `${prompt}，图片比例 ${ratio}` : prompt;
        const fullInput = `帮我生成图片：${finalPrompt}`;
        console.log(`[DoubaoClient] 生图: "${finalPrompt}" (${quality})`);

        // Reset state
        this.capturedImageUrls = [];
        this.derivedOriginalUrl = null;
        this.downloadUrl = null;
        this.currentQuality = quality;
        this.isGenerating = true;

        // Promise that resolves when network monitor captures a high-quality image URL
        const ssePromise = new Promise<string | null>((resolve) => {
            this.sseImageUrlResolve = (url: string | null) => {
                if (url) resolve(url);
            };
            // Fallback: if network doesn't capture within timeout, resolve null → DOM polling
            setTimeout(() => {
                if (this.sseImageUrlResolve) {
                    this.sseImageUrlResolve = null;
                    resolve(null);
                }
            }, timeout);
        });

        try {
            // Step 1: Find input and fill prompt
            const filled = await this.findAndFillInput(fullInput);
            if (!filled) {
                console.error('[DoubaoClient] 无法找到输入框');
                this.isGenerating = false;
                return null;
            }

            // Step 2: Record existing image count before sending
            const beforeCount = await this.page.locator('img[src*="flow-imagex-sign"]').count();

            // Step 3: Send
            if (!await this.sendPrompt()) {
                console.error('[DoubaoClient] 无法发送指令');
                this.isGenerating = false;
                return null;
            }

            console.log('[DoubaoClient] 等待豆包生成...');

            // Step 4: Wait for network capture OR DOM polling
            const sseResult = await ssePromise;

            console.log(`[DoubaoClient] 捕获到图片 (${sseResult ? sseResult.substring(0, 40) + '...' : 'null'})`);
            let targetUrl: string | null = sseResult;

            if (!targetUrl) {
                console.log('[DoubaoClient] 网络未捕获，启用 DOM 轮询...');
                const pollStart = Date.now();
                let pollCount = 0;

                while (Date.now() - pollStart < timeout) {
                    const interval = (Date.now() - pollStart) < 30000 ? 1000 : 2000;
                    await this.page.waitForTimeout(interval);
                    pollCount++;

                    if (this.capturedImageUrls.length > 0) {
                        targetUrl = pickBestImageUrl(this.capturedImageUrls, this.currentQuality);
                        console.log(`[DoubaoClient] 网络捕获 (轮询 #${pollCount})`);
                        break;
                    }

                    const currentCount = await this.page.locator('img[src*="flow-imagex-sign"]').count();
                    if (currentCount > beforeCount) {
                        const lastImg = (await this.page.locator('img[src*="flow-imagex-sign"]').all()).pop()!;
                        targetUrl = await lastImg.getAttribute('src');
                        console.log(`[DoubaoClient] DOM 轮询 #${pollCount} 获取图片`);
                        break;
                    }
                }
            } else if (sseResult) {
                console.log(`[DoubaoClient] 快速捕获 (pre=${sseResult.includes('image_pre_watermark')})`);
                if (quality === 'original' && !sseResult.includes('image_pre_watermark')) {
                    console.log('[DoubaoClient] 等待高清版本...');
                    for (let i = 0; i < 15; i++) {
                        await this.page!.waitForTimeout(1000);
                        const best = pickBestImageUrl(this.capturedImageUrls, 'original');
                        if (best && best.includes('image_pre_watermark')) {
                            console.log('[DoubaoClient] ✅ 高清版本已加载');
                            targetUrl = best;
                            break;
                        }
                    }
                }
            }

            console.log(`[DoubaoClient] 关闭监控 (${this.capturedImageUrls.length} URLs)`);
            this.isGenerating = false;

            if (!targetUrl) {
                console.warn('[DoubaoClient] ⚠️ 超时未能获取图片 URL');
                await this.page.screenshot({ path: 'debug-timeout.png', fullPage: true }).catch(() => {});
                return null;
            }

            // Final quality selection
            if (quality === 'original') {
                const bestNet = pickBestImageUrl(this.capturedImageUrls, 'original');
                if (bestNet && bestNet !== targetUrl && bestNet.includes('image_pre_watermark')) {
                    console.log('[DoubaoClient] ✅ 最终选择 image_pre_watermark');
                    return bestNet;
                }
                if (!targetUrl.includes('image_pre_watermark')) {
                    const viewerResult = await this.tryViewerForBetterUrl(targetUrl);
                    if (viewerResult) return viewerResult;
                }
            }

            return targetUrl;

        } catch (error) {
            console.error('[DoubaoClient] 生图过程发生错误:', error);
            this.isGenerating = false;
            return null;
        } finally {
            this.isGenerating = false;
            this.sseImageUrlResolve = null;
        }
    }

    // ============================================================
    // Helper: try opening the image viewer to get a better URL
    // ============================================================
    private async tryViewerForBetterUrl(fallbackUrl: string): Promise<string | null> {
        if (!this.page) return null;
        
        try {
            const imgLocators = await this.page.locator('img[src*="flow-imagex-sign"]').all();
            if (imgLocators.length === 0) return null;

            const lastImg = imgLocators[imgLocators.length - 1];
            await lastImg.click({ timeout: 5000 });
            console.log('[DoubaoClient] 已打开图片查看器...');
            
            // Wait for viewer to render (reduced from 3s to 1.5s)
            await this.page.waitForTimeout(1500);

            // Quick scan for high-res images in viewer
            const viewerImgs = await this.page.locator('img[src*="flow-imagex"]').all();
            const viewerUrls: string[] = [];
            for (const img of viewerImgs) {
                const src = await img.getAttribute('src').catch(() => '');
                if (src) viewerUrls.push(src);
            }

            // Try download button (quick attempt)
            try {
                const downloadBtn = this.page.locator('text="下载"').first();
                if (await downloadBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await downloadBtn.click({ timeout: 2000 });
                    await this.page.waitForTimeout(1500);
                    if (this.downloadUrl) {
                        console.log(`[DoubaoClient] 🎯 查看器下载事件捕获: ${this.downloadUrl.substring(0, 100)}...`);
                        await this.page.keyboard.press('Escape');
                        return this.downloadUrl;
                    }
                }
            } catch (_) {}

            // Close viewer
            await this.page.keyboard.press('Escape').catch(() => {});

            // Return best viewer URL if better than fallback
            if (viewerUrls.length > 0) {
                const best = pickBestImageUrl(viewerUrls, this.currentQuality);
                if (best && best !== fallbackUrl) {
                    console.log('[DoubaoClient] 查看器获取到更优图片');
                    return best;
                }
            }
        } catch (e) {
            console.log(`[DoubaoClient] 查看器交互失败: ${e}`);
            await this.page?.keyboard.press('Escape').catch(() => {});
        }

        return null;
    }

    // ============================================================
    // Close browser
    // ============================================================
    async close() {
        if (this.context) {
            await this.context.close();
            console.log('[DoubaoClient] 浏览器已关闭。');
        }
    }

    // ============================================================
    // Static: download image from URL
    // ============================================================
    static async downloadImage(url: string, destPath: string): Promise<string | null> {
        console.log(`[DoubaoClient] 下载图片: ${destPath}`);
        return downloadFile(url, destPath);
    }
}
