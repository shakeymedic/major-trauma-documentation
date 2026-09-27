// Builds majortrauma-standalone.html from the live source files (index.html, styles.css, script.js)
// so the offline single-file copy can never drift behind the hosted version again.
//
// Usage (from this folder):  npm install && npm run build
//
// The standalone file:
//   - inlines a locally compiled Tailwind stylesheet (no CDN), the Inter font, styles.css and script.js
//   - drops the external logo, Google Fonts link, web manifest and service-worker registration,
//     none of which work from a local file.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const ROOT = join(TOOLS, '..');

export function buildTailwindCss() {
    const dir = mkdtempSync(join(tmpdir(), 'tw-'));
    const config = join(dir, 'tailwind.config.cjs');
    const input = join(dir, 'in.css');
    const output = join(dir, 'out.css');
    writeFileSync(config, `module.exports = { content: [${JSON.stringify(join(ROOT, 'index.html'))}, ${JSON.stringify(join(ROOT, 'script.js'))}] };`);
    writeFileSync(input, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
    execFileSync(process.execPath, [join(TOOLS, 'node_modules', 'tailwindcss', 'lib', 'cli.js'), '-c', config, '-i', input, '-o', output, '--minify'], { stdio: 'pipe' });
    return readFileSync(output, 'utf8');
}

function replaceOnce(html, search, replacement, label) {
    const count = typeof search === 'string' ? html.split(search).length - 1 : (html.match(search) || []).length;
    if (count !== 1) throw new Error(`build-standalone: expected exactly one match for ${label}, found ${count}`);
    return html.replace(search, () => replacement);
}

export function buildStandalone() {
    let html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const styles = readFileSync(join(ROOT, 'styles.css'), 'utf8');
    const script = readFileSync(join(ROOT, 'script.js'), 'utf8');
    const font = readFileSync(join(TOOLS, 'inter-font.css'), 'utf8').trim();
    const tailwind = buildTailwindCss();

    // Guard against a stray closing tag in the inlined script ending the <script> element early
    if (/<\/script/i.test(script)) throw new Error('build-standalone: script.js contains "</script"');

    html = replaceOnce(html, /\s*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/, '', 'Tailwind CDN script');
    html = replaceOnce(html, /\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, '', 'Google Fonts link');
    html = replaceOnce(html, /\s*<link rel="manifest"[^>]*>/, '', 'manifest link');
    html = replaceOnce(html, /\s*<script src="script\.js" defer><\/script>/, '', 'script.js tag');
    html = replaceOnce(html, /<link rel="stylesheet" href="styles\.css">/, `<style>\n${font}\n${tailwind}\n${styles}\n</style>`, 'styles.css link');
    html = replaceOnce(html, /\s*<img src="https:\/\/iili\.io[^>]*>/, '', 'external logo');
    // Remove the service-worker registration block and inline the app script in its place
    html = replaceOnce(html, /<script>\s*if\('serviceWorker' in navigator\)[\s\S]*?<\/script>/, `<script>\n${script}\n</script>`, 'service-worker block');

    writeFileSync(join(ROOT, 'majortrauma-standalone.html'), html);
    return html.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const size = buildStandalone();
    console.log(`Built majortrauma-standalone.html (${Math.round(size / 1024)} KB)`);
}
