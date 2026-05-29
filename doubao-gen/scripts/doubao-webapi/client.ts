import { chromium, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as https from 'https';

export class DoubaoClient {
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    get browserContext(): BrowserContext | null { return this.context; }
    private userDataDir: string;

    constructor() {
        this.userDataDir = path.join(os.homedir(), '.doubao-web-session');
        if (!fs.existsSync(this.userDataDir)) {
            fs.mkdirSync(this.userDataDir, { recursive: true });
        }
    }

    async init(headless: boolean = false) {
        console.log(`[DoubaoClient] Initializing Playwright (headless: ${headless})...`);
        console.log(`[DoubaoClient] User data directory: ${this.userDataDir}`);

        this.context = await chromium.launchPersistentContext(this.userDataDir, {
            headless,
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            timeout: 60000,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--disable-extensions',
                '--disable-sync',
                '--no-first-run',
                '--disable-default-apps',
                '--disable-background-networking',
                '--disable-component-update',
            ],
        });

        const pages = this.context.pages();
        this.page = pages.length > 0 ? pages[0] : (await this.context.newPage());

        console.log('[DoubaoClient] Navigating to Doubao chat...');
        if (!this.page) throw new Error("Failed to create page");
        await this.page.goto('https://www.doubao.com/chat/', { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(3000);

        const url = this.page.url();
        const title = await this.page.title();
        console.log(`[DoubaoClient-Debug] 当前页面 URL: ${url}`);
        console.log(`[DoubaoClient-Debug] 当前页面 Title: ${title}`);

        const loginTextVisible = await this.page.locator('text="登录/注册"').isVisible().catch(() => false);
        const hasLoginModal = url.includes('login') || loginTextVisible;

        if (hasLoginModal) {
            console.log('\n❗️ 需要登录豆包 ❗️');
            if (headless) {
                console.error('⚠️ 当前处于无头模式，请用 --ui 参数首次登录');
                throw new Error("Login required but running in headless mode.");
            }
            console.log('请在浏览器窗口中完成登录...');
            await this.page.screenshot({ path: 'debug-login-state.png' });
            await this.page.waitForSelector('textarea', { timeout: 0 });
            console.log('[DoubaoClient] 登录成功！');
        } else {
            console.log('[DoubaoClient] 已检测到登录状态。');
        }
    }

    async generateImage(options: {
        prompt: string;
        quality?: 'preview' | 'original';
        ratio?: string;
        timeout?: number;
    }): Promise<string[]> {
        if (!this.page) throw new Error('Client not initialized. Call init() first.');

        const { prompt, ratio, timeout = 60000 } = options;

        console.log(`[DoubaoClient] 生图请求: ${prompt}${ratio ? ` (比例 ${ratio})` : ''}`);

        try {
            // 点击"图像生成"模式选项卡（豆包新版UI需要先切换模式）
            const imgGenBtn = this.page.locator('text="图像生成"').first();
            if (await imgGenBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await imgGenBtn.click();
                console.log('[DoubaoClient] 已切换到"图像生成"模式');
                await this.page.waitForTimeout(1500);
            }

            // 点击比例下拉按钮 → 展开菜单 → 选择对应比例
            if (ratio) {
                // 点击"比例"下拉按钮（aria-haspopup="menu"）
                const ratioTrigger = this.page.locator('button:has(span:text("比例"))').first();
                if (await ratioTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await ratioTrigger.click();
                    console.log('[DoubaoClient] 已打开比例下拉菜单');
                    await this.page.waitForTimeout(800);
                    // 在下拉菜单中点击对应比例选项
                    const ratioOption = this.page.locator(`[role="menuitem"]:has-text("${ratio}"), [role="menu"] :has-text("${ratio}")`).first();
                    if (await ratioOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await ratioOption.click();
                        console.log(`[DoubaoClient] 已选择比例: ${ratio}`);
                        await this.page.waitForTimeout(500);
                    } else {
                        console.log(`[DoubaoClient] 未找到比例选项 "${ratio}"，使用默认比例`);
                    }
                }
            }

            // 切换模式后重新查找输入框（DOM 可能已变化）
            let inputLocator = this.page.locator('textarea:not([aria-hidden="true"]), [contenteditable="true"]').first();
            try {
                await inputLocator.waitFor({ state: 'visible', timeout: 5000 });
            } catch {
                inputLocator = this.page.locator('textarea').first();
            }

            await inputLocator.fill('');
            await inputLocator.fill(prompt);
            await this.page.waitForTimeout(500);

            const beforeCount = await this.page.locator('img[src*="flow-imagex-sign"]').count();
            console.log(`[DoubaoClient-Debug] 发送前已有图片: ${beforeCount}`);

            await inputLocator.press('Enter');
            console.log('[DoubaoClient] 已发送指令，等待生成...');

            const startTime = Date.now();
            let pollCount = 0;

            while (Date.now() - startTime < timeout) {
                await this.page.waitForTimeout(3000);
                pollCount++;
                const currentCount = await this.page.locator('img[src*="flow-imagex-sign"]').count();
                console.log(`[DoubaoClient-Debug] 轮询 ${pollCount}: ${beforeCount}→${currentCount}`);
                if (currentCount > beforeCount) {
                    await this.page.waitForTimeout(6000);
                    break;
                }
            }

            // 获取图片：原图模式点击一次查看器取所有大图，预览模式直接取 src
            const usePreview = options.quality === 'preview';
            const allImgs = await this.page.locator('img[src*="flow-imagex-sign"]').all();
            const urls: string[] = [];
            if (usePreview) {
                for (let i = beforeCount; i < allImgs.length; i++) {
                    const src = await allImgs[i].getAttribute('src');
                    if (src) {
                        urls.push(src);
                        console.log(`[DoubaoClient] 预览: ${src.substring(0, 80)}...`);
                    }
                }
            } else {
                // 原图：逐个点击缩略图 → 拦截下载事件获取 2048×2048 原图 URL
                for (let i = beforeCount; i < allImgs.length; i++) {
                    try {
                        await allImgs[i].click({ timeout: 5000 });
                        await this.page.waitForTimeout(2500);
                        // 尝试点击下载按钮，拦截下载事件
                        const dlPromise = this.page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
                        // 查找下载按钮：svg 图标或包含"下载"文字的元素
                        const dlBtn = this.page.locator('[role="dialog"] svg').first();
                        if (await dlBtn.count() > 0) await dlBtn.click().catch(() => {});
                        const txtBtn = this.page.locator('text="下载"').first();
                        if (await txtBtn.count() > 0) await txtBtn.click().catch(() => {});
                        const download = await dlPromise;
                        if (download) {
                            const dlUrl = download.url();
                            urls.push(dlUrl);
                            console.log(`[DoubaoClient] 原图: ${dlUrl.substring(0, 80)}...`);
                            await download.cancel().catch(() => {});
                        } else {
                            const src = await allImgs[i].getAttribute('src');
                            if (src) urls.push(src);
                            console.log(`[DoubaoClient] 原图下载失败,回退预览`);
                        }
                        await this.page.keyboard.press('Escape');
                        await this.page.waitForTimeout(300);
                    } catch {
                        const src = await allImgs[i].getAttribute('src');
                        if (src) urls.push(src);
                    }
                }
            }
            console.log(`[DoubaoClient] 捕获 ${urls.length} 张${usePreview ? '预览' : '原'}图`);

            if (urls.length === 0) {
                await this.page.screenshot({ path: 'debug-timeout.png', fullPage: true });
                const html = await this.page.content();
                fs.writeFileSync('debug-page.html', html);
                console.log('[DoubaoClient-Debug] 超时，已保存调试文件');
            }
            return urls;
        } catch (error) {
            console.error('[DoubaoClient] 错误:', error);
            if (this.page) {
                await this.page.screenshot({ path: 'debug-error.png', fullPage: true }).catch(() => {});
            }
            return [];
        }
    }

    async close() {
        if (this.context) {
            await this.context.close();
            console.log('[DoubaoClient] 浏览器已关闭。');
        }
    }

    // Download via browser page.evaluate (uses page's cookies + Referer)
    static async downloadImage(url: string, destPath: string, context?: BrowserContext): Promise<string | null> {
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        if (context) {
            try {
                const response = await context.request.get(url, { timeout: 180000 });
                if (!response.ok()) {
                    console.error(`[DoubaoClient] HTTP ${response.status()}`);
                    return null;
                }
                const buffer = await response.body();
                const isJPEG = buffer.length > 2 && buffer[0] === 0xFF && buffer[1] === 0xD8;
                if (isJPEG) {
                    // Save as JPEG first, convert to PNG via PIL
                    const tmpJpg = destPath.replace('.png', '.tmp.jpg');
                    fs.writeFileSync(tmpJpg, buffer);
                    const { execSync } = require('child_process');
                    execSync(`python -c "from PIL import Image;Image.open('${tmpJpg}').save('${destPath}','PNG')"`);
                    fs.unlinkSync(tmpJpg);
                    console.log(`[DoubaoClient] JPEG→PNG (${fs.statSync(destPath).size} bytes)`);
                } else {
                    fs.writeFileSync(destPath, buffer);
                    console.log(`[DoubaoClient] 已保存 (${buffer.length} bytes)`);
                }
                return destPath;
            } catch (e: any) {
                console.error(`[DoubaoClient] 下载错误: ${e.message}`);
                return null;
            }
        }

        return new Promise((resolve) => {
            const file = fs.createWriteStream(destPath);
            const req = https.get(url, (response: any) => {
                if (response.statusCode !== 200) {
                    console.error(`[DoubaoClient] HTTP ${response.statusCode}`);
                    file.close(); fs.unlink(destPath, () => {}); resolve(null); return;
                }
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(destPath); });
            });
            req.on('error', (err: any) => {
                console.error(`[DoubaoClient] 下载错误: ${err.message}`);
                file.close(); fs.unlink(destPath, () => {}); resolve(null);
            });
            req.setTimeout(10000, () => {
                console.error('[DoubaoClient] 下载超时(10s)');
                req.destroy();
                file.close(); fs.unlink(destPath, () => {}); resolve(null);
            });
        });
    }
}
