document.addEventListener('DOMContentLoaded', () => {
    // Safe storage: falls back to in-memory when localStorage is unavailable (sandboxed/file:// contexts)
    const _storage = (() => {
        const mem = {};
        try { localStorage.setItem('__t','1'); localStorage.removeItem('__t'); return localStorage; }
        catch(e) { return { getItem:k=>mem[k]??null, setItem:(k,v)=>{mem[k]=String(v);}, removeItem:k=>{delete mem[k];} }; }
    })();
    const STORAGE_KEY = 'wmebem_trauma_data';

    // Every piece of user-entered text is escaped before it goes into innerHTML, so that text such as
    // "<L side" is documented verbatim rather than being swallowed as an HTML tag.
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const nl2br = (v) => esc(v).replace(/\n/g, '<br>');
    // Unexamined findings are never documented as normal: they are printed as "Not assessed".
    // Values that were simply not entered (age, vitals, times) are printed as "Not recorded".
    const NA = 'Not assessed';
    const NR = 'Not recorded';

    // --- DATA STORE ---
    const DATA_VERSION = '3.4';
    let patientData = {
        _version: DATA_VERSION,
        _savedAt: '',
        _manualEdits: { initial: null, secondary: null },
        zero: { self: false, leader: false, roles: false, brief: false, env: false, ppe: false, notes: '' },
        arrival: { time: '', specialties: [] },
        atmist: { paramedicHandover: '', age: '', ageEst: false, time: '', mech: '', inj: '', signs: '', phTreatments: [], phTreatmentsFree: '', phDrugs: [], phDrugsFree: '', safeguarding: 'No Concern', pregnancy: 'Not Applicable' },
        prehosp: { notes: '', history: {a:'', m:'', p:'', l:'', e:''} },
        airway: { status: '', rsi: false, rsiData: {size:'', length:'', grade:'', etco2:'', drugs:''}, adjuncts: [], collar: false, blocks: false, traumaMat: false, notes: '', treatmentGiven: [], treatmentGivenFree: '' },
        breathing: { rr: '', sats: '', o2: '', fio2: '', findings: [], notes: '', treatmentGiven: [], treatmentGivenFree: '' },
        circulation: { hr: '', bp: '', crt: '', lines: [], bodyFindings: [], txa: 'None', txaTime: '', binder: false, binderTime: '', ktd: false, ktdTime: '', tourniquet: false, tourniquetTime: '', notes: '', treatmentGiven: [], treatmentGivenFree: '' },
        mhp: { activated: false, time: '', crystalloid: '', units: { rbc: [], ffp: [], plt: [], cryo: [] } },
        disability: { avpu: '', headInjury: false, gcsE: '', gcsV: '', gcsM: '', pupilL: '', pupilR: '', glucose: '', ma4l: false, treatmentGiven: [], treatmentGivenFree: '' },
        exposure: { temp: '', notes: '', treatmentGiven: [], treatmentGivenFree: '' },
        ecg: { done: false, time: '', findings: '' },
        obs: [], // Serial Observations
        investigations: { 
            gasType: 'VBG', vbg: {ph:'', pco2:'', po2:'', hco3:'', be:'', lac:'', ca:'', abgFio2:''}, 
            secGasType: 'VBG', vbgSec: {ph:'', pco2:'', po2:'', hco3:'', be:'', lac:'', ca:''},
            efast: { ruq: '', luq: '', pelvis: '', pericardial: '', lung: '' },
            imaging: '' 
        },
        secondary: { visualAcuity: { left: '', right: '' }, logroll: { done: false, findings: '' }, pr: { done: false, findings: '' } },
        checkpoints: {
            primary: { name: '', agreed: '', time: '' },
            secondary: { name: '', agreed: '', time: '' }
        },
        neuroExam: { pul: '', sul: '', pur: '', sur: '', pll: '', sll: '', plr: '', slr: '' },
        definitive: { furtherImaging: false, furtherImagingDetails: '', tetanus: false, meds: [], disposition: '', plan: '' },
        problemList: ''
    };

    const SS_AREAS = [
        { id: 'head', label: 'Head', normal: 'Normocephalic, atraumatic. No boggy masses.', tags: ['Laceration', 'Haematoma', 'Bony Tenderness', 'Depressed Fracture', 'Base of Skull Signs'] },
        { id: 'face', label: 'Face', normal: 'No bony tenderness, deformity or asymmetry.', tags: ['Laceration', 'Bony Tenderness', 'Le Fort instability', 'Nasal Deformity', 'Septal Haematoma'] },
        { id: 'eyes', label: 'Eyes', normal: 'PERLA. Extra-ocular movements intact. No injury.', tags: ['Racoon Eyes', 'Subconj. Haem', 'Hyphema', 'Global Rupture Suspected', 'Entrapment'] },
        { id: 'neck', label: 'Neck', normal: 'Trachea central. No step deformity or tenderness. Soft tissues normal.', tags: ['C-Spine Tenderness', 'Step Deformity', 'Tracheal Deviation', 'Subcut Emphysema', 'Hematoma'] },
        { id: 'chest', label: 'Chest', normal: 'Chest expansion equal. Resonant. Vesicular breath sounds. No tenderness.', tags: ['Crepitus', 'Bruising', 'Rib Tenderness', 'Reduced Expansion', 'Surgical Emphysema'] },
        { id: 'abdo', label: 'Abdomen', normal: 'Soft, non-tender, non-distended. No guarding.', tags: ['Distended', 'Seatbelt Sign', 'Guarding', 'Rigidity', 'Tenderness', 'Evisceration'] },
        { id: 'pelvis', label: 'Pelvis', normal: 'Stable. No tenderness on palpation.', tags: ['Unstable', 'Tenderness', 'Bruising', 'Blood at Meatus'] },
        { id: 'back', label: 'Back', normal: 'No spinal tenderness. No steps. No bruising.', tags: ['Step deformity', 'Spinal Tenderness', 'Paraspinal Tenderness', 'Bruising'] },
        { id: 'limbs', label: 'Limbs', normal: 'No gross deformity. Soft compartments. Neurovascularly intact.', tags: ['Deformity', 'Open Fracture', 'Compartment Tightness', 'Neuro Deficit', 'Vascular Deficit'] },
        { id: 'hands', label: 'Hands', normal: 'Full range of movement. Neurovascularly intact. No tendon injury.', tags: ['Laceration', 'Tendon Injury Suspected', 'Nerve Deficit', 'Swelling', 'Amputation'] }
    ];

    const BREATHING_OPTS = ['Chest Wall Injury', 'Sucking Chest Wound', 'Flail Segment', 'Surgical Emphysema', 'Crepitus', 'Bruising', 'Deformity', 'Reduced Expansion'];
    const BODY_REGION_OPTS = ['Scalp', 'Face', 'Chest', 'Abdomen', 'Pelvis', 'Back', 'Arms', 'Legs', 'Open Wounds'];
    const CANNULA_SIZES = ['14G (Orange)', '16G (Grey)', '18G (Green)', '20G (Pink)', '22G (Blue)'];

    // --- NEWS2 (National Early Warning Score 2) ---
    // Scored on Scale 1 (standard SpO2 targets, no hypercapnic respiratory failure risk assumed).
    // Consciousness is approximated from GCS: GCS 15 = Alert (0), GCS <15 = new altered consciousness (3) —
    // a common ED trauma-flowsheet proxy for full ACVPU, since this tool records GCS rather than AVPU in the obs table.
    function calcNews2(o) {
        const rr = parseFloat(o.rr), spo2 = parseFloat(o.spo2), hr = parseFloat(o.hr), temp = parseFloat(o.temp);
        const sysBpStr = (o.bp || '').split('/')[0];
        const sys = parseFloat(sysBpStr);
        const gcs = parseFloat(o.gcs);
        const onO2 = !!o.onO2;
        const parts = {};

        if (!isNaN(rr)) {
            if (rr <= 8) parts.rr = 3;
            else if (rr <= 11) parts.rr = 1;
            else if (rr <= 20) parts.rr = 0;
            else if (rr <= 24) parts.rr = 2;
            else parts.rr = 3;
        }
        if (!isNaN(spo2)) {
            if (spo2 <= 91) parts.spo2 = 3;
            else if (spo2 <= 93) parts.spo2 = 2;
            else if (spo2 <= 95) parts.spo2 = 1;
            else parts.spo2 = 0;
        }
        if (!isNaN(sys)) {
            if (sys <= 90) parts.bp = 3;
            else if (sys <= 100) parts.bp = 2;
            else if (sys <= 110) parts.bp = 1;
            else if (sys <= 219) parts.bp = 0;
            else parts.bp = 3;
        }
        if (!isNaN(hr)) {
            if (hr <= 40) parts.hr = 3;
            else if (hr <= 50) parts.hr = 1;
            else if (hr <= 90) parts.hr = 0;
            else if (hr <= 110) parts.hr = 1;
            else if (hr <= 130) parts.hr = 2;
            else parts.hr = 3;
        }
        if (!isNaN(gcs)) parts.consciousness = gcs < 15 ? 3 : 0;
        if (!isNaN(temp)) {
            if (temp <= 35.0) parts.temp = 3;
            else if (temp <= 36.0) parts.temp = 1;
            else if (temp <= 38.0) parts.temp = 0;
            else if (temp <= 39.0) parts.temp = 1;
            else parts.temp = 2;
        }

        if (Object.keys(parts).length === 0) return null; // no physiological values entered yet for this row
        parts.o2 = onO2 ? 2 : 0;
        const scoredKeys = Object.keys(parts);
        const total = scoredKeys.reduce((sum, k) => sum + parts[k], 0);
        const anyThree = scoredKeys.some(k => parts[k] === 3);
        let band, colorClass;
        if (total >= 7) { band = 'High'; colorClass = 'news2-high'; }
        else if (total >= 5) { band = 'Medium'; colorClass = 'news2-medium'; }
        else if (anyThree) { band = 'Low-medium'; colorClass = 'news2-medium'; } // RCP: a 3 in any single parameter
        else { band = 'Low'; colorClass = 'news2-low'; }
        const complete = ['rr','spo2','o2','bp','hr','consciousness','temp'].every(k => k in parts);
        return { total, band, colorClass, partial: !complete };
    }

    const getEl = (id) => document.getElementById(id);
    const getTime = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const getDateTime = () => new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // --- UNDO TOAST (safety net for accidental removals) ---
    let undoTimer = null;
    function showUndoToast(message, undoFn) {
        const toast = getEl('undo-toast');
        const msgEl = getEl('undo-toast-msg');
        const btn = getEl('undo-toast-btn');
        if(!toast || !msgEl || !btn) return;
        msgEl.textContent = message;
        clearTimeout(undoTimer);
        btn.onclick = () => {
            undoFn();
            toast.classList.add('hidden');
            clearTimeout(undoTimer);
        };
        toast.classList.remove('hidden');
        undoTimer = setTimeout(() => toast.classList.add('hidden'), 6000);
    }

    // --- COLLAPSIBLE QUICK-OPTION ROWS ---
    document.querySelectorAll('.quick-toggle-btn').forEach(btn => btn.addEventListener('click', () => {
        const target = getEl(btn.dataset.target);
        if(!target) return;
        const willShow = target.classList.contains('hidden');
        target.classList.toggle('hidden');
        btn.textContent = willShow ? '− Hide quick options' : '+ Quick options';
    }));

    // Times are HH:MM only, so differences are taken as the nearest interpretation across midnight
    // (within +/- 12 hours): arrival 23:50 and an event at 00:10 is +20min, not -1420min.
    function minutesBetween(t1, t2) {
        if(!t1 || !t2) return null;
        const [h1,m1] = t1.split(':').map(Number);
        const [h2,m2] = t2.split(':').map(Number);
        if(isNaN(h1)||isNaN(m1)||isNaN(h2)||isNaN(m2)) return null;
        let diff = (h2*60+m2) - (h1*60+m1);
        if(diff < -720) diff += 1440;
        else if(diff > 720) diff -= 1440;
        return diff;
    }
    function elapsedStr(arrival, event) {
        const mins = minutesBetween(arrival, event);
        if(mins === null) return '';
        return mins < 0 ? ` (${Math.abs(mins)}min before arrival)` : ` (+${mins}min)`;
    }

    // --- LOCAL STORAGE & RESTORE ---
    let suppressSave = false; // set while clearing the record so nothing is written back before reload
    function saveState() {
        if(suppressSave) return;
        patientData._savedAt = new Date().toISOString();
        _storage.setItem(STORAGE_KEY, JSON.stringify(patientData));
    }
    function clearRecordAndReload() {
        suppressSave = true;
        _storage.removeItem(STORAGE_KEY);
        location.reload();
    }

    function deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== 'object') target[key] = {};
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    function loadState() {
        const saved = _storage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                patientData = deepMerge(patientData, parsed);
                // Migration guards
                if(!patientData.secondary) patientData.secondary = { visualAcuity: {left:'', right:''} };
                if(!patientData.secondary.visualAcuity) patientData.secondary.visualAcuity = {left:'', right:''};
                if(!patientData.secondary.logroll) patientData.secondary.logroll = {done: false, findings: ''};
                if(!patientData.secondary.pr) patientData.secondary.pr = {done: false, findings: ''};
                if(!patientData.atmist.phDrugs) patientData.atmist.phDrugs = [];
                if(!patientData.atmist.phDrugsFree) patientData.atmist.phDrugsFree = '';
                if(!patientData.atmist.phTreatmentsFree) patientData.atmist.phTreatmentsFree = patientData.atmist.phNotes || '';
                if(!patientData.atmist.paramedicHandover) patientData.atmist.paramedicHandover = '';
                if(!patientData.obs) patientData.obs = [];
                if(!patientData.investigations.efast) patientData.investigations.efast = {ruq:'', luq:'', pelvis:'', pericardial:'', lung:''};
                if(patientData.investigations.efast.lung === undefined) patientData.investigations.efast.lung = '';
                if(patientData.airway.traumaMat === undefined) patientData.airway.traumaMat = false;
                // Migrate A/B/E Treatment Given from the old plain-string shape to the timestamped array + free-text shape
                ['airway', 'breathing', 'exposure'].forEach(sec => {
                    if(!Array.isArray(patientData[sec].treatmentGiven)) {
                        const oldVal = typeof patientData[sec].treatmentGiven === 'string' ? patientData[sec].treatmentGiven : '';
                        patientData[sec].treatmentGiven = [];
                        patientData[sec].treatmentGivenFree = oldVal;
                    }
                    if(patientData[sec].treatmentGivenFree === undefined) patientData[sec].treatmentGivenFree = '';
                });
                if(!patientData.circulation.treatmentGiven) patientData.circulation.treatmentGiven = [];
                if(patientData.circulation.treatmentGivenFree === undefined) patientData.circulation.treatmentGivenFree = '';
                // NOTE: deepMerge() above back-fills bodyFindings/mhp.units from the default template even when the
                // saved data predates them, so these migrations must detect the legacy fields directly — checking
                // whether the new field is merely "missing" would never fire once the default has been merged in.
                if(patientData.mhp.prbc !== undefined || patientData.mhp.ffp !== undefined || patientData.mhp.plt !== undefined || patientData.mhp.cryo !== undefined) {
                    // Migrate old plain-number MHP unit counts into timestamped unit arrays (exact times unknown, use MHP activation time as best guess)
                    const t = patientData.mhp.time || '';
                    const makeUnits = n => { const arr = []; const count = parseInt(n) || 0; for(let i = 0; i < count; i++) arr.push({ time: t }); return arr; };
                    patientData.mhp.units = {
                        rbc: makeUnits(patientData.mhp.prbc),
                        ffp: makeUnits(patientData.mhp.ffp),
                        plt: makeUnits(patientData.mhp.plt),
                        cryo: makeUnits(patientData.mhp.cryo)
                    };
                    delete patientData.mhp.prbc;
                    delete patientData.mhp.ffp;
                    delete patientData.mhp.plt;
                    delete patientData.mhp.cryo;
                }
                if(!patientData.mhp.units) patientData.mhp.units = { rbc: [], ffp: [], plt: [], cryo: [] };
                ['rbc','ffp','plt','cryo'].forEach(k => { if(!Array.isArray(patientData.mhp.units[k])) patientData.mhp.units[k] = []; });
                if(patientData.circulation.bleeding !== undefined || patientData.circulation.regionFindings !== undefined) {
                    // One-time best-effort migration from the older separate External Bleeding Sites / Occult Bleeding Screen fields
                    const legacyBleeding = Array.isArray(patientData.circulation.bleeding) ? patientData.circulation.bleeding : [];
                    const legacyRegion = Array.isArray(patientData.circulation.regionFindings) ? patientData.circulation.regionFindings : [];
                    const merged = Array.isArray(patientData.circulation.bodyFindings) ? patientData.circulation.bodyFindings.slice() : [];
                    const siteMap = { 'L Arm': {f:'Arms', s:'L'}, 'R Arm': {f:'Arms', s:'R'}, 'L Leg': {f:'Legs', s:'L'}, 'R Leg': {f:'Legs', s:'R'} };
                    legacyBleeding.forEach(site => {
                        if(site === 'None Noted') return;
                        if(siteMap[site]) { if(!merged.some(m => m.f === siteMap[site].f)) merged.push(siteMap[site]); }
                        else if(BODY_REGION_OPTS.includes(site) && !merged.some(m => m.f === site)) merged.push({ f: site, s: 'Both' });
                    });
                    legacyRegion.forEach(rf => {
                        const f = rf.f === 'Long Bones' ? 'Legs' : rf.f;
                        if(BODY_REGION_OPTS.includes(f) && rf.s !== 'None' && !merged.some(m => m.f === f)) merged.push({ f, s: rf.s });
                    });
                    patientData.circulation.bodyFindings = merged;
                    delete patientData.circulation.bleeding;
                    delete patientData.circulation.regionFindings;
                }
                if(!Array.isArray(patientData.circulation.bodyFindings)) patientData.circulation.bodyFindings = [];
                if(!patientData.disability.treatmentGiven) patientData.disability.treatmentGiven = [];
                if(patientData.disability.treatmentGivenFree === undefined) patientData.disability.treatmentGivenFree = '';
                if(patientData.disability.ma4l === undefined) patientData.disability.ma4l = false;
                if(!patientData.neuroExam) patientData.neuroExam = { pul:'', sul:'', pur:'', sur:'', pll:'', sll:'', plr:'', slr:'' };
                if(!patientData._manualEdits) patientData._manualEdits = { initial: null, secondary: null };
                if(!patientData.checkpoints) patientData.checkpoints = { primary:{name:'', agreed:'', time:''}, secondary:{name:'', agreed:'', time:''} };
                if(!patientData.definitive) patientData.definitive = { furtherImaging:false, furtherImagingDetails:'', tetanus:false, meds:[], disposition:'', plan:'' };
                if(!patientData.definitive.meds) patientData.definitive.meds = [];
                // Migrate old string lines to object arrays if needed
                if (patientData.circulation.lines && patientData.circulation.lines.length > 0) {
                    if (typeof patientData.circulation.lines[0] === 'string') {
                        patientData.circulation.lines = patientData.circulation.lines.map(str => ({ type: str, location: 'Unknown' }));
                    }
                    // Ensure size/locationDetail exist on every line (v2.8)
                    patientData.circulation.lines.forEach(l => {
                        if (l.size === undefined) l.size = '';
                        if (l.locationDetail === undefined) l.locationDetail = '';
                    });
                }
                if(!patientData.ecg) patientData.ecg = { done: false, time: '', findings: '' };
                SS_AREAS.forEach(area => {
                    const d = patientData.secondary[area.id];
                    if(d && d.normal === undefined) d.normal = false;
                });
                // Migrate old string-array phDrugs to {name,time} objects (v2.8)
                if (patientData.atmist.phDrugs && patientData.atmist.phDrugs.length > 0 && typeof patientData.atmist.phDrugs[0] === 'string') {
                    patientData.atmist.phDrugs = patientData.atmist.phDrugs.map(name => ({ name, time: '' }));
                }
                // Ensure obs rows have temp/onO2 fields (v2.8)
                if (patientData.obs) {
                    patientData.obs.forEach(o => {
                        if (o.temp === undefined) o.temp = '';
                        if (o.onO2 === undefined) o.onO2 = false;
                    });
                }
                restoreUI();
            } catch (e) { console.error("Error loading save data", e); }
        }
    }

    function restoreUI() {
        const p = patientData;
        const setVal = (id, val) => { const el = getEl(id); if(el) el.value = val || ''; };
        const setCheck = (id, val) => { const el = getEl(id); if(el) el.checked = !!val; };

        setCheck('zps_self', p.zero.self);
        setCheck('zps_leader', p.zero.leader);
        setCheck('zps_roles', p.zero.roles);
        setCheck('zps_brief', p.zero.brief);
        setCheck('zps_env', p.zero.env);
        setCheck('zps_ppe', p.zero.ppe);
        setVal('zps_notes', p.zero.notes);

        if(p.arrival.time) showArrivalTime(p.arrival.time);

        renderSpecialties();

        setVal('paramedicHandover', p.atmist.paramedicHandover);
        setVal('age', p.atmist.age);
        setCheck('ageEstimated', p.atmist.ageEst);
        setVal('timeOfIncident', p.atmist.time);
        setVal('mechanism', p.atmist.mech);
        setVal('injuries', p.atmist.inj);
        setVal('signs', p.atmist.signs);
        p.atmist.phTreatments.forEach(t => { const btn = document.querySelector(`.ph-btn[data-t="${t}"]`); if(btn) btn.classList.add('active'); });
        p.atmist.phDrugs.forEach(d => { const btn = document.querySelector(`.drug-btn[data-d="${d.name}"]`); if(btn) btn.classList.add('active'); });
        renderPhDrugs();
        setVal('ph_treatments_free', p.atmist.phTreatmentsFree);
        setVal('ph_drugs_free', p.atmist.phDrugsFree);
        setVal('safeguarding', p.atmist.safeguarding);
        setVal('pregnancy', p.atmist.pregnancy);
        
        setVal('preHospitalOther', p.prehosp.notes);
        ['a','m','p','l','e'].forEach(k => setVal(`history_${k}`, p.prehosp.history[k]));
        
        setCheck('preHospitalRSI', p.airway.rsi);
        if(p.airway.rsi) getEl('rsiDetails').classList.remove('hidden');
        ['size','length','grade','etco2','drugs'].forEach(k => setVal(`rsi_${k}`, p.airway.rsiData[k]));
        if(p.airway.status) { const r = document.querySelector(`input[name="airwayStatus"][value="${p.airway.status}"]`); if(r) r.checked = true; }
        p.airway.adjuncts.forEach(a => { const btn = document.querySelector(`.std-btn[data-adj="${a}"]`); if(btn) btn.classList.add('active'); });
        setCheck('cspine_collar', p.airway.collar);
        setCheck('cspine_blocks', p.airway.blocks);
        setCheck('cspine_traumaMat', p.airway.traumaMat);
        setVal('airway_notes', p.airway.notes);
        setVal('airway_treatmentGivenFree', p.airway.treatmentGivenFree);

        setVal('breathing_rr', p.breathing.rr);
        setVal('breathing_sats', p.breathing.sats);
        if(p.breathing.o2) {
            const r = document.querySelector(`input[name="breathing_o2"][value="${p.breathing.o2}"]`);
            if(r) r.checked = true;
            if(p.breathing.o2 === 'O2') getEl('fio2_container').classList.remove('hidden');
        }
        setVal('breathing_fio2', p.breathing.fio2);
        setVal('breathing_notes', p.breathing.notes);
        setVal('breathing_treatmentGivenFree', p.breathing.treatmentGivenFree);
        
        setVal('circ_hr', p.circulation.hr);
        setVal('circ_bp', p.circulation.bp);
        setVal('circ_capRefill', p.circulation.crt);
        setVal('circ_notes', p.circulation.notes);
        setVal('circ_treatmentGivenFree', p.circulation.treatmentGivenFree);
        setVal('disability_treatmentGivenFree', p.disability.treatmentGivenFree);
        p.circulation.treatmentGiven.forEach(t => { const b = document.querySelector(`#circ_treatment_btns .treat-btn[data-tx="${t.name}"]`); if(b) b.classList.add('active'); });
        p.disability.treatmentGiven.forEach(t => { const b = document.querySelector(`#disability_treatment_btns .treat-btn[data-tx="${t.name}"]`); if(b) b.classList.add('active'); });
        p.airway.treatmentGiven.forEach(t => { const b = document.querySelector(`#airway_treatment_btns .treat-btn[data-tx="${t.name}"]`); if(b) b.classList.add('active'); });
        p.breathing.treatmentGiven.forEach(t => { const b = document.querySelector(`#breathing_treatment_btns .treat-btn[data-tx="${t.name}"]`); if(b) b.classList.add('active'); });
        p.exposure.treatmentGiven.forEach(t => { const b = document.querySelector(`#exposure_treatment_btns .treat-btn[data-tx="${t.name}"]`); if(b) b.classList.add('active'); });
        renderTreatmentList('circ_treatment_list');
        renderTreatmentList('disability_treatment_list');
        renderTreatmentList('airway_treatment_list');
        renderTreatmentList('breathing_treatment_list');
        renderTreatmentList('exposure_treatment_list');
        if(p.circulation.txa) { const r = document.querySelector(`input[name="txaGiven"][value="${p.circulation.txa}"]`); if(r) r.checked = true; }
        
        renderLines();
        
        if(p.circulation.binder) toggleAccessBtn('Binder', true);
        if(p.circulation.ktd) toggleAccessBtn('KTD', true);
        if(p.circulation.tourniquet) toggleAccessBtn('Tourniquet', true);
        
        updateTimeBtn('Binder', p.circulation.binder, p.circulation.binderTime);
        updateTimeBtn('KTD', p.circulation.ktd, p.circulation.ktdTime);
        updateTimeBtn('Tourniquet', p.circulation.tourniquet, p.circulation.tourniquetTime);
        if(p.circulation.txaTime) {
            const tb = getEl('btn-txa-now');
            tb.classList.add('recorded');
            tb.innerText = p.circulation.txaTime;
        }

        setCheck('mhp_activated', p.mhp.activated);
        if(p.mhp.activated) {
            getEl('mhpDetails').classList.remove('hidden');
            getEl('mhp_time').classList.remove('hidden');
        }
        setVal('mhp_time', p.mhp.time);
        setVal('mhp_crystalloid', p.mhp.crystalloid);
        renderBloodProducts();

        setCheck('headInjury', p.disability.headInjury);
        if(p.disability.avpu) { const r = document.querySelector(`input[name="disability_avpu"][value="${p.disability.avpu}"]`); if(r) r.checked = true; }
        setVal('disability_pupil_left', p.disability.pupilL);
        setVal('disability_pupil_right', p.disability.pupilR);
        setVal('disability_glucose', p.disability.glucose);
        setCheck('disability_ma4l', p.disability.ma4l);
        // Restore GCS dropdown values from saved data
        { const r = document.querySelector(`input[name="disability_gcsE"][value="${p.disability.gcsE}"]`); if(r) r.checked = true; }
        { const r = document.querySelector(`input[name="disability_gcsV"][value="${p.disability.gcsV}"]`); if(r) r.checked = true; }
        { const r = document.querySelector(`input[name="disability_gcsM"][value="${p.disability.gcsM}"]`); if(r) r.checked = true; }
        // Restore glucose alert
        const glucoseAlert = getEl('glucose_alert');
        const gv = parseFloat(p.disability.glucose);
        if(glucoseAlert) glucoseAlert.classList.toggle('hidden', isNaN(gv) || gv > 3.5);
        // Restore HR / BP alerts
        const hrEl = getEl('hr_alert');
        if(hrEl && p.circulation.hr) { const hv = parseInt(p.circulation.hr); if(hv < 40) { hrEl.textContent = '⚠️ Bradycardia'; hrEl.style.color='#dc2626'; hrEl.classList.remove('hidden'); } else if(hv > 150) { hrEl.textContent = '⚠️ Tachycardia'; hrEl.style.color='#dc2626'; hrEl.classList.remove('hidden'); } else if(hv > 100) { hrEl.textContent = '↑ Tachycardia'; hrEl.style.color='#d97706'; hrEl.classList.remove('hidden'); } }
        const bpEl = getEl('bp_alert');
        if(bpEl && p.circulation.bp) { const pts = p.circulation.bp.split('/'); if(pts.length === 2) { const sv = parseInt(pts[0]); if(sv < 90) { bpEl.textContent = '⚠️ Hypotension'; bpEl.style.color='#dc2626'; bpEl.classList.remove('hidden'); } else if(sv > 200) { bpEl.textContent = '⚠️ Hypertension'; bpEl.style.color='#dc2626'; bpEl.classList.remove('hidden'); } } }
        const rrEl = getEl('rr_alert');
        if(rrEl && p.breathing.rr) { const rv = parseInt(p.breathing.rr); if(rv < 8) { rrEl.textContent = '⚠️ Severe Bradypnoea'; rrEl.style.color='#dc2626'; rrEl.classList.remove('hidden'); } else if(rv <= 11) { rrEl.textContent = '↓ Bradypnoea'; rrEl.style.color='#d97706'; rrEl.classList.remove('hidden'); } else if(rv > 24) { rrEl.textContent = '⚠️ Severe Tachypnoea'; rrEl.style.color='#dc2626'; rrEl.classList.remove('hidden'); } else if(rv >= 21) { rrEl.textContent = '↑ Tachypnoea'; rrEl.style.color='#d97706'; rrEl.classList.remove('hidden'); } }
        const satsEl = getEl('sats_alert');
        if(satsEl && p.breathing.sats) { const sv2 = parseInt(p.breathing.sats); if(sv2 < 90) { satsEl.textContent = '⚠️ Severe Hypoxia'; satsEl.style.color='#dc2626'; satsEl.classList.remove('hidden'); } else if(sv2 <= 93) { satsEl.textContent = '↓ Hypoxia'; satsEl.style.color='#d97706'; satsEl.classList.remove('hidden'); } }
        const tempEl = getEl('temp_alert');
        if(tempEl && p.exposure.temp) { const tv = parseFloat(p.exposure.temp); if(tv < 35) { tempEl.textContent = '⚠️ Hypothermia'; tempEl.style.color='#dc2626'; tempEl.classList.remove('hidden'); } else if(tv < 36) { tempEl.textContent = '↓ Mild Hypothermia'; tempEl.style.color='#d97706'; tempEl.classList.remove('hidden'); } else if(tv >= 39) { tempEl.textContent = '⚠️ High Fever'; tempEl.style.color='#dc2626'; tempEl.classList.remove('hidden'); } else if(tv >= 38) { tempEl.textContent = '↑ Fever'; tempEl.style.color='#d97706'; tempEl.classList.remove('hidden'); } }

        setVal('exposure_temp', p.exposure.temp);
        setVal('exposure_notes', p.exposure.notes);
        setVal('exposure_treatmentGivenFree', p.exposure.treatmentGivenFree);

        setCheck('ecg_done', p.ecg.done);
        setVal('ecg_findings', p.ecg.findings);
        if(p.ecg.time) { const btn = getEl('btn-ecg-now'); btn.classList.add('recorded'); btn.innerText = p.ecg.time; }
        // Restore neuro exam selects from saved data
        ['pul','sul','pur','sur','pll','sll','plr','slr'].forEach(k => {
            const el = getEl(`neuro_${k}`); if(el) el.value = p.neuroExam[k] || '';
        });
        // Restore breathing L/R finding button states
        p.breathing.findings.forEach(obj => {
            const btn = document.querySelector(`.lr-btn[data-f="${obj.f}"][data-s="${obj.s}"]`);
            if(btn) btn.classList.add('active');
        });
        // Restore circulation body findings (injury/bleeding screen) button states
        p.circulation.bodyFindings.forEach(obj => {
            const btn = document.querySelector(`#circ_body_findings .lr-btn[data-f="${obj.f}"][data-s="${obj.s}"]`);
            if(btn) btn.classList.add('active');
        });
        // Restore secondary survey area tags and text
        SS_AREAS.forEach(area => {
            if(patientData.secondary[area.id]) {
                patientData.secondary[area.id].tags.forEach(tag => {
                    const chk = document.querySelector(`.tag-checkbox[data-area="${area.id}"][value="${tag}"]`);
                    if(chk) { chk.checked = true; chk.nextElementSibling && chk.nextElementSibling.classList && chk.nextElementSibling.classList.add('tag-active'); }
                });
                const txt = getEl(`ss_${area.id}`);
                if(txt) { txt.value = patientData.secondary[area.id].text; txt.style.height = 'auto'; txt.style.height = txt.scrollHeight + 'px'; }
                updateSsNormalBtn(area.id);
            }
        });

        renderObs();

        const rGas = document.querySelector(`input[name="gasType"][value="${p.investigations.gasType}"]`);
        if(rGas) rGas.checked = true;
        if(p.investigations.gasType === 'ABG') getEl('gasFio2Container').classList.remove('hidden');
        const rSecGas = document.querySelector(`input[name="secGasType"][value="${p.investigations.secGasType}"]`);
        if(rSecGas) rSecGas.checked = true;

        // Fix: abgFio2 uses element id 'gasFio2', not 'vbgInitial_abgFio2'
        setVal('gasFio2', p.investigations.vbg.abgFio2);
        ['ph','pco2','po2','hco3','be','lac','ca'].forEach(k => { const map = {lac:'lactate', ca:'ionisedCa'}; setVal(`vbgInitial_${map[k]||k}`, p.investigations.vbg[k]); });
        ['ph','pco2','po2','hco3','be','lac','ca'].forEach(k => { const map = {lac:'lactate', ca:'ionisedCa'}; setVal(`vbgSec_${map[k]||k}`, p.investigations.vbgSec[k]); });
        
        ['ruq', 'luq', 'pelvis', 'pericardial', 'lung'].forEach(k => setVal(`efast_${k}`, p.investigations.efast[k]));
        setVal('imagingDecisions', p.investigations.imaging);
        
        setVal('va_left', p.secondary.visualAcuity.left);
        setVal('va_right', p.secondary.visualAcuity.right);

        setCheck('logroll_done', p.secondary.logroll.done);
        setVal('logroll_findings', p.secondary.logroll.findings);
        setCheck('pr_done', p.secondary.pr.done);
        setVal('pr_findings', p.secondary.pr.findings);

        setVal('cp_primary_name', p.checkpoints.primary.name);
        if(p.checkpoints.primary.agreed) { const r = document.querySelector(`input[name="cp_primary_agreed"][value="${p.checkpoints.primary.agreed}"]`); if(r) r.checked = true; }
        if(p.checkpoints.primary.time) { const btn = document.querySelector('button[data-checkpoint="primary"]'); btn.classList.add('recorded'); btn.innerText = p.checkpoints.primary.time; }
        setVal('cp_secondary_name', p.checkpoints.secondary.name);
        if(p.checkpoints.secondary.agreed) { const r = document.querySelector(`input[name="cp_secondary_agreed"][value="${p.checkpoints.secondary.agreed}"]`); if(r) r.checked = true; }
        if(p.checkpoints.secondary.time) { const btn = document.querySelector('button[data-checkpoint="secondary"]'); btn.classList.add('recorded'); btn.innerText = p.checkpoints.secondary.time; }

        setCheck('furtherImaging', p.definitive.furtherImaging);
        if(p.definitive.furtherImaging) getEl('furtherImagingDetails').classList.remove('hidden');
        setVal('furtherImagingDetails', p.definitive.furtherImagingDetails);
        setCheck('tetanus', p.definitive.tetanus);
        p.definitive.meds.forEach(m => { const chk = document.querySelector(`.med-check[value="${m}"]`); if(chk) chk.checked = true; });
        if(p.definitive.disposition) { const btn = document.querySelector(`.disp-btn[data-val="${p.definitive.disposition}"]`); if(btn) btn.classList.add('active'); }
        setVal('definitivePlan', p.definitive.plan);
        setVal('problemList', p.problemList);

        // Manually edited note panels are restored as edited (and stay locked until regenerated)
        ['initial', 'secondary'].forEach(panel => {
            const html = p._manualEdits && p._manualEdits[panel];
            if(html) { getEl(`${panel}NoteOutput`).innerHTML = html; setEditedBanner(panel, true); }
        });
    }

    function showArrivalTime(t) {
        getEl('btn-arrival-now').classList.add('hidden');
        getEl('arrival-set').classList.remove('hidden');
        getEl('arrival_time').value = t;
    }

    function setEditedBanner(panel, show) {
        const el = getEl(`${panel}NoteEditedBanner`);
        if(el) el.classList.toggle('hidden', !show);
    }

    function updateSsNormalBtn(areaId) {
        const btn = document.querySelector(`.ss-normal-btn[data-area="${areaId}"]`);
        if(btn) btn.classList.toggle('active', !!(patientData.secondary[areaId] && patientData.secondary[areaId].normal));
    }

    function toggleAccessBtn(txtPart, active) {
        const btn = document.querySelector(`[data-text*="${txtPart}"]`);
        if(btn) {
            if(active) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    }

    function updateTimeBtn(type, active, timeVal) {
        const btn = document.querySelector(`.time-btn[data-for="${type}"]`);
        if(!btn) return;
        if(active && timeVal) { btn.classList.add('recorded'); btn.innerText = timeVal; } 
        else { btn.classList.remove('recorded'); btn.innerText = '🕒 Now'; }
    }

    // --- SPECIALTY MANAGEMENT ---
    function renderSpecialties() {
        const container = getEl('activeSpecialtiesList');
        container.innerHTML = '';
        document.querySelectorAll('[data-spec]').forEach(b => b.classList.remove('active'));

        if (patientData.arrival.specialties.length === 0) {
            container.innerHTML = '<span class="text-xs text-slate-400 italic self-center">No specialties recorded yet.</span>';
            return;
        }

        patientData.arrival.specialties.forEach((spec, index) => {
            if (spec.isPreset) { const btn = document.querySelector(`[data-spec="${spec.name}"]`); if(btn) btn.classList.add('active'); }
            const div = document.createElement('div');
            div.className = 'spec-chip';
            div.innerHTML = `${esc(spec.name)}<span class="time">@ ${esc(spec.time)}</span>`;
            const remBtn = document.createElement('button');
            remBtn.innerHTML = '&times;';
            remBtn.onclick = () => removeSpecialtyWithUndo(index);
            div.appendChild(remBtn);
            container.appendChild(div);
        });
    }

    function addSpecialty(name, isPreset = false) {
        if(!name) return;
        if (isPreset) {
            const existsIdx = patientData.arrival.specialties.findIndex(s => s.name === name && s.isPreset);
            if (existsIdx > -1) { removeSpecialty(existsIdx); return; }
        }
        patientData.arrival.specialties.push({ name: name, time: getTime(), isPreset: isPreset });
        renderSpecialties();
        updateNotes();
    }

    function removeSpecialty(index) {
        patientData.arrival.specialties.splice(index, 1);
        renderSpecialties();
        updateNotes();
    }

    function removeSpecialtyWithUndo(index) {
        const removed = patientData.arrival.specialties[index];
        removeSpecialty(index);
        showUndoToast(`Removed ${removed.name}`, () => {
            patientData.arrival.specialties.splice(index, 0, removed);
            renderSpecialties();
            updateNotes();
        });
    }
    
    // --- LINES & ACCESS MANAGEMENT ---
    function renderLines() {
        const container = getEl('linesContainer');
        container.innerHTML = '';
        patientData.circulation.lines.forEach((line, i) => {
            container.innerHTML += `
                <div class="flex flex-wrap gap-2">
                    <select class="w-full sm:w-1/4 px-2 py-1 text-sm border border-slate-300 rounded bg-white" onchange="updateLine(${i}, 'type', this.value)">
                        <option value="">Select Type...</option>
                        <option value="IV" ${line.type==='IV'?'selected':''}>IV</option>
                        <option value="Arterial Line" ${line.type==='Arterial Line'?'selected':''}>Arterial Line</option>
                        <option value="IO" ${line.type==='IO'?'selected':''}>IO</option>
                        <option value="CVC" ${line.type==='CVC'?'selected':''}>CVC</option>
                        <option value="RIC" ${line.type==='RIC'?'selected':''}>RIC</option>
                    </select>
                    <select class="w-full sm:w-1/5 px-2 py-1 text-sm border border-slate-300 rounded bg-white" onchange="updateLine(${i}, 'size', this.value)">
                        <option value="">Size...</option>
                        ${CANNULA_SIZES.map(s => `<option value="${s}" ${line.size===s?'selected':''}>${s}</option>`).join('')}
                    </select>
                    <select class="flex-1 min-w-[8rem] px-2 py-1 text-sm border border-slate-300 rounded bg-white" onchange="updateLine(${i}, 'location', this.value)">
                        <option value="">Select Location...</option>
                        <option value="Left Arm" ${line.location==='Left Arm'?'selected':''}>Left Arm</option>
                        <option value="Right Arm" ${line.location==='Right Arm'?'selected':''}>Right Arm</option>
                        <option value="Left Leg" ${line.location==='Left Leg'?'selected':''}>Left Leg</option>
                        <option value="Right Leg" ${line.location==='Right Leg'?'selected':''}>Right Leg</option>
                        <option value="Left EJ / IJ" ${line.location==='Left EJ / IJ'?'selected':''}>Left EJ / IJ</option>
                        <option value="Right EJ / IJ" ${line.location==='Right EJ / IJ'?'selected':''}>Right EJ / IJ</option>
                        <option value="Subclavian" ${line.location==='Subclavian'?'selected':''}>Subclavian</option>
                        <option value="Femoral" ${line.location==='Femoral'?'selected':''}>Femoral</option>
                    </select>
                    <input type="text" class="flex-1 min-w-[8rem] px-2 py-1 text-sm border border-slate-300 rounded bg-white" placeholder="Exact site e.g. ACF, hand, forearm..." value="${esc(line.locationDetail||'')}" onchange="updateLine(${i}, 'locationDetail', this.value)">
                    <button type="button" class="px-2 bg-red-100 text-red-600 font-bold rounded hover:bg-red-200 transition" onclick="removeLine(${i})">&times;</button>
                </div>
            `;
        });
    }

    window.updateLine = function(index, field, value) {
        patientData.circulation.lines[index][field] = value;
        updateNotes();
    };
    
    window.removeLine = function(index) {
        const removed = patientData.circulation.lines[index];
        patientData.circulation.lines.splice(index, 1);
        renderLines();
        updateNotes();
        showUndoToast('Removed line/access entry', () => {
            patientData.circulation.lines.splice(index, 0, removed);
            renderLines();
            updateNotes();
        });
    };

    getEl('btnAddLine').addEventListener('click', () => {
        patientData.circulation.lines.push({ type: '', location: '', size: '', locationDetail: '' });
        renderLines();
        updateNotes();
    });

    // --- SERIAL OBSERVATIONS ---
    function news2Html(o) {
        const news = calcNews2(o);
        return news ? `<span class="news2-badge ${news.colorClass}">${news.total}${news.partial ? '*' : ''} ${news.band}</span>` : `<span class="text-slate-300 text-xs">\u2014</span>`;
    }
    function renderObs() {
        const tbody = getEl('obsBody');
        tbody.innerHTML = '';
        patientData.obs.forEach((o, i) => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-200 bg-white';
            tr.innerHTML = `
                <td class="p-2"><input type="time" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${esc(o.time)}" onchange="updateObs(${i}, 'time', this.value)"></td>
                <td class="p-2"><input type="number" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${esc(o.hr)}" onchange="updateObs(${i}, 'hr', this.value)"></td>
                <td class="p-2"><input type="text" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${esc(o.bp)}" onchange="updateObs(${i}, 'bp', this.value)"></td>
                <td class="p-2"><input type="number" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${esc(o.rr)}" onchange="updateObs(${i}, 'rr', this.value)"></td>
                <td class="p-2"><input type="number" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${esc(o.spo2)}" onchange="updateObs(${i}, 'spo2', this.value)"></td>
                <td class="p-2 text-center"><label class="inline-flex items-center gap-1 text-xs font-bold text-slate-600 cursor-pointer"><input type="checkbox" ${o.onO2?'checked':''} onchange="updateObs(${i}, 'onO2', this.checked)">O2</label></td>
                <td class="p-2"><input type="number" step="0.1" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${esc(o.temp||'')}" onchange="updateObs(${i}, 'temp', this.value)"></td>
                <td class="p-2"><input type="number" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${esc(o.gcs)}" onchange="updateObs(${i}, 'gcs', this.value)"></td>
                <td class="p-2"><input type="text" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" placeholder="L/R" value="${esc(o.pupils||'')}" onchange="updateObs(${i}, 'pupils', this.value)"></td>
                <td class="p-2 text-center" id="news2_cell_${i}">${news2Html(o)}</td>
                <td class="p-2 text-center"><button class="text-red-500 hover:text-red-700 font-bold" onclick="removeObs(${i})">&times;</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.updateObs = function(index, field, value) {
        patientData.obs[index][field] = value;
        const cell = getEl(`news2_cell_${index}`);
        if(cell) cell.innerHTML = news2Html(patientData.obs[index]);
        updateNotes();
    };
    window.removeObs = function(index) {
        const removed = patientData.obs[index];
        patientData.obs.splice(index, 1);
        renderObs();
        updateNotes();
        showUndoToast(`Removed observation @ ${removed.time || ''}`, () => {
            patientData.obs.splice(index, 0, removed);
            renderObs();
            updateNotes();
        });
    };
    // Quick win: build the first observation row from primary survey vitals already recorded,
    // so nothing has to be re-typed. Only used when there are no obs rows yet — never overwrites real data.
    function firstObsFromPrimarySurvey() {
        const p = patientData;
        const gcsParts = [p.disability.gcsE, p.disability.gcsV, p.disability.gcsM];
        const gcsTot = gcsParts.every(v => v !== '' && v !== undefined && v !== null) ? (parseInt(p.disability.gcsE) + parseInt(p.disability.gcsV) + parseInt(p.disability.gcsM)) : '';
        const pupils = (p.disability.pupilL || p.disability.pupilR) ? `${p.disability.pupilL || '?'}/${p.disability.pupilR || '?'}` : '';
        return {
            time: getTime(),
            hr: p.circulation.hr || '',
            bp: p.circulation.bp || '',
            rr: p.breathing.rr || '',
            spo2: p.breathing.sats || '',
            onO2: p.breathing.o2 === 'O2',
            temp: p.exposure.temp || '',
            gcs: gcsTot,
            pupils: pupils
        };
    }
    getEl('btnAddObs').addEventListener('click', () => {
        if(patientData.obs.length === 0) {
            patientData.obs.push(firstObsFromPrimarySurvey());
        } else {
            patientData.obs.push({ time: getTime(), hr: '', bp: '', rr: '', spo2: '', onO2: false, temp: '', gcs: '', pupils: '' });
        }
        renderObs();
        updateNotes();
    });

    const btnCopyLastObs = getEl('btnCopyLastObs');
    if(btnCopyLastObs) btnCopyLastObs.addEventListener('click', () => {
        if(patientData.obs.length === 0) {
            patientData.obs.push(firstObsFromPrimarySurvey());
        } else {
            const last = patientData.obs[patientData.obs.length - 1];
            patientData.obs.push({ ...last, time: getTime() });
        }
        renderObs();
        updateNotes();
    });

    // --- BUILD UI COMPONENTS ---
    const bContainer = getEl('breathing_findings');
    BREATHING_OPTS.forEach(opt => {
        bContainer.innerHTML += `
            <div class="flex items-center justify-between bg-slate-50 border border-slate-300 rounded-lg p-2 gap-2">
                <span class="text-sm font-bold text-slate-700 flex-1">${opt}</span>
                <div class="flex gap-1">
                    <button class="lr-btn w-9 h-9 rounded-md border-2 border-slate-300 bg-white font-black text-slate-600 hover:bg-slate-100 text-xs" data-f="${opt}" data-s="L">L</button>
                    <button class="lr-btn w-9 h-9 rounded-md border-2 border-slate-300 bg-white font-black text-slate-600 hover:bg-slate-100 text-xs" data-f="${opt}" data-s="R">R</button>
                    <button class="lr-btn w-9 h-9 rounded-md border-2 border-slate-300 bg-white font-black text-slate-600 hover:bg-slate-100 text-[10px]" data-f="${opt}" data-s="Both">B/L</button>
                    <button class="lr-btn w-9 h-9 rounded-md border-2 border-slate-300 bg-white font-black text-slate-600 hover:bg-slate-100 text-[10px]" data-f="${opt}" data-s="None">None</button>
                </div>
            </div>`;
    });

    const circBodyContainer = getEl('circ_body_findings');
    BODY_REGION_OPTS.forEach(opt => {
        circBodyContainer.innerHTML += `
            <div class="flex items-center justify-between bg-slate-50 border border-slate-300 rounded-lg p-2 gap-2">
                <span class="text-sm font-bold text-slate-700 flex-1">${opt}</span>
                <div class="flex gap-1">
                    <button class="lr-btn w-9 h-9 rounded-md border-2 border-slate-300 bg-white font-black text-slate-600 hover:bg-slate-100 text-xs" data-f="${opt}" data-s="L">L</button>
                    <button class="lr-btn w-9 h-9 rounded-md border-2 border-slate-300 bg-white font-black text-slate-600 hover:bg-slate-100 text-xs" data-f="${opt}" data-s="R">R</button>
                    <button class="lr-btn w-9 h-9 rounded-md border-2 border-slate-300 bg-white font-black text-slate-600 hover:bg-slate-100 text-[10px]" data-f="${opt}" data-s="Both">B/L</button>
                    <button class="lr-btn w-9 h-9 rounded-md border-2 border-slate-300 bg-white font-black text-slate-600 hover:bg-slate-100 text-[10px]" data-f="${opt}" data-s="None">None</button>
                </div>
            </div>`;
    });

    const secContainer = getEl('secondary_container');
    SS_AREAS.forEach(area => {
        const div = document.createElement('div');
        div.className = "mb-4 pb-4 border-b border-slate-300 last:border-0";
        let tagsHtml = `<div class="flex flex-wrap gap-2 mb-2">`;
        area.tags.forEach(tag => {
            tagsHtml += `<label class="cursor-pointer"><input type="checkbox" class="tag-checkbox hidden" data-area="${area.id}" value="${tag}"><span class="px-2 py-1 text-xs border-2 border-slate-300 rounded hover:bg-slate-50 transition select-none font-bold text-slate-600">${tag}</span></label>`;
        });
        tagsHtml += `</div>`;
        
        div.innerHTML = `<div class="flex items-center justify-between mb-1"><label class="block text-xs font-black text-slate-600 uppercase">${area.label}</label><button type="button" class="ss-normal-btn" data-area="${area.id}" data-label="${area.label}" title="${area.normal}">Normal</button></div>${tagsHtml}<textarea id="ss_${area.id}" rows="1" class="w-full px-3 py-2 border border-slate-400 rounded text-sm font-medium overflow-hidden" style="resize:none;" placeholder="Additional details for ${area.label}..."></textarea>`;
        secContainer.appendChild(div);
        // Auto-expand textarea as user types
        const ssTextarea = getEl(`ss_${area.id}`);
        if(ssTextarea) ssTextarea.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; });
        if(!patientData.secondary[area.id]) patientData.secondary[area.id] = { tags: [], text: '', normal: false };
    });

    const powerOpts = ['5/5', '4/5', '3/5', '2/5', '1/5', '0/5'];
    const sensOpts = ['Intact', 'Reduced', 'Absent', 'Paraesthesia'];
    document.querySelectorAll('.neuro-select').forEach(sel => {
        const isPower = sel.id.includes('neuro_p');
        const opts = isPower ? powerOpts : sensOpts;
        sel.add(new Option(isPower ? 'Power: not assessed' : 'Sensation: not assessed', ''));
        opts.forEach(o => sel.add(new Option(isPower ? `Power ${o}` : o, o)));
        sel.value = '';
        sel.addEventListener('change', e => {
           patientData.neuroExam[sel.id.replace('neuro_', '')] = e.target.value;
           updateNotes();
        });
    });
    document.querySelectorAll('input[name="disability_gcsE"]').forEach(r => r.addEventListener('change', e => { patientData.disability.gcsE = parseInt(e.target.value); updateNotes(); }));
    document.querySelectorAll('input[name="disability_gcsV"]').forEach(r => r.addEventListener('change', e => { patientData.disability.gcsV = parseInt(e.target.value); updateNotes(); }));
    document.querySelectorAll('input[name="disability_gcsM"]').forEach(r => r.addEventListener('change', e => { patientData.disability.gcsM = parseInt(e.target.value); updateNotes(); }));

    // --- QUICK-PHRASE CHIPS (Airway/Breathing/Exposure Treatment Given free text) ---
    function initPhraseButtons(containerId, inputId) {
        const container = getEl(containerId);
        const input = getEl(inputId);
        if(!container || !input) return;
        container.querySelectorAll('.phrase-btn').forEach(btn => btn.addEventListener('click', () => {
            const phrase = btn.dataset.phrase;
            if(phrase === 'None') {
                input.value = 'None';
            } else {
                const current = input.value.trim();
                const parts = current.split(',').map(s => s.trim()).filter(s => s && s !== 'None');
                if(!parts.includes(phrase)) parts.push(phrase);
                input.value = parts.join(', ');
            }
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }));
    }

    // --- QUICK-TAP PRESETS (Pupils — replaces value rather than appending) ---
    function initPresetButtons(containerId, inputId) {
        const container = getEl(containerId);
        const input = getEl(inputId);
        if(!container || !input) return;
        container.querySelectorAll('.preset-btn').forEach(btn => btn.addEventListener('click', () => {
            input.value = btn.dataset.val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }));
    }
    initPresetButtons('pupil_left_presets', 'disability_pupil_left');
    initPresetButtons('pupil_right_presets', 'disability_pupil_right');

    // --- NOTE GENERATION (RICH TEXT) ---
    function updateDeptClock() {
        const el = getEl('dept-clock-value');
        if(!el) return;
        if(!patientData.arrival.time) { el.textContent = '--:--'; return; }
        let mins = minutesBetween(patientData.arrival.time, getTime());
        if(mins === null) { el.textContent = '--:--'; return; }
        if(mins < 0) mins += 1440; // arrival was before midnight

        const h = Math.floor(mins / 60);
        const m = mins % 60;
        el.textContent = h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
    }
    setInterval(updateDeptClock, 15000);

    function setTrendArrow(elId, currentVal, lastVal) {
        const el = getEl(elId);
        if(!el) return;
        const c = parseFloat(currentVal), l = parseFloat(lastVal);
        if(currentVal === '' || currentVal === undefined || currentVal === null || lastVal === '' || lastVal === undefined || lastVal === null || isNaN(c) || isNaN(l)) { el.textContent = ''; el.title = ''; el.style.color = ''; return; }
        if(c > l) { el.textContent = '↑'; el.title = `Was ${lastVal}`; el.style.color = '#0369a1'; }
        else if(c < l) { el.textContent = '↓'; el.title = `Was ${lastVal}`; el.style.color = '#b45309'; }
        else { el.textContent = '→'; el.title = `Unchanged from ${lastVal}`; el.style.color = '#64748b'; }
    }

    function updateTrendArrows() {
        const p = patientData;
        // GCS total display always updates, regardless of obs history
        const gcsTotalEl = getEl('gcs_total');
        const gcsTot = gcsTotal(p.disability);
        if(gcsTotalEl) {
            gcsTotalEl.textContent = gcsTot === null ? '—' : gcsTot;
            gcsTotalEl.style.color = gcsTot === null ? '#94a3b8' : (gcsTot <= 8 ? '#b91c1c' : (gcsTot <= 13 ? '#b45309' : '#1e293b'));
        }
        const lastObs = p.obs.length ? p.obs[p.obs.length - 1] : null;
        if(!lastObs) {
            ['hr_trend', 'bp_trend', 'rr_trend', 'sats_trend', 'temp_trend', 'gcs_trend'].forEach(id => { const el = getEl(id); if(el) { el.textContent = ''; el.title = ''; } });
            return;
        }
        setTrendArrow('hr_trend', p.circulation.hr, lastObs.hr);
        setTrendArrow('rr_trend', p.breathing.rr, lastObs.rr);
        setTrendArrow('sats_trend', p.breathing.sats, lastObs.spo2);
        setTrendArrow('temp_trend', p.exposure.temp, lastObs.temp);
        setTrendArrow('gcs_trend', gcsTot === null ? '' : gcsTot, lastObs.gcs);
        const bpSys = (p.circulation.bp || '').split('/')[0];
        const lastBpSys = (lastObs.bp || '').split('/')[0];
        setTrendArrow('bp_trend', bpSys, lastBpSys);
    }

    // GCS total, or null unless all three components have been assessed
    function gcsTotal(d) {
        const parts = [d.gcsE, d.gcsV, d.gcsM].map(v => parseInt(v));
        return parts.some(isNaN) ? null : parts[0] + parts[1] + parts[2];
    }
    const B = (txt) => `<b style="font-weight: bold;">${txt}</b>`;
    const orNR = (v, suffix = '') => (v !== '' && v !== null && v !== undefined) ? `${esc(v)}${suffix}` : NR;
    const txList = (sec) => {
        const arr = sec.treatmentGiven.map(t => `${esc(t.name)}${t.time ? ` (@ ${esc(t.time)})` : ''}`);
        if(sec.treatmentGivenFree) arr.push(esc(sec.treatmentGivenFree));
        return arr;
    };
    // Three-state finding rows (L/R/Both = positive, None = explicitly negative, absent = not assessed)
    function findingsHtml(findings, opts, label) {
        const positive = findings.filter(f => f.s !== 'None');
        const negative = findings.filter(f => f.s === 'None').map(f => f.f);
        const assessed = findings.map(f => f.f);
        const unassessed = opts.filter(o => !assessed.includes(o));
        if(unassessed.length === opts.length) return `   ${label}: ${NA}.<br>`;
        let out = '';
        if(positive.length) out += `   ${B(label + ':')} ${positive.map(f => `${esc(f.f)} (${esc(f.s)})`).join(', ')}.<br>`;
        if(negative.length) out += `   <em>${label} — Negative:</em> No ${negative.map(n => esc(n).toLowerCase()).join(', ')}.<br>`;
        if(unassessed.length) out += `   <em>${label} — Not assessed:</em> ${unassessed.map(n => esc(n).toLowerCase()).join(', ')}.<br>`;
        return out;
    }
    const gasLine = (v) => {
        const fields = [['pH','ph'],['pCO2','pco2'],['pO2','po2'],['HCO3','hco3'],['BE','be'],['Lac','lac'],['Ca','ca']];
        return fields.filter(([, k]) => v[k] !== '' && v[k] !== undefined).map(([l, k]) => `${l} ${esc(v[k])}`).join(' | ');
    };

    function updateNotes() {
        const p = patientData;
        updateDeptClock();
        updateTrendArrows();

        let calcHtml = "";
        const calcDisplay = getEl('calc_results');
        let calcShown = false;
        const bp = p.circulation.bp || "";
        const hr = parseInt(p.circulation.hr);
        if(bp.includes('/')) {
            const parts = bp.split('/');
            const sys = parseInt(parts[0]);
            const dia = parseInt(parts[1]);
            if(!isNaN(sys) && !isNaN(dia)) {
                const map = Math.round((sys + (2*dia))/3);
                let siStr = "";
                let siColour = '';
                if(!isNaN(hr) && sys > 0) {
                    const si = (hr/sys).toFixed(2);
                    if(parseFloat(si) >= 1.0) siColour = 'color:#dc2626;font-weight:bold;';
                    else if(parseFloat(si) >= 0.7) siColour = 'color:#d97706;font-weight:bold;';
                    siStr = ` | <span style="${siColour}">SI: ${si}</span>`;
                    calcHtml = ` (MAP ${map} | SI: ${si})`;
                } else {
                    calcHtml = ` (MAP ${map})`;
                }
                calcDisplay.innerHTML = `MAP: ${map} mmHg${siStr}`;
                calcDisplay.classList.remove('hidden');
                calcShown = true;
            }
        }
        if(!calcShown) { calcDisplay.innerHTML = ''; calcDisplay.classList.add('hidden'); }

        // --- PRIMARY SURVEY HTML ---
        const noteStamp = getDateTime();
        let h = `${B('Major Trauma Assessment')} <span style="font-size:0.85em;color:#64748b;">(Note generated: ${noteStamp})</span><br>`;
        const zpsDone = [];
        if(p.zero.self) zpsDone.push('Self check');
        if(p.zero.leader) zpsDone.push('Leader identified');
        if(p.zero.roles) zpsDone.push('Roles allocated');
        if(p.zero.brief) zpsDone.push('Briefing complete');
        if(p.zero.env) zpsDone.push('Environment ready');
        if(p.zero.ppe) zpsDone.push('PPE donned');
        if(zpsDone.length > 0) h += `Zero Point Survey: ${zpsDone.join(', ')}.<br>`;
        if(p.zero.notes) h += `Pre-arrival notes: ${nl2br(p.zero.notes)}<br>`;
        h += `Patient Arrival Time: ${p.arrival.time ? B(esc(p.arrival.time)) : NR}<br>`;

        const specs = p.arrival.specialties.map(s => `${esc(s.name)} (@ ${esc(s.time)})`);
        if(specs.length) h += `Specialties Present: ${specs.join(', ')}<br>`;

        h += `<br>${B('ATMIST')}<br>`;
        if (p.atmist.paramedicHandover) h += `Handover / History: ${nl2br(p.atmist.paramedicHandover)}<br>`;
        h += `Age: ${p.atmist.age ? `${esc(p.atmist.age)}${p.atmist.ageEst ? ' (Est)' : ''}` : NR} | Time of Incident: ${orNR(p.atmist.time)}<br>`;
        h += `Mechanism: ${orNR(p.atmist.mech)}<br>Injuries Suspected: ${orNR(p.atmist.inj)}<br>Signs: ${orNR(p.atmist.signs)}<br>`;

        const phInterventions = p.atmist.phTreatments.map(esc);
        if(p.atmist.phTreatmentsFree) phInterventions.push(esc(p.atmist.phTreatmentsFree));
        if(phInterventions.length > 0) h += `Pre-Hosp Interventions: ${phInterventions.join(', ')}<br>`;

        const phDrugsList = p.atmist.phDrugs.map(d => `${esc(d.name)}${d.time ? ` (@ ${esc(d.time)})` : ''}`);
        if(p.atmist.phDrugsFree) phDrugsList.push(esc(p.atmist.phDrugsFree));
        if(phDrugsList.length > 0) h += `Pre-Hosp Medications: ${phDrugsList.join(', ')}<br>`;

        if(p.atmist.safeguarding !== 'No Concern') h += `${B(`⚠️ ${esc(p.atmist.safeguarding)}`)}<br>`;
        if(p.atmist.pregnancy !== 'Not Applicable') h += `Pregnancy Status: ${esc(p.atmist.pregnancy)}<br>`;

        if(p.prehosp.notes) h += `Pre-Hospital Notes: ${nl2br(p.prehosp.notes)}<br>`;
        const allergy = p.prehosp.history.a;
        const allergyStyle = (allergy && !/^\s*nkda\s*$/i.test(allergy)) ? 'color:#dc2626;font-weight:bold;' : '';
        h += `AMPLE: <span style="${allergyStyle}">A: ${orNR(allergy)}</span> | M: ${orNR(p.prehosp.history.m)} | P: ${orNR(p.prehosp.history.p)} | L: ${orNR(p.prehosp.history.l)} | E: ${orNR(p.prehosp.history.e)}<br>`;

        h += `<br>${B('PRIMARY SURVEY')}<br>`;

        // Airway
        const realAdjuncts = p.airway.adjuncts.filter(a => a !== 'None');
        h += `${B('Airway:')} ${p.airway.status ? esc(p.airway.status) : NA}`;
        if(p.airway.status === 'Patent' && realAdjuncts.length > 0) h += " (maintained with adjuncts)";
        h += ". ";
        if(realAdjuncts.length) h += `Adjuncts: ${realAdjuncts.map(esc).join(', ')}. `;
        else if(p.airway.adjuncts.includes('None')) h += `No adjuncts. `;
        if (p.airway.rsi) {
            const r = p.airway.rsiData;
            const rsiParts = [r.size && `Size ${esc(r.size)}`, r.length && `Length ${esc(r.length)}cm`, r.grade && `Grade ${esc(r.grade)}`, r.etco2 && `ETCO2 ${esc(r.etco2)}`].filter(Boolean);
            h += `${B('Pre-Hosp RSI:')} ${rsiParts.length ? rsiParts.join(', ') : 'details not recorded'}.${r.drugs ? ` Drugs: ${esc(r.drugs)}.` : ''} `;
        }
        const cspine = [p.airway.collar && 'Collar', p.airway.blocks && 'Blocks'].filter(Boolean);
        if(cspine.length) h += `C-Spine: ${cspine.join(' + ')}. `;
        if(p.airway.traumaMat) h += `Immobilised in trauma mat (ED). `;
        if(p.airway.notes) h += ` ${nl2br(p.airway.notes)}`;
        h += "<br>";
        const airwayTx = txList(p.airway);
        if(airwayTx.length) h += `   ${B('Treatment Given:')} ${airwayTx.join(', ')}.<br>`;

        // Breathing
        const o2Str = p.breathing.o2 === 'Air' ? 'Air' : (p.breathing.o2 === 'O2' ? `Oxygen${p.breathing.fio2 ? ' ' + esc(p.breathing.fio2) : ''}` : 'O2 status not recorded');
        h += `${B('Breathing:')} RR ${orNR(p.breathing.rr)} | Sats ${orNR(p.breathing.sats, '%')} (${o2Str}).<br>`;
        h += findingsHtml(p.breathing.findings, BREATHING_OPTS, 'Chest Findings');
        if(p.breathing.notes) h += `   ${nl2br(p.breathing.notes)}<br>`;
        const breathingTx = txList(p.breathing);
        if(breathingTx.length) h += `   ${B('Treatment Given:')} ${breathingTx.join(', ')}.<br>`;

        // Circulation
        h += `${B('Circulation:')} HR ${orNR(p.circulation.hr)} | BP ${orNR(p.circulation.bp)}${calcHtml} | CRT ${orNR(p.circulation.crt, 's')}.<br>`;
        if(p.circulation.txa && p.circulation.txa !== 'None') h += `   ${B('TXA Given:')} ${esc(p.circulation.txa)}${p.circulation.txaTime ? ` (@ ${esc(p.circulation.txaTime)}${elapsedStr(p.arrival.time, p.circulation.txaTime)})` : ''}.<br>`;

        const validLines = p.circulation.lines.filter(l => l.type || l.location || l.locationDetail || l.size).map(l => {
            const site = [l.location, l.locationDetail].filter(Boolean).map(esc).join(' - ');
            return `${l.type ? esc(l.type) : 'Line (type not recorded)'}${l.size ? ' ' + esc(l.size) : ''}${site ? ` (${site})` : ''}`;
        });
        if(validLines.length) h += `   Access: ${validLines.join(', ')}.<br>`;

        h += findingsHtml(p.circulation.bodyFindings, BODY_REGION_OPTS, 'Injury/Bleeding Screen');

        const interventions = [];
        if(p.circulation.binder) interventions.push(`Pelvic Binder${p.circulation.binderTime ? ` (@ ${esc(p.circulation.binderTime)}${elapsedStr(p.arrival.time, p.circulation.binderTime)})` : ''}`);
        if(p.circulation.ktd) interventions.push(`KTD Splint${p.circulation.ktdTime ? ` (@ ${esc(p.circulation.ktdTime)}${elapsedStr(p.arrival.time, p.circulation.ktdTime)})` : ''}`);
        if(p.circulation.tourniquet) interventions.push(`Tourniquet${p.circulation.tourniquetTime ? ` (@ ${esc(p.circulation.tourniquetTime)}${elapsedStr(p.arrival.time, p.circulation.tourniquetTime)})` : ''}`);
        if(interventions.length) h += `   ${B('Interventions:')} ${interventions.join(', ')}.<br>`;
        if(p.circulation.notes) h += `   ${nl2br(p.circulation.notes)}<br>`;
        const circTx = txList(p.circulation);
        if(circTx.length) h += `   ${B('Treatment Given:')} ${circTx.join(', ')}.<br>`;

        if(p.mhp.activated) {
            h += `   ${B('⚠️ MHP ACTIVATED')} (${p.mhp.time ? esc(p.mhp.time) + elapsedStr(p.arrival.time, p.mhp.time) : 'Time Not Set'})<br>`;
            if(p.mhp.crystalloid !== '' && p.mhp.crystalloid !== undefined) h += `   Crystalloid: ${esc(p.mhp.crystalloid)}ml.<br>`;
            const bpLabels = { rbc: 'RBC', ffp: 'FFP', plt: 'Platelets', cryo: 'Cryo' };
            const bpParts = [];
            Object.keys(bpLabels).forEach(k => {
                const arr = p.mhp.units[k] || [];
                if(arr.length) bpParts.push(`${bpLabels[k]} x${arr.length} (@ ${arr.map(u => esc(u.time) || 'time not recorded').join(', ')})`);
            });
            if(bpParts.length) h += `   ${B('Blood Products:')} ${bpParts.join(', ')}.<br>`;
        }

        // Disability
        const d = p.disability;
        const gcsTot = gcsTotal(d);
        const anyGcs = [d.gcsE, d.gcsV, d.gcsM].some(v => v !== '' && v !== undefined && v !== null);
        const gcsStr = gcsTot !== null ? `${gcsTot} (E${d.gcsE} V${d.gcsV} M${d.gcsM})`
            : (anyGcs ? `incomplete (E${d.gcsE === '' ? '-' : d.gcsE} V${d.gcsV === '' ? '-' : d.gcsV} M${d.gcsM === '' ? '-' : d.gcsM})` : NA);
        h += `${B('Disability:')} AVPU ${d.avpu ? esc(d.avpu) : NA} | GCS ${gcsStr}.<br>`;
        const glucoseVal = parseFloat(d.glucose);
        const glucoseStr = d.glucose ? `${esc(d.glucose)} mmol/L${(!isNaN(glucoseVal) && glucoseVal <= 3.5) ? ' <b style="color:#dc2626">⚠️ HYPOGLYCAEMIA</b>' : ''}` : NR;
        h += `   Pupils: L ${d.pupilL ? esc(d.pupilL) : NA} | R ${d.pupilR ? esc(d.pupilR) : NA}. Blood Glucose: ${glucoseStr}.<br>`;
        if(d.ma4l) h += `   Gross Motor: Moving all 4 limbs.<br>`;
        const disTx = txList(d);
        if(disTx.length) h += `   ${B('Treatment Given:')} ${disTx.join(', ')}.<br>`;
        if(d.headInjury) h += `   ${B('⚠️ Head Injury Suspected')}<br>`;

        // Exposure
        h += `${B('Exposure:')} Temp ${orNR(p.exposure.temp, '°C')}. ${p.exposure.notes ? nl2br(p.exposure.notes) : `Examination: ${NA}.`}<br>`;
        const exposureTx = txList(p.exposure);
        if(exposureTx.length) h += `   ${B('Treatment Given:')} ${exposureTx.join(', ')}.<br>`;

        if (p.obs.length > 0) {
            h += `<br>${B('Serial Observations:')}<br>`;
            const dash = (v) => (v !== '' && v !== undefined && v !== null) ? esc(v) : '-';
            p.obs.forEach(o => {
                let obsLine = `[${dash(o.time)}] HR ${dash(o.hr)} | BP ${dash(o.bp)} | RR ${dash(o.rr)} | SpO2 ${o.spo2 ? esc(o.spo2) + '%' : '-'} (${o.onO2 ? 'O2' : 'Air'}) | Temp ${o.temp ? esc(o.temp) + '°C' : '-'} | GCS ${dash(o.gcs)}`;
                if(o.pupils) obsLine += ` | Pupils ${esc(o.pupils)}`;
                const news = calcNews2(o);
                if(news) obsLine += ` | ${B(`NEWS2: ${news.total}${news.partial ? ' (partial)' : ''} - ${news.band}`)}`;
                h += obsLine + `<br>`;
            });
        }

        let inv = '';
        const gas1 = gasLine(p.investigations.vbg);
        if(gas1) {
            inv += `${esc(p.investigations.gasType)}: ${gas1}`;
            if(p.investigations.gasType === 'ABG' && p.investigations.vbg.abgFio2) inv += ` (FiO2: ${esc(p.investigations.vbg.abgFio2)}%)`;
            inv += `<br>`;
        }

        const ef = p.investigations.efast;
        const efastTxt = [['RUQ','ruq'],['LUQ','luq'],['Pelvis','pelvis'],['Pericardial','pericardial'],['Lung','lung']].filter(([, k]) => ef[k]).map(([l, k]) => `${l} ${esc(ef[k])}`);
        if(efastTxt.length > 0) inv += `eFAST: ${efastTxt.join(', ')}.<br>`;

        if(p.ecg.done || p.ecg.findings) inv += `${B('ECG:')} ${p.ecg.time ? `Done @ ${esc(p.ecg.time)}${elapsedStr(p.arrival.time, p.ecg.time)}. ` : (p.ecg.done ? 'Done. ' : '')}${nl2br(p.ecg.findings || '')}<br>`;

        if(p.investigations.imaging) inv += `${B('Plan/Imaging:')} ${nl2br(p.investigations.imaging)}<br>`;
        if(inv) h += `<br>${B('Investigations & Plan:')}<br>${inv}`;

        const cpLine = (cp, label) => `<br>${B(`Consultant/Reg Review (${label}):`)} Discussed with ${orNR(cp.name)}. Plan Agreed: ${orNR(cp.agreed)}. Signed: ${cp.time ? esc(cp.time) + elapsedStr(p.arrival.time, cp.time) : NR}<br>`;
        if (p.checkpoints.primary.name || p.checkpoints.primary.agreed) h += cpLine(p.checkpoints.primary, 'Primary');
        if(!p._manualEdits.initial) getEl('initialNoteOutput').innerHTML = h;

        // --- SECONDARY SURVEY HTML ---
        let s = `${B('Secondary Survey')} <span style="font-size:0.85em;color:#64748b;">(Note generated: ${noteStamp})</span><br>`;
        s += `<br>`;
        const gas2 = gasLine(p.investigations.vbgSec);
        if(gas2) s += `${B(`Repeat ${esc(p.investigations.secGasType)}:`)} ${gas2}<br><br>`;

        if(p.secondary.visualAcuity.left || p.secondary.visualAcuity.right) {
            s += `${B('Visual Acuity:')} Left: ${p.secondary.visualAcuity.left ? esc(p.secondary.visualAcuity.left) : 'Not tested'}, Right: ${p.secondary.visualAcuity.right ? esc(p.secondary.visualAcuity.right) : 'Not tested'}.<br><br>`;
        }

        if(p.secondary.logroll.done || p.secondary.pr.done) {
            s += `${B('Log Roll & PR Exam:')}<br>`;
            if(p.secondary.logroll.done) s += `Log roll performed. Findings: ${p.secondary.logroll.findings ? esc(p.secondary.logroll.findings) : 'not recorded'}.<br>`;
            if(p.secondary.pr.done) s += `PR exam performed. Findings: ${p.secondary.pr.findings ? esc(p.secondary.pr.findings) : 'not recorded'}.<br>`;
            s += `<br>`;
        }

        SS_AREAS.forEach(area => {
            const data = p.secondary[area.id];
            if(!data) return;
            const hasTags = data.tags.length > 0;
            const hasText = !!data.text;
            s += `${B(area.label + ':')} `;
            if (hasTags) s += `${data.tags.map(esc).join(', ')}. `;
            else if (data.normal) s += `${area.normal} `;
            if (hasText) s += nl2br(data.text);
            if (!hasTags && !hasText && !data.normal) s += `${NA}.`;
            s += `<br>`;
        });

        const ne = p.neuroExam;
        const neuroKeys = ['pul','sul','pur','sur','pll','sll','plr','slr'];
        s += `<br>${B('Neurological Examination:')}`;
        if(neuroKeys.every(k => !ne[k])) {
            s += ` ${NA}.<br>`;
        } else {
            const nv = (k) => ne[k] ? esc(ne[k]) : 'not assessed';
            s += `<br>Upper Limbs: L (Pow ${nv('pul')}, Sen ${nv('sul')}) | R (Pow ${nv('pur')}, Sen ${nv('sur')})<br>`;
            s += `Lower Limbs: L (Pow ${nv('pll')}, Sen ${nv('sll')}) | R (Pow ${nv('plr')}, Sen ${nv('slr')})<br>`;
        }

        if (p.checkpoints.secondary.name || p.checkpoints.secondary.agreed) s += cpLine(p.checkpoints.secondary, 'Secondary');

        s += `<br>${B('Definitive Care Plan')}<br>`;
        if(p.definitive.furtherImaging) s += `Further Imaging Required: ${p.definitive.furtherImagingDetails ? esc(p.definitive.furtherImagingDetails) : 'details not recorded'}<br>`;
        if(p.definitive.tetanus) s += `Tetanus immunisation up-to-date or given.<br>`;
        if(p.definitive.meds.length) s += `Time Critical Meds Prescribed: ${p.definitive.meds.map(esc).join(', ')}<br>`;
        if(p.definitive.disposition) s += `Disposition: ${B(esc(p.definitive.disposition))}<br>`;
        if(p.definitive.plan) s += `${nl2br(p.definitive.plan)}<br>`;

        if(p.problemList) s += `<br>${B('Problem List')}<br>${nl2br(p.problemList)}`;
        if(!p._manualEdits.secondary) getEl('secondaryNoteOutput').innerHTML = s;

        saveState();
    }

    // --- COPY FUNCTION ---
    // Pre-built Unicode bold map (built once, not per-call)
    const BOLD_MAP = (() => {
        const m = {};
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((c,i) => m[c] = String.fromCodePoint(0x1D400+i));
        'abcdefghijklmnopqrstuvwxyz'.split('').forEach((c,i) => m[c] = String.fromCodePoint(0x1D41A+i));
        '0123456789'.split('').forEach((c,i) => m[c] = String.fromCodePoint(0x1D7CE+i));
        return m;
    })();

    function boldify(str) {
        return str.split('').map(c => BOLD_MAP[c] || c).join('');
    }

    // Walk the live DOM to extract plain text — the browser handles all entity
    // decoding and tag stripping automatically, with no regex fragility.
    function domToPlainBold(el) {
        let out = '';
        function walk(node, inBold) {
            if (node.nodeType === Node.TEXT_NODE) {
                out += inBold ? boldify(node.textContent) : node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName;
                const nowBold = inBold || tag === 'B' || tag === 'STRONG';
                if (tag === 'BR') { out += '\n'; return; }
                node.childNodes.forEach(child => walk(child, nowBold));
            }
        }
        el.childNodes.forEach(child => walk(child, false));
        // Collapse excessive blank lines (>2 in a row)
        return out.replace(/\n{3,}/g, '\n\n').trim();
    }

    async function copyRichText(id) {
        const el = getEl(id);
        const btn = id === 'initialNoteOutput' ? getEl('copyInitial') : getEl('copySecondary');
        const showSuccess = () => {
            const orig = btn.textContent;
            btn.textContent = '✅ Copied!';
            btn.classList.add('bg-green-600', 'hover:bg-green-700');
            btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            setTimeout(() => {
                btn.textContent = orig;
                btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
                btn.classList.remove('bg-green-600', 'hover:bg-green-700');
            }, 2000);
        };
        const plainText = domToPlainBold(el);
        try {
            const htmlBlob = new Blob([el.innerHTML], { type: 'text/html' });
            const textBlob = new Blob([plainText], { type: 'text/plain' });
            await navigator.clipboard.write([
                new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
            ]);
            showSuccess();
        } catch (err) {
            // Fallback 1: writeText with Unicode bold
            try {
                await navigator.clipboard.writeText(plainText);
                showSuccess();
            } catch(e2) {
                // Fallback 2: execCommand
                try {
                    const ta = document.createElement('textarea');
                    ta.value = plainText;
                    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    showSuccess();
                } catch(e3) { alert('Copy failed — please select and copy the text manually.'); }
            }
        }
    }

    getEl('copyInitial').addEventListener('click', () => copyRichText('initialNoteOutput'));
    getEl('copySecondary').addEventListener('click', () => copyRichText('secondaryNoteOutput'));

    // --- LISTENERS ---
    const bind = (id, obj, key) => { const el = getEl(id); if(el) el.addEventListener('input', e => { obj[key] = e.target.value; updateNotes(); }); };
    const bindSel = (id, obj, key) => { const el = getEl(id); if(el) el.addEventListener('change', e => { obj[key] = e.target.value; updateNotes(); }); };
    const bindCheck = (id, obj, key) => { const el = getEl(id); if(el) el.addEventListener('change', e => { obj[key] = e.target.checked; updateNotes(); }); };

    // The editable arrival time lives outside the button, so clicking into it can never re-stamp arrival as "now"
    getEl('btn-arrival-now').addEventListener('click', () => {
        const t = getTime();
        patientData.arrival.time = t;
        showArrivalTime(t);
        updateNotes();
    });
    getEl('arrival_time').addEventListener('input', e => { patientData.arrival.time = e.target.value; updateNotes(); });

    const specInput = getEl('customSpecInput');
    const specBtn = getEl('btnAddSpec');
    const handleAddSpec = () => { const val = specInput.value.trim(); if(val) { addSpecialty(val, false); specInput.value = ''; }};
    specBtn.addEventListener('click', handleAddSpec);
    specInput.addEventListener('keypress', e => { if(e.key === 'Enter') handleAddSpec(); });

    document.querySelectorAll('input[name="airwayStatus"]').forEach(r => r.addEventListener('change', e => { patientData.airway.status = e.target.value; updateNotes(); }));
    document.querySelectorAll('input[name="breathing_o2"]').forEach(r => r.addEventListener('change', e => { 
        patientData.breathing.o2 = e.target.value; 
        getEl('fio2_container').classList.toggle('hidden', e.target.value === 'Air');
        if(e.target.value === 'Air') patientData.breathing.fio2 = ''; 
        updateNotes(); 
    }));

    document.querySelectorAll('.time-btn').forEach(btn => btn.addEventListener('click', e => {
        const type = e.target.dataset.for;
        const checkpoint = e.target.dataset.checkpoint;
        if (checkpoint) {
            const time = getTime();
            patientData.checkpoints[checkpoint].time = time;
            e.target.innerText = time;
            e.target.classList.add('recorded');
            updateNotes();
            return;
        }
        if(type === 'Binder' || type === 'KTD' || type === 'Tourniquet') {
            const prop = type.toLowerCase();
            patientData.circulation[prop] = true;
            patientData.circulation[`${prop}Time`] = getTime();
            toggleAccessBtn(type, true);
            updateTimeBtn(type, true, patientData.circulation[`${prop}Time`]);
        } else if (e.target.id === 'btn-txa-now') {
            const t = getTime();
            patientData.circulation.txaTime = t;
            e.target.classList.add('recorded');
            e.target.innerText = t;
        } else if (e.target.id === 'btn-ecg-now') {
            const t = getTime();
            patientData.ecg.time = t;
            patientData.ecg.done = true;
            getEl('ecg_done').checked = true;
            e.target.classList.add('recorded');
            e.target.innerText = t;
        }
        updateNotes();
    }));

    document.querySelectorAll('.std-btn').forEach(btn => btn.addEventListener('click', e => {
        if(e.target.dataset.spec) addSpecialty(e.target.dataset.spec, true);
        if(e.target.dataset.adj) {
            e.target.classList.toggle('active');
            const adj = e.target.dataset.adj;
            if(adj === 'None') patientData.airway.adjuncts = e.target.classList.contains('active') ? ['None'] : [];
            else {
                patientData.airway.adjuncts = patientData.airway.adjuncts.filter(x => x !== 'None');
                if(patientData.airway.adjuncts.includes(adj)) patientData.airway.adjuncts = patientData.airway.adjuncts.filter(x => x !== adj);
                else patientData.airway.adjuncts.push(adj);
            }
            if(adj === 'None') document.querySelectorAll('[data-adj]').forEach(b => { if(b.dataset.adj !== 'None') b.classList.remove('active') });
            else document.querySelector('[data-adj="None"]').classList.remove('active');
            updateNotes();
        }
    }));

    bContainer.addEventListener('click', e => {
        if(e.target.classList.contains('lr-btn')) {
            e.preventDefault();
            const { f, s } = e.target.dataset;
            const existingIdx = patientData.breathing.findings.findIndex(x => x.f === f);
            const wasThisActive = existingIdx > -1 && patientData.breathing.findings[existingIdx].s === s;
            // Each finding row is mutually exclusive: None / L / R / Both
            document.querySelectorAll(`.lr-btn[data-f="${f}"]`).forEach(b => b.classList.remove('active'));
            if(existingIdx > -1) patientData.breathing.findings.splice(existingIdx, 1);
            if(!wasThisActive) {
                patientData.breathing.findings.push({f, s});
                e.target.classList.add('active');
            }
            updateNotes();
        }
    });

    circBodyContainer.addEventListener('click', e => {
        if(e.target.classList.contains('lr-btn')) {
            e.preventDefault();
            const { f, s } = e.target.dataset;
            const existingIdx = patientData.circulation.bodyFindings.findIndex(x => x.f === f);
            const wasThisActive = existingIdx > -1 && patientData.circulation.bodyFindings[existingIdx].s === s;
            document.querySelectorAll(`#circ_body_findings .lr-btn[data-f="${f}"]`).forEach(b => b.classList.remove('active'));
            if(existingIdx > -1) patientData.circulation.bodyFindings.splice(existingIdx, 1);
            if(!wasThisActive) {
                patientData.circulation.bodyFindings.push({f, s});
                e.target.classList.add('active');
            }
            updateNotes();
        }
    });

    getEl('btnNoInjurySites').addEventListener('click', () => {
        patientData.circulation.bodyFindings = BODY_REGION_OPTS.map(opt => ({ f: opt, s: 'None' }));
        document.querySelectorAll('#circ_body_findings .lr-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#circ_body_findings .lr-btn[data-s="None"]').forEach(b => b.classList.add('active'));
        updateNotes();
    });

    // --- PRE-HOSPITAL MEDICATIONS (timestamped) ---
    function renderPhDrugs() {
        const container = getEl('activePhDrugsList');
        if(!container) return;
        container.innerHTML = '';
        if(patientData.atmist.phDrugs.length === 0) {
            container.innerHTML = '<span class="text-xs text-slate-400 italic self-center">No pre-hospital medications recorded yet.</span>';
            return;
        }
        patientData.atmist.phDrugs.forEach((d, i) => {
            const div = document.createElement('div');
            div.className = 'spec-chip';
            div.innerHTML = `${esc(d.name)} <input type="time" class="ph-drug-time-edit" title="Time given (enter from handover)" value="${esc(d.time||'')}" onchange="updatePhDrugTime(${i}, this.value)">`;
            const remBtn = document.createElement('button');
            remBtn.innerHTML = '&times;';
            remBtn.onclick = () => removePhDrug(i);
            div.appendChild(remBtn);
            container.appendChild(div);
        });
    }

    window.updatePhDrugTime = function(index, value) {
        patientData.atmist.phDrugs[index].time = value;
        updateNotes();
    };

    function removePhDrug(index) {
        const removed = patientData.atmist.phDrugs[index];
        patientData.atmist.phDrugs.splice(index, 1);
        const btn = document.querySelector(`.drug-btn[data-d="${removed.name}"]`);
        if(btn) btn.classList.remove('active');
        renderPhDrugs();
        updateNotes();
        showUndoToast(`Removed ${removed.name}`, () => {
            patientData.atmist.phDrugs.splice(index, 0, removed);
            const btn2 = document.querySelector(`.drug-btn[data-d="${removed.name}"]`);
            if(btn2) btn2.classList.add('active');
            renderPhDrugs();
            updateNotes();
        });
    }

    // --- BLOOD PRODUCTS (MHP running list, tally & Calcium reminder) ---
    const BLOOD_LABELS = { rbc: 'RBC', ffp: 'FFP', plt: 'Platelets', cryo: 'Cryo' };
    function renderBloodProducts() {
        const tallyEl = getEl('bloodTally');
        const listEl = getEl('bloodProductsList');
        if(!tallyEl || !listEl) return;
        const units = patientData.mhp.units;
        let total = 0;
        tallyEl.innerHTML = '';
        Object.keys(BLOOD_LABELS).forEach(k => {
            const count = (units[k] || []).length;
            total += count;
            const div = document.createElement('div');
            div.className = 'bg-white border border-red-300 rounded p-2';
            div.textContent = `${BLOOD_LABELS[k]}: ${count} unit${count === 1 ? '' : 's'}`;
            tallyEl.appendChild(div);
        });

        listEl.innerHTML = '';
        Object.keys(BLOOD_LABELS).forEach(k => {
            (units[k] || []).forEach((u, i) => {
                const chip = document.createElement('div');
                chip.className = 'blood-chip';
                chip.innerHTML = `${BLOOD_LABELS[k]}<span class="time">@ ${u.time}</span>`;
                const remBtn = document.createElement('button');
                remBtn.innerHTML = '&times;';
                remBtn.onclick = () => removeBloodUnit(k, i);
                chip.appendChild(remBtn);
                listEl.appendChild(chip);
            });
        });

        const reminder = getEl('calciumReminder');
        if(reminder) reminder.classList.toggle('hidden', total === 0 || total % 2 !== 0);
    }

    function removeBloodUnit(product, index) {
        const removed = patientData.mhp.units[product][index];
        patientData.mhp.units[product].splice(index, 1);
        renderBloodProducts();
        updateNotes();
        showUndoToast(`Removed ${BLOOD_LABELS[product] || product} unit`, () => {
            patientData.mhp.units[product].splice(index, 0, removed);
            renderBloodProducts();
            updateNotes();
        });
    }

    // --- GENERIC TIMESTAMPED TREATMENT LISTS (Circulation / Disability "Treatment Given") ---
    // dataArrayGetter() returns the live array (patientData.circulation.treatmentGiven etc.)
    const TREATMENT_LISTS = {}; // registry: listContainerId -> { getArray, btnSelector }

    function renderTreatmentList(listContainerId) {
        const reg = TREATMENT_LISTS[listContainerId];
        const container = getEl(listContainerId);
        if(!container || !reg) return;
        const arr = reg.getArray();
        container.innerHTML = '';
        if(arr.length === 0) {
            container.innerHTML = `<span class="text-xs text-slate-400 italic self-center">${reg.emptyText}</span>`;
            return;
        }
        arr.forEach((d, i) => {
            const div = document.createElement('div');
            div.className = 'treat-chip';
            div.innerHTML = `${esc(d.name)} <input type="time" class="ph-drug-time-edit" value="${esc(d.time||'')}" onchange="window._updateTreatmentTime('${listContainerId}', ${i}, this.value)">`;
            const remBtn = document.createElement('button');
            remBtn.innerHTML = '&times;';
            remBtn.onclick = () => {
                const removedItem = arr[i];
                const removedIndex = i;
                arr.splice(i, 1);
                const btn = document.querySelector(`${reg.btnSelector}[data-tx="${removedItem.name}"]`);
                if(btn) btn.classList.remove('active');
                renderTreatmentList(listContainerId);
                updateNotes();
                showUndoToast(`Removed ${removedItem.name}`, () => {
                    arr.splice(removedIndex, 0, removedItem);
                    const btn2 = document.querySelector(`${reg.btnSelector}[data-tx="${removedItem.name}"]`);
                    if(btn2) btn2.classList.add('active');
                    renderTreatmentList(listContainerId);
                    updateNotes();
                });
            };
            div.appendChild(remBtn);
            container.appendChild(div);
        });
    }

    window._updateTreatmentTime = function(listContainerId, index, value) {
        const reg = TREATMENT_LISTS[listContainerId];
        if(!reg) return;
        reg.getArray()[index].time = value;
        updateNotes();
    };

    function initTreatmentList(btnsContainerId, listContainerId, getArray, emptyText, freeTextId) {
        const btnSelector = `#${btnsContainerId} .treat-btn`;
        TREATMENT_LISTS[listContainerId] = { getArray, btnSelector, emptyText };
        const btnsContainer = getEl(btnsContainerId);
        if(!btnsContainer) return;
        const noneBtn = btnsContainer.querySelector('.treat-btn-none');
        if(noneBtn) {
            noneBtn.addEventListener('click', () => {
                btnsContainer.querySelectorAll('.treat-btn').forEach(b => b.classList.remove('active'));
                getArray().length = 0;
                if(freeTextId) {
                    const fEl = getEl(freeTextId);
                    if(fEl) { fEl.value = 'None'; fEl.dispatchEvent(new Event('input', { bubbles: true })); }
                }
                renderTreatmentList(listContainerId);
                updateNotes();
            });
        }
        btnsContainer.querySelectorAll('.treat-btn').forEach(btn => btn.addEventListener('click', e => {
            e.target.classList.toggle('active');
            const name = e.target.dataset.tx;
            const arr = getArray();
            const isActive = e.target.classList.contains('active');
            if(isActive) {
                arr.push({ name, time: getTime() });
                if(freeTextId) {
                    const fEl = getEl(freeTextId);
                    if(fEl && fEl.value.trim() === 'None') { fEl.value = ''; fEl.dispatchEvent(new Event('input', { bubbles: true })); }
                }
            }
            else { const idx = arr.findIndex(x => x.name === name); if(idx > -1) arr.splice(idx, 1); }
            renderTreatmentList(listContainerId);
            updateNotes();
        }));
        renderTreatmentList(listContainerId);
    }

    initPhraseButtons('mechanism_btns', 'mechanism');

    initTreatmentList('circ_treatment_btns', 'circ_treatment_list', () => patientData.circulation.treatmentGiven, 'No circulation treatment recorded yet.', 'circ_treatmentGivenFree');
    initTreatmentList('disability_treatment_btns', 'disability_treatment_list', () => patientData.disability.treatmentGiven, 'No disability treatment recorded yet.', 'disability_treatmentGivenFree');
    initTreatmentList('airway_treatment_btns', 'airway_treatment_list', () => patientData.airway.treatmentGiven, 'No airway treatment recorded yet.', 'airway_treatmentGivenFree');
    initTreatmentList('breathing_treatment_btns', 'breathing_treatment_list', () => patientData.breathing.treatmentGiven, 'No breathing treatment recorded yet.', 'breathing_treatmentGivenFree');
    initTreatmentList('exposure_treatment_btns', 'exposure_treatment_list', () => patientData.exposure.treatmentGiven, 'No exposure treatment recorded yet.', 'exposure_treatmentGivenFree');

    document.querySelectorAll('.access-btn').forEach(btn => btn.addEventListener('click', e => {
        e.target.classList.toggle('active');
        const txt = e.target.dataset.text;
        const isActive = e.target.classList.contains('active');
        [['Binder', 'binder'], ['KTD', 'ktd'], ['Tourniquet', 'tourniquet']].forEach(([type, prop]) => {
            if(!txt.includes(type)) return;
            patientData.circulation[prop] = isActive;
            if(isActive && !patientData.circulation[`${prop}Time`]) patientData.circulation[`${prop}Time`] = getTime();
            if(!isActive) patientData.circulation[`${prop}Time`] = '';
            updateTimeBtn(type, isActive, patientData.circulation[`${prop}Time`]);
        });
        updateNotes();
    }));

    document.querySelectorAll('.ph-btn').forEach(btn => btn.addEventListener('click', e => {
        e.target.classList.toggle('active');
        const t = e.target.dataset.t;
        if(patientData.atmist.phTreatments.includes(t)) patientData.atmist.phTreatments = patientData.atmist.phTreatments.filter(x => x !== t);
        else patientData.atmist.phTreatments.push(t);
        updateNotes();
    }));

    document.querySelectorAll('.drug-btn').forEach(btn => btn.addEventListener('click', e => {
        e.target.classList.toggle('active');
        const d = e.target.dataset.d;
        const isActive = e.target.classList.contains('active');
        if(isActive) patientData.atmist.phDrugs.push({ name: d, time: '' });
        else patientData.atmist.phDrugs = patientData.atmist.phDrugs.filter(x => x.name !== d);
        renderPhDrugs();
        updateNotes();
    }));
    
    bindCheck('zps_self', patientData.zero, 'self');
    bindCheck('zps_leader', patientData.zero, 'leader');
    bindCheck('zps_roles', patientData.zero, 'roles');
    bindCheck('zps_brief', patientData.zero, 'brief');
    bindCheck('zps_env', patientData.zero, 'env');
    bindCheck('zps_ppe', patientData.zero, 'ppe');
    bind('zps_notes', patientData.zero, 'notes');

    getEl('btnZpsCompleteAll').addEventListener('click', () => {
        ['self','leader','roles','brief','env','ppe'].forEach(key => { patientData.zero[key] = true; });
        ['zps_self','zps_leader','zps_roles','zps_brief','zps_env','zps_ppe'].forEach(id => { getEl(id).checked = true; });
        updateNotes();
    });

    bind('paramedicHandover', patientData.atmist, 'paramedicHandover');
    bind('age', patientData.atmist, 'age');
    bindCheck('ageEstimated', patientData.atmist, 'ageEst');
    bind('timeOfIncident', patientData.atmist, 'time');
    bind('mechanism', patientData.atmist, 'mech');
    bind('injuries', patientData.atmist, 'inj');
    bind('signs', patientData.atmist, 'signs');
    bind('ph_treatments_free', patientData.atmist, 'phTreatmentsFree');
    bind('ph_drugs_free', patientData.atmist, 'phDrugsFree');
    bindSel('safeguarding', patientData.atmist, 'safeguarding');
    bindSel('pregnancy', patientData.atmist, 'pregnancy');
    
    bind('preHospitalOther', patientData.prehosp, 'notes');
    ['a','m','p','l','e'].forEach(k => bind(`history_${k}`, patientData.prehosp.history, k));
    
    // Single listener handles data + UI (no double-fire)
    getEl('preHospitalRSI').addEventListener('change', e => {
        patientData.airway.rsi = e.target.checked;
        getEl('rsiDetails').classList.toggle('hidden', !e.target.checked);
        updateNotes();
    });
    ['size','length','grade','etco2','drugs'].forEach(k => bind(`rsi_${k}`, patientData.airway.rsiData, k));
    
    bindCheck('cspine_collar', patientData.airway, 'collar');
    bindCheck('cspine_blocks', patientData.airway, 'blocks');
    bindCheck('cspine_traumaMat', patientData.airway, 'traumaMat');
    bind('airway_notes', patientData.airway, 'notes');
    bind('airway_treatmentGivenFree', patientData.airway, 'treatmentGivenFree');
    
    bind('breathing_rr', patientData.breathing, 'rr');
    getEl('breathing_rr').addEventListener('input', e => {
        const v = parseInt(e.target.value);
        const el = getEl('rr_alert');
        if(!el) return;
        if(isNaN(v) || e.target.value === '') { el.classList.add('hidden'); return; }
        if(v < 8) { el.textContent = '⚠️ Severe Bradypnoea'; el.style.color = '#dc2626'; el.classList.remove('hidden'); }
        else if(v <= 11) { el.textContent = '↓ Bradypnoea'; el.style.color = '#d97706'; el.classList.remove('hidden'); }
        else if(v > 24) { el.textContent = '⚠️ Severe Tachypnoea'; el.style.color = '#dc2626'; el.classList.remove('hidden'); }
        else if(v >= 21) { el.textContent = '↑ Tachypnoea'; el.style.color = '#d97706'; el.classList.remove('hidden'); }
        else { el.classList.add('hidden'); }
    });
    bind('breathing_sats', patientData.breathing, 'sats');
    getEl('breathing_sats').addEventListener('input', e => {
        const v = parseInt(e.target.value);
        const el = getEl('sats_alert');
        if(!el) return;
        if(isNaN(v) || e.target.value === '') { el.classList.add('hidden'); return; }
        if(v < 90) { el.textContent = '⚠️ Severe Hypoxia'; el.style.color = '#dc2626'; el.classList.remove('hidden'); }
        else if(v <= 93) { el.textContent = '↓ Hypoxia'; el.style.color = '#d97706'; el.classList.remove('hidden'); }
        else { el.classList.add('hidden'); }
    });
    bind('breathing_fio2', patientData.breathing, 'fio2');
    bind('breathing_notes', patientData.breathing, 'notes');
    bind('breathing_treatmentGivenFree', patientData.breathing, 'treatmentGivenFree');
    
    bind('circ_hr', patientData.circulation, 'hr');
    getEl('circ_hr').addEventListener('input', e => {
        const v = parseInt(e.target.value);
        const el = getEl('hr_alert');
        if(!el) return;
        if(isNaN(v) || e.target.value === '') { el.classList.add('hidden'); return; }
        if(v < 40) { el.textContent = '⚠️ Bradycardia'; el.style.color = '#dc2626'; el.classList.remove('hidden'); }
        else if(v > 150) { el.textContent = '⚠️ Tachycardia'; el.style.color = '#dc2626'; el.classList.remove('hidden'); }
        else if(v > 100) { el.textContent = '↑ Tachycardia'; el.style.color = '#d97706'; el.classList.remove('hidden'); }
        else { el.classList.add('hidden'); }
    });
    bind('circ_bp', patientData.circulation, 'bp');
    getEl('circ_bp').addEventListener('input', e => {
        const parts = e.target.value.split('/');
        const el = getEl('bp_alert');
        if(!el) return;
        if(parts.length !== 2) { el.classList.add('hidden'); return; }
        const sys = parseInt(parts[0]);
        if(isNaN(sys)) { el.classList.add('hidden'); return; }
        if(sys < 90) { el.textContent = '⚠️ Hypotension'; el.style.color = '#dc2626'; el.classList.remove('hidden'); }
        else if(sys > 200) { el.textContent = '⚠️ Hypertension'; el.style.color = '#dc2626'; el.classList.remove('hidden'); }
        else { el.classList.add('hidden'); }
    });
    bind('circ_capRefill', patientData.circulation, 'crt');
    bind('circ_notes', patientData.circulation, 'notes');
    bind('circ_treatmentGivenFree', patientData.circulation, 'treatmentGivenFree');
    bind('disability_treatmentGivenFree', patientData.disability, 'treatmentGivenFree');
    document.querySelectorAll('input[name="txaGiven"]').forEach(r => r.addEventListener('change', e => { 
        patientData.circulation.txa = e.target.value; 
        if(e.target.value !== 'None' && !patientData.circulation.txaTime) {
            const t = getTime();
            patientData.circulation.txaTime = t;
            const tb = getEl('btn-txa-now');
            tb.classList.add('recorded');
            tb.innerText = t;
        }
        updateNotes(); 
    }));

    // Single listener handles data + UI (no double-fire)
    getEl('mhp_activated').addEventListener('change', e => {
            patientData.mhp.activated = e.target.checked;
            getEl('mhpDetails').classList.toggle('hidden', !e.target.checked);
            getEl('mhp_time').classList.toggle('hidden', !e.target.checked);
            if(e.target.checked && !patientData.mhp.time) {
                patientData.mhp.time = getTime();
                getEl('mhp_time').value = patientData.mhp.time;
            }
            updateNotes();
    });
    bind('mhp_time', patientData.mhp, 'time');
    bind('mhp_crystalloid', patientData.mhp, 'crystalloid');

    document.querySelectorAll('.blood-btn').forEach(btn => btn.addEventListener('click', e => {
        const product = e.currentTarget.dataset.product;
        patientData.mhp.units[product].push({ time: getTime() });
        renderBloodProducts();
        updateNotes();
    }));

    bindCheck('headInjury', patientData.disability, 'headInjury');
    document.querySelectorAll('input[name="disability_avpu"]').forEach(r => r.addEventListener('change', e => { patientData.disability.avpu = e.target.value; updateNotes(); }));
    bind('disability_pupil_left', patientData.disability, 'pupilL');
    bind('disability_pupil_right', patientData.disability, 'pupilR');
    bind('disability_glucose', patientData.disability, 'glucose');
    getEl('disability_glucose').addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        const alert = getEl('glucose_alert');
        if(alert) alert.classList.toggle('hidden', isNaN(v) || v > 3.5);
    });
    bindCheck('disability_ma4l', patientData.disability, 'ma4l');
    
    bind('exposure_temp', patientData.exposure, 'temp');
    getEl('exposure_temp').addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        const el = getEl('temp_alert');
        if(!el) return;
        if(isNaN(v) || e.target.value === '') { el.classList.add('hidden'); return; }
        if(v < 35) { el.textContent = '⚠️ Hypothermia'; el.style.color = '#dc2626'; el.classList.remove('hidden'); }
        else if(v < 36) { el.textContent = '↓ Mild Hypothermia'; el.style.color = '#d97706'; el.classList.remove('hidden'); }
        else if(v >= 39) { el.textContent = '⚠️ High Fever'; el.style.color = '#dc2626'; el.classList.remove('hidden'); }
        else if(v >= 38) { el.textContent = '↑ Fever'; el.style.color = '#d97706'; el.classList.remove('hidden'); }
        else { el.classList.add('hidden'); }
    });
    bind('exposure_notes', patientData.exposure, 'notes');
    bind('exposure_treatmentGivenFree', patientData.exposure, 'treatmentGivenFree');
    
    document.querySelectorAll('input[name="gasType"]').forEach(r => r.addEventListener('change', e => {
        patientData.investigations.gasType = e.target.value;
        getEl('gasFio2Container').classList.toggle('hidden', e.target.value !== 'ABG');
        updateNotes();
    }));
    getEl('gasFio2').addEventListener('input', e => { patientData.investigations.vbg.abgFio2 = e.target.value; updateNotes(); });
    document.querySelectorAll('input[name="secGasType"]').forEach(r => r.addEventListener('change', e => { patientData.investigations.secGasType = e.target.value; updateNotes(); }));

    ['ph','pco2','po2','hco3','be','lactate','ionisedCa'].forEach(k => {
        const map = {lactate:'lac', ionisedCa:'ca'};
        bind(`vbgInitial_${k}`, patientData.investigations.vbg, map[k]||k);
        bind(`vbgSec_${k}`, patientData.investigations.vbgSec, map[k]||k);
    });

    ['ruq', 'luq', 'pelvis', 'pericardial', 'lung'].forEach(k => bindSel(`efast_${k}`, patientData.investigations.efast, k));
    bind('imagingDecisions', patientData.investigations, 'imaging');

    getEl('ecg_done').addEventListener('change', e => {
        patientData.ecg.done = e.target.checked;
        if(e.target.checked && !patientData.ecg.time) {
            const t = getTime();
            patientData.ecg.time = t;
            const btn = getEl('btn-ecg-now');
            btn.classList.add('recorded');
            btn.innerText = t;
        }
        updateNotes();
    });
    bind('ecg_findings', patientData.ecg, 'findings');

    bind('va_left', patientData.secondary.visualAcuity, 'left');
    bind('va_right', patientData.secondary.visualAcuity, 'right');

    bindCheck('logroll_done', patientData.secondary.logroll, 'done');
    bind('logroll_findings', patientData.secondary.logroll, 'findings');
    bindCheck('pr_done', patientData.secondary.pr, 'done');
    bind('pr_findings', patientData.secondary.pr, 'findings');
    
    bind('cp_primary_name', patientData.checkpoints.primary, 'name');
    document.querySelectorAll('input[name="cp_primary_agreed"]').forEach(r => r.addEventListener('change', e => { patientData.checkpoints.primary.agreed = e.target.value; updateNotes(); }));
    
    bind('cp_secondary_name', patientData.checkpoints.secondary, 'name');
    document.querySelectorAll('input[name="cp_secondary_agreed"]').forEach(r => r.addEventListener('change', e => { patientData.checkpoints.secondary.agreed = e.target.value; updateNotes(); }));

    bind('furtherImagingDetails', patientData.definitive, 'furtherImagingDetails');
    getEl('furtherImaging').addEventListener('change', e => {
        patientData.definitive.furtherImaging = e.target.checked;
        getEl('furtherImagingDetails').classList.toggle('hidden', !e.target.checked);
        updateNotes();
    });
    bindCheck('tetanus', patientData.definitive, 'tetanus');
    
    document.querySelectorAll('.med-check').forEach(chk => chk.addEventListener('change', e => {
        if(e.target.checked) patientData.definitive.meds.push(e.target.value);
        else patientData.definitive.meds = patientData.definitive.meds.filter(x => x !== e.target.value);
        updateNotes();
    }));

    document.querySelectorAll('.disp-btn').forEach(btn => btn.addEventListener('click', e => {
        document.querySelectorAll('.disp-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        patientData.definitive.disposition = e.target.dataset.val;
        updateNotes();
    }));
    bind('definitivePlan', patientData.definitive, 'plan');
    bind('problemList', patientData, 'problemList');

    secContainer.addEventListener('input', (e) => {
        const areaId = e.target.dataset.area || e.target.id.replace('ss_', '');
        if (e.target.tagName === 'TEXTAREA') {
            patientData.secondary[areaId].text = e.target.value;
            updateNotes();
        }
    });
    secContainer.addEventListener('change', (e) => {
            const areaId = e.target.dataset.area;
            if (e.target.classList.contains('tag-checkbox') && areaId) {
            const tag = e.target.value;
            if (e.target.checked) {
                patientData.secondary[areaId].tags.push(tag);
                patientData.secondary[areaId].normal = false; // an abnormal finding replaces "Normal"
                updateSsNormalBtn(areaId);
            }
            else patientData.secondary[areaId].tags = patientData.secondary[areaId].tags.filter(t => t !== tag);
            updateNotes();
            }
    });

    getEl('resetData').addEventListener('click', () => {
        if(confirm('Reset form? All data will be lost.')) clearRecordAndReload();
    });

    // Quick Action Listeners
    // "Set Normal" only records normal examination findings. It never removes treatments, interventions,
    // oxygen, C-spine immobilisation or measured values, and asks before overwriting any abnormal finding.
    getEl('btnNormalAirway').addEventListener('click', () => {
        const a = patientData.airway;
        const hasExisting = (a.status && a.status !== 'Patent') || a.adjuncts.some(x => x !== 'None');
        if(hasExisting && !confirm('This will set the airway to Patent with no adjuncts, replacing the current airway status/adjuncts. Continue?')) return;
        a.status = 'Patent';
        a.adjuncts = ['None'];
        document.querySelector('input[name="airwayStatus"][value="Patent"]').checked = true;
        document.querySelectorAll('[data-adj]').forEach(b => b.classList.toggle('active', b.dataset.adj === 'None'));
        updateNotes();
    });

    getEl('btnNormalBreathing').addEventListener('click', () => {
        const hasExisting = patientData.breathing.findings.some(f => f.s && f.s !== 'None');
        if(hasExisting && !confirm('This will clear the positive chest findings already recorded. Continue?')) return;
        patientData.breathing.findings = BREATHING_OPTS.map(opt => ({ f: opt, s: 'None' }));
        document.querySelectorAll('#breathing_findings .lr-btn').forEach(b => b.classList.toggle('active', b.dataset.s === 'None'));
        updateNotes();
    });

    // Appends a canned normal statement to a notes field rather than overwriting what is already there
    function appendCanned(obj, key, elId, canned) {
        const cur = (obj[key] || '').trim();
        if(cur.includes(canned)) return;
        obj[key] = cur ? `${cur}\n${canned}` : canned;
        getEl(elId).value = obj[key];
    }

    getEl('btnNormalCirc').addEventListener('click', () => {
        const hasExisting = patientData.circulation.bodyFindings.some(f => f.s && f.s !== 'None');
        if(hasExisting && !confirm('This will clear the positive injury/bleeding findings already recorded. Continue?')) return;
        patientData.circulation.bodyFindings = BODY_REGION_OPTS.map(opt => ({ f: opt, s: 'None' }));
        document.querySelectorAll('#circ_body_findings .lr-btn').forEach(b => b.classList.toggle('active', b.dataset.s === 'None'));
        appendCanned(patientData.circulation, 'notes', 'circ_notes', 'No external bleeding, abdomen SNT, pelvis symmetrical and appears stable, no long bone deformity.');
        updateNotes();
    });

    getEl('btnNormalDisability').addEventListener('click', () => {
        const d = patientData.disability;
        const NORMAL_PUPIL = 'Equal & reactive';
        const hasExisting = (d.avpu && d.avpu !== 'Alert') ||
            (d.gcsE !== '' && d.gcsE !== 4) || (d.gcsV !== '' && d.gcsV !== 5) || (d.gcsM !== '' && d.gcsM !== 6) ||
            (d.pupilL && d.pupilL !== NORMAL_PUPIL) || (d.pupilR && d.pupilR !== NORMAL_PUPIL);
        if(hasExisting && !confirm('This will replace the AVPU/GCS/pupil findings already recorded with normal values. Continue?')) return;
        d.avpu = 'Alert';
        d.gcsE = 4; d.gcsV = 5; d.gcsM = 6;
        d.pupilL = NORMAL_PUPIL;
        d.pupilR = NORMAL_PUPIL;
        d.ma4l = true;
        const avpuR = document.querySelector('input[name="disability_avpu"][value="Alert"]');
        if(avpuR) avpuR.checked = true;
        { const r = document.querySelector('input[name="disability_gcsE"][value="4"]'); if(r) r.checked = true; }
        { const r = document.querySelector('input[name="disability_gcsV"][value="5"]'); if(r) r.checked = true; }
        { const r = document.querySelector('input[name="disability_gcsM"][value="6"]'); if(r) r.checked = true; }
        getEl('disability_pupil_left').value = NORMAL_PUPIL;
        getEl('disability_pupil_right').value = NORMAL_PUPIL;
        getEl('disability_ma4l').checked = true;
        updateNotes();
    });

    getEl('btnNormalExposure').addEventListener('click', () => {
        appendCanned(patientData.exposure, 'notes', 'exposure_notes', 'Fully exposed. No rashes, skin wounds or bruising not already documented. Skin warm and dry.');
        updateNotes();
    });

    getEl('btnNKDA').addEventListener('click', () => {
        const el = getEl('history_a');
        if(el.value.trim() && !/^\s*nkda\s*$/i.test(el.value) && !confirm(`Replace the recorded allergies ("${el.value}") with NKDA?`)) return;
        el.value = 'NKDA';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    getEl('btnNeuroNormal').addEventListener('click', () => {
        const ne = patientData.neuroExam;
        const abnormal = Object.keys(ne).some(k => ne[k] && ne[k] !== '5/5' && ne[k] !== 'Intact');
        if(abnormal && !confirm('This will replace the abnormal neurological findings already recorded. Continue?')) return;
        Object.keys(ne).forEach(k => {
            ne[k] = k.startsWith('p') ? '5/5' : 'Intact';
            const el = getEl(`neuro_${k}`); if(el) el.value = ne[k];
        });
        updateNotes();
    });

    // --- SECONDARY SURVEY: explicit per-area Normal ---
    secContainer.addEventListener('click', e => {
        const btn = e.target.closest('.ss-normal-btn');
        if(!btn) return;
        const areaId = btn.dataset.area;
        const data = patientData.secondary[areaId];
        if(!data.normal && data.tags.length) {
            if(!confirm(`Clear the abnormal findings ticked for ${btn.dataset.label} and mark it Normal?`)) return;
            data.tags = [];
            document.querySelectorAll(`.tag-checkbox[data-area="${areaId}"]`).forEach(c => { c.checked = false; });
        }
        data.normal = !data.normal;
        updateSsNormalBtn(areaId);
        updateNotes();
    });

    getEl('btnSsRemainingNormal').addEventListener('click', () => {
        const remaining = SS_AREAS.filter(a => { const d = patientData.secondary[a.id]; return !d.normal && !d.tags.length && !d.text; });
        if(remaining.length === 0) return;
        if(!confirm(`Mark these unassessed areas as Normal?\n${remaining.map(a => a.label).join(', ')}`)) return;
        remaining.forEach(a => { patientData.secondary[a.id].normal = true; updateSsNormalBtn(a.id); });
        updateNotes();
    });

    // --- MANUAL EDITS TO THE NOTE PANELS ---
    // Once a note panel is edited by hand it is locked: form changes no longer overwrite it until the
    // clinician explicitly discards the edits.
    ['initial', 'secondary'].forEach(panel => {
        const out = getEl(`${panel}NoteOutput`);
        out.addEventListener('input', () => {
            patientData._manualEdits[panel] = out.innerHTML;
            setEditedBanner(panel, true);
            saveState();
        });
    });
    document.querySelectorAll('.regen-btn').forEach(btn => btn.addEventListener('click', () => {
        if(!confirm('Discard your manual edits to this note and regenerate it from the form?')) return;
        patientData._manualEdits[btn.dataset.panel] = null;
        setEditedBanner(btn.dataset.panel, false);
        updateNotes();
    }));

    // --- RESUME / NEW PATIENT PROMPT ---
    const stripMeta = (obj) => { const { _savedAt, _manualEdits, _version, ...rest } = obj; return JSON.stringify(rest); };
    const PRISTINE = stripMeta(patientData);

    getEl('btnResumeContinue').addEventListener('click', () => getEl('resume-modal').classList.add('hidden'));
    getEl('btnResumeNew').addEventListener('click', () => clearRecordAndReload());

    function maybeShowResumePrompt() {
        if(stripMeta(patientData) === PRISTINE) return;
        const savedAt = patientData._savedAt ? new Date(patientData._savedAt) : null;
        getEl('resume-saved-at').textContent = savedAt && !isNaN(savedAt)
            ? `Last saved ${savedAt.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`
            : 'Last saved time unknown.';
        const bits = [];
        if(patientData.arrival.time) bits.push(`Arrival ${patientData.arrival.time}`);
        if(patientData.atmist.age) bits.push(`Age ${patientData.atmist.age}`);
        if(patientData.atmist.mech) bits.push(patientData.atmist.mech);
        getEl('resume-summary').textContent = bits.length ? bits.join(' · ') : '';
        const old = !savedAt || isNaN(savedAt) || (Date.now() - savedAt.getTime()) > 12 * 3600 * 1000;
        getEl('resume-old-warning').classList.toggle('hidden', !old);
        getEl('resume-modal').classList.remove('hidden');
    }

    loadState();
    maybeShowResumePrompt();
    updateNotes();
});
