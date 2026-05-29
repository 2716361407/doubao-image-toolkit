#!/usr/bin/env ts-node

import { DoubaoClient } from './doubao-webapi/client';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h') || args.length === 0) {
        console.log(`
Doubao Web API Image Generation

Usage:
  npx ts-node scripts/main.ts "Your prompt" [options]

Options:
  --ui                    Show browser window (required for first login)
  --quality=<value>       Image quality: 'preview' or 'original' (default: original)
  --ratio=<value>         Image ratio (e.g., '16:9', '1:1', '9:16')
  --output=<path>         Save to specific path (single image mode)
  --help, -h              Show this help
        `);
        process.exit(0);
    }

    const uiFlag = args.includes('--ui');
    const headlessFlag = !uiFlag;

    let quality: 'preview' | 'original' = 'original';
    const qualityArg = args.find(arg => arg.startsWith('--quality='));
    if (qualityArg) {
        const val = qualityArg.split('=')[1];
        if (val === 'preview' || val === 'original') quality = val;
    }

    let ratio: string | undefined;
    const ratioArg = args.find(arg => arg.startsWith('--ratio='));
    if (ratioArg) ratio = ratioArg.split('=')[1];

    let explicitOutput = '';
    const outputArg = args.find(arg => arg.startsWith('--output='));
    if (outputArg) explicitOutput = outputArg.split('=')[1].trim();

    const saveDir = 'D:\\Pictures\\doubao_pic';
    if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

    const promptParts = args.filter(arg =>
        !arg.startsWith('-') &&
        args[args.indexOf(arg) - 1] !== '--output'
    );
    const prompt = promptParts.join(' ').trim() || '一只可爱的金毛犬';

    let imageUrls: string[] = [];
    let client: DoubaoClient | null = null;

    // ── Generate images, keep client open for download ──
    try {
        client = new DoubaoClient();
        console.log('--- 启动豆包生图客户端 ---');
        await client.init(headlessFlag);
        console.log(`\n任务: "${prompt}"`);
        imageUrls = await client.generateImage({ prompt, quality, ratio, timeout: 120000 });
    } catch (error) {
        console.error('错误:', error);
    }

    // ── Save with browser context (auth cookies) ──
    if (imageUrls.length > 0) {
        process.stdout.write(`\n✅ 成功! 共 ${imageUrls.length} 张图片:\n`);

        const now = new Date();
        const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;

        const bctx: any = client?.browserContext ?? undefined;

        for (let i = 0; i < imageUrls.length; i++) {
            let outPath: string;
            if (explicitOutput && imageUrls.length === 1) {
                outPath = path.resolve(process.cwd(), explicitOutput);
            } else {
                const baseName = imageUrls.length > 1
                    ? `doubao_${ts}_${i + 1}`
                    : `doubao_${ts}`;
                outPath = path.join(saveDir, `${baseName}.png`);
                let counter = 0;
                while (fs.existsSync(outPath)) {
                    counter++;
                    outPath = path.join(saveDir, `${baseName}_${counter}.png`);
                }
            }

            process.stdout.write(`  [${i + 1}] 下载中... `);
            const saved = await DoubaoClient.downloadImage(imageUrls[i], outPath, bctx);
            if (saved) {
                process.stdout.write(`${saved}\n`);
            } else {
                process.stdout.write(`失败\n`);
            }
        }
    } else {
        console.log('\n❌ 未获取到图片');
        // Retry with UI mode if no images
        if (headlessFlag) {
            console.log('\n🔄 UI 模式重试...');
            try {
                if (client) await client.close();
                client = new DoubaoClient();
                await client.init(false);
                imageUrls = await client.generateImage({ prompt, quality, ratio, timeout: 120000 });
                if (imageUrls.length > 0) {
                    const now = new Date();
                    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
                    for (let i = 0; i < imageUrls.length; i++) {
                        const outPath = path.join(saveDir, `doubao_${ts}_${i + 1}.png`);
                        const bctx = (client as any).context;
                        await DoubaoClient.downloadImage(imageUrls[i], outPath, bctx);
                    }
                }
            } catch (e) {
                console.error('UI 重试错误:', e);
            }
        }
    }

    if (client) await client.close();
}

main().catch(console.error);
