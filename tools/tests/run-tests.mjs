// Browser regression tests for the Major Trauma Tool.
// Usage (from the tools folder):  npm install && npm test
// Serves the site locally, runs each check in headless Chromium, and exits non-zero on any failure.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildTailwindCss } from '../build-standalone.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const body = await readFile(join(ROOT, path === '/' ? 'index.html' : path));
        res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
        res.end(body);
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
const TAILWIND = buildTailwindCss();

const browser = await chromium.launch();
let failures = 0, passes = 0;

async function newPage(file = 'index.html') {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'], serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.errors = [];
    page.dialogs = [];
    page.dialogAnswer = true;
    page.on('pageerror', e => page.errors.push(e.message));
    page.on('dialog', d => { page.dialogs.push(d.message()); page.dialogAnswer ? d.accept() : d.dismiss(); });
    // Serve Tailwind locally instead of the CDN; block other external requests so tests run offline
    await page.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith('https://cdn.tailwindcss.com')) {
            return route.fulfill({ contentType: 'application/javascript', body: `(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(TAILWIND)};document.head.appendChild(s);})();` });
        }
        return url.startsWith(BASE) ? route.continue() : route.abort();
    });
    await page.goto(`${BASE}/${file}`);
    await page.waitForSelector('#initialNoteOutput b');
    return page;
}
const initial = page => page.$eval('#initialNoteOutput', el => el.innerText);
const secondary = page => page.$eval('#secondaryNoteOutput', el => el.innerText);
const lineOf = async (page, re) => (await initial(page)).split('\n').filter(l => re.test(l)).join(' // ');
async function reloadAndContinue(page) {
    await page.reload();
    await page.waitForSelector('#initialNoteOutput b');
    if (await page.isVisible('#resume-modal')) await page.click('#btnResumeContinue');
}

async function test(name, fn) {
    let page;
    try {
        page = await newPage();
        await fn(page);
        if (page.errors.length) throw new Error('Page errors: ' + page.errors.join('; '));
        passes++; console.log(`  ✓ ${name}`);
    } catch (e) {
        failures++; console.log(`  ✗ ${name}\n      ${e.message.split('\n').join('\n      ')}`);
    } finally { if (page) await page.context().close(); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function includes(haystack, needle, msg) { assert(haystack.includes(needle), `${msg}\n      expected to contain: ${needle}\n      got: ${haystack}`); }
function excludes(haystack, needle, msg) { assert(!haystack.includes(needle), `${msg}\n      expected NOT to contain: ${needle}\n      got: ${haystack}`); }

console.log('Major Trauma Tool — browser tests');

await test('blank form documents nothing as normal', async page => {
    const i = await initial(page), s = await secondary(page);
    for (const bad of ['NKDA', 'Air entry equal', 'No chest wall injury', 'No concerning findings', 'GCS 15', 'AVPU Alert', 'Airway: Patent']) excludes(i, bad, 'initial note fabricates a finding');
    for (const bad of ['Normocephalic', 'PERLA', 'Pow 5/5', 'Intact']) excludes(s, bad, 'secondary note fabricates a finding');
    includes(i, 'Airway: Not assessed', 'airway');
    includes(i, 'Chest Findings: Not assessed', 'breathing findings');
    includes(i, 'Injury/Bleeding Screen: Not assessed', 'circulation screen');
    includes(i, 'AVPU Not assessed | GCS Not assessed', 'disability');
    includes(i, 'A: Not recorded', 'allergies');
    includes(s, 'Head: Not assessed', 'secondary survey');
    includes(s, 'Neurological Examination: Not assessed', 'neuro exam');
    excludes(i, 'VBG:', 'empty gas line should be omitted');
});

await test('partially assessed findings list the rest as not assessed', async page => {
    await page.click('#breathing_findings .lr-btn[data-f="Flail Segment"][data-s="L"]');
    await page.click('#breathing_findings .lr-btn[data-f="Crepitus"][data-s="None"]');
    const b = await lineOf(page, /Chest Findings/);
    includes(b, 'Chest Findings: Flail Segment (L)', 'positive finding');
    includes(b, 'No crepitus', 'explicit negative');
    includes(b, 'Not assessed: chest wall injury', 'unassessed listed');
    excludes(b, 'Air entry equal', 'no automatic air-entry statement');
});

await test('GCS: incomplete components are flagged, not totalled', async page => {
    await page.click('input[name="disability_gcsE"][value="3"] + div');
    includes(await lineOf(page, /Disability/), 'GCS incomplete (E3 V- M-)', 'partial GCS');
    await page.click('input[name="disability_gcsV"][value="4"] + div');
    await page.click('input[name="disability_gcsM"][value="6"] + div');
    includes(await lineOf(page, /Disability/), 'GCS 13 (E3 V4 M6)', 'full GCS');
});

await test('secondary survey: Normal must be chosen explicitly per area', async page => {
    await page.click('.ss-normal-btn[data-area="head"]');
    includes(await secondary(page), 'Head: Normocephalic', 'head marked normal');
    includes(await secondary(page), 'Face: Not assessed', 'face untouched');
    await page.click('.tag-checkbox[data-area="head"][value="Laceration"] + span');
    const s = await secondary(page);
    includes(s, 'Head: Laceration.', 'abnormal tag replaces normal');
    excludes(s, 'Normocephalic', 'normal removed when abnormal tag added');
    await page.click('#btnSsRemainingNormal');
    includes(await secondary(page), 'Face: No bony tenderness', 'remaining areas marked normal');
    includes(await secondary(page), 'Head: Laceration.', 'abnormal area left alone');
});

await test('neuro exam: Set All Normal and individual values', async page => {
    await page.selectOption('#neuro_plr', '3/5');
    includes(await secondary(page), 'R (Pow 3/5, Sen not assessed)', 'single value recorded');
    await page.click('#btnNeuroNormal');
    assert(page.dialogs.length === 1, 'should confirm before overwriting abnormal 3/5');
    includes(await secondary(page), 'Lower Limbs: L (Pow 5/5, Sen Intact) | R (Pow 5/5, Sen Intact)', 'all normal');
});

await test('NKDA only when chosen; real allergies shown in red', async page => {
    await page.click('#btnNKDA');
    includes(await lineOf(page, /AMPLE/), 'A: NKDA', 'NKDA button');
    await page.fill('#history_a', 'Penicillin');
    const style = await page.$eval('#initialNoteOutput', el => [...el.querySelectorAll('span')].find(s => s.textContent.includes('Penicillin')).getAttribute('style'));
    includes(style, 'color:#dc2626', 'allergy highlighted');
});

await test('free text is escaped (no swallowed "<" text, quotes survive re-render)', async page => {
    await page.fill('#airway_notes', 'Blood in airway <L side suctioned> & cleared');
    includes(await lineOf(page, /Airway:/), 'Blood in airway <L side suctioned> & cleared', 'text with < preserved');
    await page.click('#btnAddLine');
    await page.fill('#linesContainer input[type=text]', 'L 14" cannula');
    await page.dispatchEvent('#linesContainer input[type=text]', 'change');
    await page.click('#btnAddLine');
    assert(await page.$eval('#linesContainer input[type=text]', i => i.value) === 'L 14" cannula', 'quote in line detail truncated');
    await page.fill('#customSpecInput', '<img src=x onerror=alert(1)>');
    await page.click('#btnAddSpec');
    includes(await lineOf(page, /Specialties/), '<img src=x onerror=alert(1)>', 'specialty name shown literally');
});

await test('Set Normal never deletes treatments, oxygen, interventions or glucose', async page => {
    await page.click('[data-target="breathing_treatment_btns"]');
    await page.click('#breathing_treatment_btns [data-tx="Surgical chest drain inserted"]');
    await page.click('input[name="breathing_o2"][value="O2"] + div');
    await page.fill('#breathing_fio2', '15L NRB');
    await page.click('#btnNormalBreathing');
    let n = await initial(page);
    includes(n, 'Surgical chest drain inserted', 'breathing treatment kept');
    includes(n, 'Oxygen 15L NRB', 'oxygen kept');

    await page.click('[data-target="circ_treatment_btns"]');
    await page.click('#circ_treatment_btns [data-tx="Red Cells"]');
    await page.click('[data-text*="Binder"]');
    await page.check('input[name="txaGiven"][value="1g"]');
    await page.fill('#circ_notes', 'Pulses present');
    await page.click('#btnNormalCirc');
    n = await initial(page);
    includes(n, 'Red Cells', 'circulation treatment kept');
    includes(n, 'Pelvic Binder', 'binder kept');
    includes(n, 'TXA Given: 1g', 'TXA kept');
    includes(n, 'Pulses present', 'existing circulation notes kept');
    includes(n, 'No external bleeding', 'canned text appended');

    await page.fill('#disability_glucose', '2.9');
    await page.click('[data-target="disability_treatment_btns"]');
    await page.click('#disability_treatment_btns [data-tx="Mannitol"]');
    await page.check('#cspine_collar');
    await page.click('#btnNormalDisability');
    await page.click('#btnNormalAirway');
    n = await initial(page);
    includes(n, '2.9 mmol/L', 'glucose kept');
    includes(n, 'Mannitol', 'disability treatment kept');
    includes(n, 'C-Spine: Collar', 'collar kept');
    includes(n, 'Airway: Patent. No adjuncts.', 'normal airway wording (no "maintained with adjuncts")');
    includes(n, 'GCS 15 (E4 V5 M6)', 'normal disability');
});

await test('Set Normal asks before overwriting positive findings', async page => {
    await page.click('#circ_body_findings .lr-btn[data-f="Legs"][data-s="R"]');
    page.dialogAnswer = false;
    await page.click('#btnNormalCirc');
    assert(page.dialogs.length === 1, 'no confirmation shown');
    includes(await initial(page), 'Legs (R)', 'finding kept after cancelling');
});

await test('"None" adjunct can be deselected', async page => {
    await page.click('[data-adj="None"]');
    includes(await lineOf(page, /Airway:/), 'No adjuncts', 'None selected');
    await page.click('[data-adj="None"]');
    excludes(await lineOf(page, /Airway:/), 'No adjuncts', 'None deselected');
});

await test('Copy on the Initial note gives feedback on the Initial button', async page => {
    await page.click('#copyInitial');
    await page.waitForTimeout(100);
    includes(await page.textContent('#copyInitial'), 'Copied', 'initial button feedback');
    excludes(await page.textContent('#copySecondary'), 'Copied', 'secondary button untouched');
});

await test('arrival time can be edited without being reset to now', async page => {
    await page.click('#btn-arrival-now');
    await page.fill('#arrival_time', '10:00');
    await page.click('#arrival_time');
    includes(await lineOf(page, /Arrival/), 'Patient Arrival Time: 10:00', 'edited arrival kept after clicking the field');
});

await test('Binder/KTD/Tourniquet time buttons show the recorded time', async page => {
    await page.click('.time-btn[data-for="KTD"]');
    assert(/\d\d:\d\d/.test(await page.textContent('.time-btn[data-for="KTD"]')), 'time not shown after time-button click');
    await page.click('[data-text*="Tourniquet"]');
    assert(/\d\d:\d\d/.test(await page.textContent('.time-btn[data-for="Tourniquet"]')), 'time not shown after activating');
    await page.click('[data-text*="Tourniquet"]');
    includes(await page.textContent('.time-btn[data-for="Tourniquet"]'), 'Now', 'time not cleared after deactivating');
});

await test('serial obs: empty row has no NEWS2, Tab keeps focus, single-3 is Low-medium', async page => {
    await page.click('#btnAddObs');
    await page.click('#btnAddObs');
    includes(await page.textContent('#news2_cell_1'), '\u2014', 'empty row scored');
    await page.click('#obsBody tr:nth-child(2) td:nth-child(2) input');
    await page.keyboard.type('95');
    await page.keyboard.press('Tab');
    assert(await page.evaluate(() => !!document.activeElement.closest('#obsBody')), 'focus lost after Tab');
    await page.keyboard.type('120/80');
    await page.keyboard.press('Tab');
    await page.keyboard.type('7'); // RR 7 scores 3 on its own
    await page.keyboard.press('Tab');
    includes(await page.textContent('#news2_cell_1'), 'Low-medium', 'single-parameter 3 band');
});

await test('MAP/SI display clears when BP is cleared', async page => {
    await page.fill('#circ_bp', '120/80');
    assert(await page.isVisible('#calc_results'), 'MAP not shown');
    await page.fill('#circ_bp', '');
    assert(!(await page.isVisible('#calc_results')), 'stale MAP still shown');
});

await test('elapsed times: before arrival and across midnight', async page => {
    await page.evaluate(() => {
        const d = JSON.parse(localStorage.getItem('wmebem_trauma_data'));
        d.arrival.time = '23:50'; d.circulation.txa = '1g'; d.circulation.txaTime = '00:10';
        d.circulation.binder = true; d.circulation.binderTime = '23:30';
        localStorage.setItem('wmebem_trauma_data', JSON.stringify(d));
    });
    await reloadAndContinue(page);
    includes(await lineOf(page, /TXA/), '00:10 (+20min)', 'midnight crossover');
    includes(await lineOf(page, /Interventions/), '23:30 (20min before arrival)', 'event before arrival');
});

await test('manual edits to a note are kept and survive reload until discarded', async page => {
    await page.click('#initialNoteOutput');
    await page.keyboard.press('End');
    await page.keyboard.type(' MANUAL EDIT');
    await page.fill('#circ_hr', '88');
    includes(await initial(page), 'MANUAL EDIT', 'manual edit overwritten by form change');
    assert(await page.isVisible('#initialNoteEditedBanner'), 'edited banner not shown');
    await reloadAndContinue(page);
    includes(await initial(page), 'MANUAL EDIT', 'manual edit lost on reload');
    await page.click('#initialNoteEditedBanner .regen-btn');
    excludes(await initial(page), 'MANUAL EDIT', 'regenerate did not discard edit');
    includes(await lineOf(page, /Circulation:/), 'HR 88', 'regenerated note has form data');
});

await test('saved record prompts continue / new patient', async page => {
    assert(!(await page.isVisible('#resume-modal')), 'prompt shown for a blank record');
    await page.fill('#age', '45');
    await page.reload();
    await page.waitForSelector('#initialNoteOutput b');
    assert(await page.isVisible('#resume-modal'), 'no prompt for saved record');
    includes(await page.textContent('#resume-summary'), 'Age 45', 'summary');
    await page.click('#btnResumeNew');
    await page.waitForSelector('#initialNoteOutput b');
    assert(!(await page.isVisible('#resume-modal')), 'prompt shown after starting new');
    includes(await lineOf(page, /Age:/), 'Age: Not recorded', 'record not cleared');
});

await test('pre-hospital drugs are not stamped with the ED tap time', async page => {
    await page.click('.drug-btn[data-d="Morphine"]');
    const l = await lineOf(page, /Pre-Hosp Medications/);
    assert(/Morphine$/.test(l.trim()), `unexpected time on pre-hospital drug: ${l}`);
});

await test('full record round-trips through save/reload unchanged', async page => {
    await page.click('#btn-arrival-now');
    await page.fill('#paramedicHandover', 'Line one\nLine two');
    await page.click('.ph-btn[data-t="Pelvic Binder"]');
    await page.click('[data-adj="NPA"]');
    await page.fill('#breathing_rr', '28');
    await page.click('#breathing_findings .lr-btn[data-f="Flail Segment"][data-s="L"]');
    await page.fill('#circ_bp', '85/50');
    await page.check('#mhp_activated');
    await page.click('.blood-btn[data-product="rbc"]');
    await page.click('#btnNormalDisability');
    await page.click('#btnAddObs');
    await page.click('.ss-normal-btn[data-area="face"]');
    await page.selectOption('#neuro_plr', '3/5');
    await page.fill('#problemList', '1. Flail chest\n2. Open tib');
    const strip = t => t.replace(/Note generated: [^)]*/, '');
    const [i1, s1] = [strip(await initial(page)), strip(await secondary(page))];
    await reloadAndContinue(page);
    assert(strip(await initial(page)) === i1, 'initial note changed after reload');
    assert(strip(await secondary(page)) === s1, 'secondary note changed after reload');
    assert(await page.$eval('.ss-normal-btn[data-area="face"]', b => b.classList.contains('active')), 'Normal button state not restored');
});

await test('print shows only the notes', async page => {
    await page.emulateMedia({ media: 'print' });
    for (const sel of ['#sec-arrival', '#sec-breathing', '#sec-exposure', '#problemList', '#definitivePlan']) {
        assert(!(await page.isVisible(sel)), `${sel} printed`);
    }
    assert(await page.isVisible('#initialNoteOutput'), 'initial note not printed');
    assert(await page.isVisible('#secondaryNoteOutput'), 'secondary note not printed');
});

await test('standalone file is built from the current source', async page => {
    const sa = await newPage('majortrauma-standalone.html');
    try {
        includes(await sa.textContent('h1'), 'v3.4', 'standalone version');
        includes(await initial(sa), 'Airway: Not assessed', 'standalone uses current script');
        assert(sa.errors.length === 0, 'standalone errors: ' + sa.errors.join('; '));
    } finally { await sa.context().close(); }
});

await browser.close();
server.close();
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
