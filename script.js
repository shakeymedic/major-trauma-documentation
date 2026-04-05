document.addEventListener('DOMContentLoaded', () => {
    // --- DATA STORE ---
    let patientData = {
        zero: { self: false, leader: false, roles: false, brief: false, env: false, ppe: false, notes: '' },
        arrival: { time: '', specialties: [] },
        atmist: { age: '', ageEst: false, time: '', mech: '', inj: '', signs: '', phTreatments: [], phTreatmentsFree: '', phDrugs: [], phDrugsFree: '', safeguarding: 'No Concern', pregnancy: 'Not Applicable' },
        prehosp: { notes: '', history: {a:'', m:'', p:'', l:'', e:''} },
        airway: { status: 'Patent', rsi: false, rsiData: {size:'', length:'', grade:'', etco2:'', drugs:''}, adjuncts: [], collar: false, blocks: false, notes: '' },
        breathing: { rr: '', sats: '', o2: 'Air', fio2: '', findings: [], notes: '' },
        circulation: { hr: '', bp: '', crt: '', lines: [], bleeding: [], txa: 'None', txaTime: '', binder: false, binderTime: '', ktd: false, ktdTime: '', tourniquet: false, tourniquetTime: '', notes: '' },
        mhp: { activated: false, time: '', crystalloid: '', prbc: '', ffp: '', plt: '', cryo: '' },
        disability: { avpu: 'Alert', headInjury: false, gcsE: 4, gcsV: 5, gcsM: 6, pupilL: '', pupilR: '', glucose: '' },
        exposure: { temp: '', notes: '' },
        obs: [], // Serial Observations
        investigations: { 
            gasType: 'VBG', vbg: {ph:'', pco2:'', po2:'', hco3:'', be:'', lac:'', ca:'', abgFio2:''}, 
            secGasType: 'VBG', vbgSec: {ph:'', pco2:'', po2:'', hco3:'', be:'', lac:'', ca:''},
            efast: { ruq: '', luq: '', pelvis: '', pericardial: '' },
            imaging: '' 
        },
        secondary: { visualAcuity: { left: '', right: '' }, logroll: { done: false, findings: '' }, pr: { done: false, findings: '' } },
        checkpoints: {
            primary: { name: '', agreed: '', time: '' },
            secondary: { name: '', agreed: '', time: '' }
        },
        neuroExam: { pul: '5/5', sul: 'Intact', pur: '5/5', sur: 'Intact', pll: '5/5', sll: 'Intact', plr: '5/5', slr: 'Intact' },
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
    const INJURY_SITES = ['Scalp', 'Face', 'Chest', 'Abdomen', 'Pelvis', 'L Arm', 'R Arm', 'L Leg', 'R Leg', 'Back'];

    const getEl = (id) => document.getElementById(id);
    const getTime = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    // --- LOCAL STORAGE & RESTORE ---
    function saveState() {
        localStorage.setItem('wmebem_trauma_data', JSON.stringify(patientData));
    }

    function loadState() {
        const saved = localStorage.getItem('wmebem_trauma_data');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                patientData = { ...patientData, ...parsed };
                if(!patientData.secondary) patientData.secondary = { visualAcuity: {left:'', right:''} };
                if(!patientData.secondary.visualAcuity) patientData.secondary.visualAcuity = {left:'', right:''};
                if(!patientData.atmist.phDrugs) patientData.atmist.phDrugs = [];
                if(!patientData.atmist.phDrugsFree) patientData.atmist.phDrugsFree = '';
                if(!patientData.atmist.phTreatmentsFree) patientData.atmist.phTreatmentsFree = patientData.atmist.phNotes || '';
                if(!patientData.obs) patientData.obs = [];
                if(!patientData.investigations.efast) patientData.investigations.efast = {ruq:'', luq:'', pelvis:'', pericardial:''};
                if(!patientData.secondary.logroll) patientData.secondary.logroll = {done: false, findings: ''};
                if(!patientData.secondary.pr) patientData.secondary.pr = {done: false, findings: ''};
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

        renderSpecialties();

        setVal('age', p.atmist.age);
        setCheck('ageEstimated', p.atmist.ageEst);
        setVal('timeOfIncident', p.atmist.time);
        setVal('mechanism', p.atmist.mech);
        setVal('injuries', p.atmist.inj);
        setVal('signs', p.atmist.signs);
        p.atmist.phTreatments.forEach(t => { const btn = document.querySelector(`.ph-btn[data-t="${t}"]`); if(btn) btn.classList.add('active'); });
        p.atmist.phDrugs.forEach(d => { const btn = document.querySelector(`.drug-btn[data-d="${d}"]`); if(btn) btn.classList.add('active'); });
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
        setVal('airway_notes', p.airway.notes);

        setVal('breathing_rr', p.breathing.rr);
        setVal('breathing_sats', p.breathing.sats);
        if(p.breathing.o2) {
            const r = document.querySelector(`input[name="breathing_o2"][value="${p.breathing.o2}"]`);
            if(r) r.checked = true;
            if(p.breathing.o2 === 'O2') getEl('fio2_container').classList.remove('hidden');
        }
        setVal('breathing_fio2', p.breathing.fio2);
        setVal('breathing_notes', p.breathing.notes);
        
        setVal('circ_hr', p.circulation.hr);
        setVal('circ_bp', p.circulation.bp);
        setVal('circ_capRefill', p.circulation.crt);
        setVal('circ_notes', p.circulation.notes);
        if(p.circulation.txa) { const r = document.querySelector(`input[name="txaGiven"][value="${p.circulation.txa}"]`); if(r) r.checked = true; }
        p.circulation.lines.forEach(l => { const chk = document.querySelector(`.access-chk[value="${l}"]`); if(chk) chk.checked = true; });
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
        ['crystalloid', 'prbc','ffp','plt','cryo'].forEach(k => setVal(`mhp_${k}`, p.mhp[k]));

        setCheck('headInjury', p.disability.headInjury);
        if(p.disability.avpu) { const r = document.querySelector(`input[name="disability_avpu"][value="${p.disability.avpu}"]`); if(r) r.checked = true; }
        setVal('disability_pupil_left', p.disability.pupilL);
        setVal('disability_pupil_right', p.disability.pupilR);
        setVal('disability_glucose', p.disability.glucose);

        setVal('exposure_temp', p.exposure.temp);
        setVal('exposure_notes', p.exposure.notes);

        renderObs();

        const rGas = document.querySelector(`input[name="gasType"][value="${p.investigations.gasType}"]`);
        if(rGas) rGas.checked = true;
        if(p.investigations.gasType === 'ABG') getEl('gasFio2Container').classList.remove('hidden');
        const rSecGas = document.querySelector(`input[name="secGasType"][value="${p.investigations.secGasType}"]`);
        if(rSecGas) rSecGas.checked = true;

        ['ph','pco2','po2','hco3','be','lac','ca','abgFio2'].forEach(k => { const map = {lac:'lactate', ca:'ionisedCa'}; setVal(`vbgInitial_${map[k]||k}`, p.investigations.vbg[k]); });
        ['ph','pco2','po2','hco3','be','lac','ca'].forEach(k => { const map = {lac:'lactate', ca:'ionisedCa'}; setVal(`vbgSec_${map[k]||k}`, p.investigations.vbgSec[k]); });
        
        ['ruq', 'luq', 'pelvis', 'pericardial'].forEach(k => setVal(`efast_${k}`, p.investigations.efast[k]));
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
            div.innerHTML = `${spec.name}<span class="time">@ ${spec.time}</span>`;
            const remBtn = document.createElement('button');
            remBtn.innerHTML = '&times;';
            remBtn.onclick = () => removeSpecialty(index);
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

    // --- SERIAL OBSERVATIONS ---
    function renderObs() {
        const tbody = getEl('obsBody');
        tbody.innerHTML = '';
        patientData.obs.forEach((o, i) => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-200 bg-white';
            tr.innerHTML = `
                <td class="p-2"><input type="time" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${o.time}" onchange="updateObs(${i}, 'time', this.value)"></td>
                <td class="p-2"><input type="number" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${o.hr}" onchange="updateObs(${i}, 'hr', this.value)"></td>
                <td class="p-2"><input type="text" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${o.bp}" onchange="updateObs(${i}, 'bp', this.value)"></td>
                <td class="p-2"><input type="number" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${o.rr}" onchange="updateObs(${i}, 'rr', this.value)"></td>
                <td class="p-2"><input type="number" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${o.spo2}" onchange="updateObs(${i}, 'spo2', this.value)"></td>
                <td class="p-2"><input type="number" class="w-full px-2 py-1 text-sm border border-slate-300 rounded" value="${o.gcs}" onchange="updateObs(${i}, 'gcs', this.value)"></td>
                <td class="p-2 text-center"><button class="text-red-500 hover:text-red-700 font-bold" onclick="removeObs(${i})">&times;</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.updateObs = function(index, field, value) { patientData.obs[index][field] = value; updateNotes(); };
    window.removeObs = function(index) { patientData.obs.splice(index, 1); renderObs(); updateNotes(); };
    getEl('btnAddObs').addEventListener('click', () => {
        patientData.obs.push({ time: getTime(), hr: '', bp: '', rr: '', spo2: '', gcs: '' });
        renderObs();
        updateNotes();
    });

    // --- BUILD UI COMPONENTS ---
    const bContainer = getEl('breathing_findings');
    BREATHING_OPTS.forEach(opt => {
        bContainer.innerHTML += `
            <div class="flex items-center justify-between bg-slate-50 border border-slate-300 rounded-lg p-2">
                <span class="text-sm font-bold text-slate-700">${opt}</span>
                <div class="flex gap-2">
                    <button class="lr-btn w-12 h-10 rounded-md border-2 border-slate-300 bg-white font-black text-slate-600 hover:bg-slate-100" data-f="${opt}" data-s="L">L</button>
                    <button class="lr-btn w-12 h-10 rounded-md border-2 border-slate-300 bg-white font-black text-slate-600 hover:bg-slate-100" data-f="${opt}" data-s="R">R</button>
                </div>
            </div>`;
    });

    const injContainer = getEl('injury_grid');
    INJURY_SITES.forEach(site => {
        injContainer.innerHTML += `<button class="injury-btn py-2 border-2 rounded-md text-xs font-bold" data-site="${site}">${site}</button>`;
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
        
        div.innerHTML = `<label class="block text-xs font-black text-slate-600 uppercase mb-1">${area.label}</label>${tagsHtml}<textarea id="ss_${area.id}" rows="1" class="w-full px-3 py-2 border border-slate-400 rounded text-sm font-medium" placeholder="Additional details for ${area.label}..."></textarea>`;
        secContainer.appendChild(div);
        if(!patientData.secondary[area.id]) patientData.secondary[area.id] = { tags: [], text: '' };
    });

    const powerOpts = ['5/5', '4/5', '3/5', '2/5', '1/5', '0/5'];
    const sensOpts = ['Intact', 'Reduced', 'Absent', 'Paraesthesia'];
    document.querySelectorAll('.neuro-select').forEach(sel => {
        const isPower = sel.id.includes('neuro_p');
        const opts = isPower ? powerOpts : sensOpts;
        opts.forEach(o => sel.add(new Option(isPower ? `Power ${o}` : o, o)));
        sel.value = isPower ? '5/5' : 'Intact';
        sel.addEventListener('change', e => {
           patientData.neuroExam[sel.id.replace('neuro_', '')] = e.target.value;
           updateNotes();
        });
    });
    const popSel = (id, opts, def) => { const s=getEl(id); opts.forEach(o=>s.add(new Option(o,o))); s.value=def; s.addEventListener('change',e=>{patientData.disability[id.split('_')[1]]=e.target.value; updateNotes();})};
    popSel('disability_gcsE', [4,3,2,1], 4);
    popSel('disability_gcsV', [5,4,3,2,1], 5);
    popSel('disability_gcsM', [6,5,4,3,2,1], 6);

    // --- NOTE GENERATION (RICH TEXT) ---
    function updateNotes() {
        const p = patientData;
        
        let calcHtml = "";
        const bp = p.circulation.bp || "";
        const hr = parseInt(p.circulation.hr);
        if(bp.includes('/')) {
            const parts = bp.split('/');
            const sys = parseInt(parts[0]);
            const dia = parseInt(parts[1]);
            if(!isNaN(sys) && !isNaN(dia)) {
                const map = Math.round((sys + (2*dia))/3);
                let siStr = "";
                if(!isNaN(hr) && sys > 0) siStr = ` | SI: ${(hr/sys).toFixed(2)}`;
                const calcDisplay = getEl('calc_results');
                calcDisplay.innerHTML = `MAP: ${map} mmHg${siStr}`;
                calcDisplay.classList.remove('hidden');
                calcHtml = ` (MAP ${map}${siStr})`;
            }
        }

        // --- PRIMARY SURVEY HTML ---
        let h = `<b style="font-weight: bold;">Major Trauma Assessment</b><br>`;

        if (p.zero.self || p.zero.leader || p.zero.notes) h += `Zero Point Survey (Preparation) Completed.<br>`;
        if(p.arrival.time) h += `Patient Arrival Time: <b style="font-weight: bold;">${p.arrival.time}</b><br>`;
        
        let specs = p.arrival.specialties.map(s => `${s.name} (@ ${s.time})`);
        if(specs.length) h += `Specialties Present: ${specs.join(', ')}<br>`;
        
        h += `<br><b style="font-weight: bold;">ATMIST</b><br>`;
        h += `Age: ${p.atmist.age}${p.atmist.ageEst?' (Est)':''} | Time of Incident: ${p.atmist.time}<br>`;
        h += `Mechanism: ${p.atmist.mech}<br>Injuries Suspected: ${p.atmist.inj}<br>Signs: ${p.atmist.signs}<br>`;
        
        let phInterventions = [...p.atmist.phTreatments];
        if(p.atmist.phTreatmentsFree) phInterventions.push(p.atmist.phTreatmentsFree);
        if(phInterventions.length > 0) h += `Pre-Hosp Interventions: ${phInterventions.join(', ')}<br>`;

        let phDrugsList = [...p.atmist.phDrugs];
        if(p.atmist.phDrugsFree) phDrugsList.push(p.atmist.phDrugsFree);
        if(phDrugsList.length > 0) h += `Pre-Hosp Medications: ${phDrugsList.join(', ')}<br>`;

        if(p.atmist.safeguarding !== 'No Concern') h += `<b style="font-weight: bold;">⚠️ ${p.atmist.safeguarding}</b><br>`;
        if(p.atmist.pregnancy !== 'Not Applicable') h += `Pregnancy Status: ${p.atmist.pregnancy}<br>`;

        if(p.prehosp.notes) h+= `Pre-Hospital Notes: ${p.prehosp.notes}<br>`;
        h += `AMPLE: A:${p.prehosp.history.a} M:${p.prehosp.history.m} P:${p.prehosp.history.p} L:${p.prehosp.history.l} E:${p.prehosp.history.e}<br>`;

        h += `<br><b style="font-weight: bold;">PRIMARY SURVEY</b><br>`;
        
        h += `<b style="font-weight: bold;">Airway:</b> ${p.airway.status}`;
        if(p.airway.status === 'Patent' && p.airway.adjuncts.length > 0) h += " (Maintained with adjuncts)";
        h += ". ";
        if(p.airway.adjuncts.length) h += `Adjuncts: ${p.airway.adjuncts.join(', ')}. `;
        if (p.airway.rsi) h += `<b style="font-weight: bold;">Pre-Hosp RSI:</b> Size ${p.airway.rsiData.size}, Length ${p.airway.rsiData.length}cm, Grade ${p.airway.rsiData.grade}, ETCO2 ${p.airway.rsiData.etco2}. Drugs: ${p.airway.rsiData.drugs}. `;
        if(p.airway.collar || p.airway.blocks) h += `C-Spine: ${p.airway.collar?'Collar ':''}${p.airway.blocks?'Blocks':''}. `;
        if(p.airway.notes) h += ` ${p.airway.notes}`;
        h += "<br>";
        
        let o2 = p.breathing.o2 === 'Air' ? 'Air' : `Oxygen ${p.breathing.fio2}`;
        h += `<b style="font-weight: bold;">Breathing:</b> RR ${p.breathing.rr} | Sats ${p.breathing.sats}% (${o2}).<br>`;
        if(p.breathing.findings.length) h += `&nbsp;&nbsp;&nbsp;Findings: ${p.breathing.findings.map(f=>`${f.f} (${f.s})`).join(', ')}.<br>`;
        const currentBFindings = p.breathing.findings.map(f => f.f);
        const negB = BREATHING_OPTS.filter(opt => !currentBFindings.includes(opt));
        if (negB.length > 0) {
            const airEntryNormal = !currentBFindings.includes('Reduced Expansion');
            h += `&nbsp;&nbsp;&nbsp;<em>Negative Findings:</em> ${airEntryNormal ? "Air entry equal. " : ""}No ${negB.join(', ').toLowerCase()}. `;
        }
        if(p.breathing.notes) h += `${p.breathing.notes}`;
        h += "<br>";
        
        h += `<b style="font-weight: bold;">Circulation:</b> HR ${p.circulation.hr} | BP ${p.circulation.bp}${calcHtml} | CRT ${p.circulation.crt}s.<br>`;
        if(p.circulation.txa && p.circulation.txa !== 'None') h += `&nbsp;&nbsp;&nbsp;<b style="font-weight: bold;">TXA Given:</b> ${p.circulation.txa} ${p.circulation.txaTime ? `(@ ${p.circulation.txaTime})` : ''}.<br>`;
        if(p.circulation.lines.length) h += `&nbsp;&nbsp;&nbsp;Access: ${p.circulation.lines.join(', ')}.<br>`;
        if(p.circulation.bleeding.length) h += `&nbsp;&nbsp;&nbsp;<b style="font-weight: bold;">Bleeding Sites:</b> ${p.circulation.bleeding.join(', ')}.<br>`;
        
        let interventions = [];
        if(p.circulation.binder) interventions.push(`Pelvic Binder ${p.circulation.binderTime ? `(@ ${p.circulation.binderTime})` : ''}`);
        if(p.circulation.ktd) interventions.push(`KTD Splint ${p.circulation.ktdTime ? `(@ ${p.circulation.ktdTime})` : ''}`);
        if(p.circulation.tourniquet) interventions.push(`Tourniquet ${p.circulation.tourniquetTime ? `(@ ${p.circulation.tourniquetTime})` : ''}`);
        if(interventions.length) h += `&nbsp;&nbsp;&nbsp;<b style="font-weight: bold;">Interventions:</b> ${interventions.join(', ')}.<br>`;
        if(p.circulation.notes) h += `&nbsp;&nbsp;&nbsp;${p.circulation.notes}<br>`;

        if(p.mhp.activated) {
            h += `&nbsp;&nbsp;&nbsp;<b style="font-weight: bold;">⚠️ MHP ACTIVATED</b> (${p.mhp.time || 'Time Not Set'})<br>&nbsp;&nbsp;&nbsp;Given: Crystalloid ${p.mhp.crystalloid || 0}ml, PRBC ${p.mhp.prbc || 0}, FFP ${p.mhp.ffp || 0}, Plt ${p.mhp.plt || 0}, Cryo ${p.mhp.cryo || 0}.<br>`;
        }

        let gcsTot = parseInt(p.disability.gcsE) + parseInt(p.disability.gcsV) + parseInt(p.disability.gcsM);
        h += `<b style="font-weight: bold;">Disability:</b> AVPU ${p.disability.avpu} | GCS ${gcsTot} (E${p.disability.gcsE} V${p.disability.gcsV} M${p.disability.gcsM}).<br>`;
        h += `&nbsp;&nbsp;&nbsp;Pupils: L ${p.disability.pupilL || '-'} | R ${p.disability.pupilR || '-'}. Blood Glucose: ${p.disability.glucose} mmol/L.<br>`;
        if(p.disability.headInjury) h += `&nbsp;&nbsp;&nbsp;<b style="font-weight: bold;">⚠️ Head Injury Suspected</b><br>`;
        
        h += `<b style="font-weight: bold;">Exposure:</b> Temp ${p.exposure.temp}°C. ${p.exposure.notes}<br>`;
        
        if (p.obs.length > 0) {
            h += `<br><b style="font-weight: bold;">Serial Observations:</b><br>`;
            p.obs.forEach(o => {
                h += `[${o.time}] HR ${o.hr} | BP ${o.bp} | RR ${o.rr} | SpO2 ${o.spo2}% | GCS ${o.gcs}<br>`;
            });
        }

        const v = p.investigations.vbg;
        h += `<br><b style="font-weight: bold;">Investigations:</b><br>`;
        h += `${p.investigations.gasType}: pH ${v.ph} | pCO2 ${v.pco2} | pO2 ${v.po2} | HCO3 ${v.hco3} | BE ${v.be} | Lac ${v.lac} | Ca ${v.ca}`;
        if(p.investigations.gasType === 'ABG' && v.abgFio2) h+= ` (FiO2: ${v.abgFio2}%)`;
        h += `<br>`;
        
        let efastTxt = [];
        if(p.investigations.efast.ruq) efastTxt.push(`RUQ ${p.investigations.efast.ruq}`);
        if(p.investigations.efast.luq) efastTxt.push(`LUQ ${p.investigations.efast.luq}`);
        if(p.investigations.efast.pelvis) efastTxt.push(`Pelvis ${p.investigations.efast.pelvis}`);
        if(p.investigations.efast.pericardial) efastTxt.push(`Pericardial ${p.investigations.efast.pericardial}`);
        if(efastTxt.length > 0) h += `eFAST: ${efastTxt.join(', ')}.<br>`;

        h += `Plan/Imaging: ${p.investigations.imaging}<br>`;
        
        if (p.checkpoints.primary.name || p.checkpoints.primary.agreed) {
            h += `<br><b style="font-weight: bold;">Consultant/Reg Review (Primary):</b> Discussed with ${p.checkpoints.primary.name}. Plan Agreed: ${p.checkpoints.primary.agreed}. Signed: ${p.checkpoints.primary.time}<br>`;
        }
        getEl('initialNoteOutput').innerHTML = h;

        // --- SECONDARY SURVEY HTML ---
        let s = `<b style="font-weight: bold;">Secondary Survey</b><br><br>`;
        const vSec = p.investigations.vbgSec;
        if(vSec.ph || vSec.lac) {
            s += `<b style="font-weight: bold;">Repeat ${p.investigations.secGasType}:</b> pH ${vSec.ph} | pCO2 ${vSec.pco2} | pO2 ${vSec.po2} | HCO3 ${vSec.hco3} | BE ${vSec.be} | Lac ${vSec.lac}<br><br>`;
        }
        
        if(p.secondary.visualAcuity.left || p.secondary.visualAcuity.right) {
            s += `<b style="font-weight: bold;">Visual Acuity:</b> Left: ${p.secondary.visualAcuity.left || 'Not tested'}, Right: ${p.secondary.visualAcuity.right || 'Not tested'}.<br><br>`;
        }

        if(p.secondary.logroll.done || p.secondary.pr.done) {
            s += `<b style="font-weight: bold;">Log Roll & Pelvic Check:</b><br>`;
            if(p.secondary.logroll.done) s += `Log roll performed. Findings: ${p.secondary.logroll.findings || 'No obvious step or tenderness'}.<br>`;
            if(p.secondary.pr.done) s += `PR exam performed. Findings: ${p.secondary.pr.findings || 'Normal tone, no blood'}.<br>`;
            s += `<br>`;
        }

        SS_AREAS.forEach(area => {
            const data = p.secondary[area.id];
            if(data) {
                const hasTags = data.tags.length > 0;
                const hasText = data.text.length > 0;
                
                s += `<b style="font-weight: bold;">${area.label}:</b> `;
                
                if (!hasTags && !hasText) {
                    s += area.normal ? `${area.normal}` : `No abnormalities detected.`;
                } else {
                    if (hasTags) s += `${data.tags.join(', ')}. `;
                    if (hasText) s += `${data.text}`;
                }
                s += `<br>`;
            }
        });

        const ne = p.neuroExam;
        s += `<br><b style="font-weight: bold;">Neurological Examination:</b><br>`;
        s += `Upper Limbs: L (Pow ${ne.pul}, Sen ${ne.sul}) | R (Pow ${ne.pur}, Sen ${ne.sur})<br>`;
        s += `Lower Limbs: L (Pow ${ne.pll}, Sen ${ne.sll}) | R (Pow ${ne.plr}, Sen ${ne.slr})<br>`;
        
        if (p.checkpoints.secondary.name || p.checkpoints.secondary.agreed) {
            s += `<br><b style="font-weight: bold;">Consultant/Reg Review (Secondary):</b> Discussed with ${p.checkpoints.secondary.name}. Plan Agreed: ${p.checkpoints.secondary.agreed}. Signed: ${p.checkpoints.secondary.time}<br>`;
        }

        s += `<br><b style="font-weight: bold;">Definitive Care Plan</b><br>`;
        if(p.definitive.furtherImaging) s+= `Further Imaging Required: ${p.definitive.furtherImagingDetails}<br>`;
        if(p.definitive.tetanus) s+= `Tetanus immunisation up-to-date or given.<br>`;
        if(p.definitive.meds.length) s += `Time Critical Meds Prescribed: ${p.definitive.meds.join(', ')}<br>`;
        if(p.definitive.disposition) s += `Disposition: <b style="font-weight: bold;">${p.definitive.disposition}</b><br>`;
        s += `${p.definitive.plan}<br>`;
        
        s += `<br><b style="font-weight: bold;">Problem List</b><br>${p.problemList.replace(/\n/g, '<br>')}`;
        getEl('secondaryNoteOutput').innerHTML = s;
        
        saveState();
    }

    // --- COPY FUNCTION ---
    async function copyRichText(id) {
        const el = getEl(id);
        try {
            const htmlBlob = new Blob([el.innerHTML], { type: 'text/html' });
            const textBlob = new Blob([el.innerText], { type: 'text/plain' });
            await navigator.clipboard.write([
                new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
            ]);
            const btn = id.includes('Initial') ? getEl('copyInitial') : getEl('copySecondary');
            const orig = btn.innerText;
            btn.innerText = '✅ Copied!';
            btn.classList.add('bg-green-600', 'hover:bg-green-700');
            btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            setTimeout(() => {
                btn.innerText = orig;
                btn.classList.add('bg-blue-600', 'hover:bg-blue-700');
                btn.classList.remove('bg-green-600', 'hover:bg-green-700');
            }, 2000);
        } catch (err) { console.error("Copy failed", err); alert("Copy failed."); }
    }

    getEl('copyInitial').addEventListener('click', () => copyRichText('initialNoteOutput'));
    getEl('copySecondary').addEventListener('click', () => copyRichText('secondaryNoteOutput'));

    // --- LISTENERS ---
    const bind = (id, obj, key) => { const el = getEl(id); if(el) el.addEventListener('input', e => { obj[key] = e.target.value; updateNotes(); }); };
    const bindCheck = (id, obj, key) => { const el = getEl(id); if(el) el.addEventListener('change', e => { obj[key] = e.target.checked; updateNotes(); }); };

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
            const current = patientData.circulation[prop];
            if(!current) { patientData.circulation[prop] = true; patientData.circulation[`${prop}Time`] = getTime(); } 
            else { patientData.circulation[`${prop}Time`] = getTime(); }
            toggleAccessBtn(type, true);
        } else if (e.target.id === 'btn-txa-now') {
            patientData.circulation.txaTime = getTime();
        }
        updateNotes();
    }));

    document.querySelectorAll('.std-btn').forEach(btn => btn.addEventListener('click', e => {
        if(e.target.dataset.spec) addSpecialty(e.target.dataset.spec, true);
        if(e.target.dataset.adj) {
            e.target.classList.toggle('active');
            const adj = e.target.dataset.adj;
            if(adj === 'None') patientData.airway.adjuncts = ['None'];
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
            e.target.classList.toggle('active');
            const { f, s } = e.target.dataset;
            const exists = patientData.breathing.findings.find(x => x.f === f && x.s === s);
            if(exists) patientData.breathing.findings = patientData.breathing.findings.filter(x => !(x.f===f && x.s===s));
            else patientData.breathing.findings.push({f,s});
            updateNotes();
        }
    });

    injContainer.addEventListener('click', e => {
        if(e.target.classList.contains('injury-btn')) {
            e.target.classList.toggle('active');
            const site = e.target.dataset.site;
            if(patientData.circulation.bleeding.includes(site)) patientData.circulation.bleeding = patientData.circulation.bleeding.filter(x => x !== site);
            else patientData.circulation.bleeding.push(site);
            updateNotes();
        }
    });

    document.querySelectorAll('.access-btn').forEach(btn => btn.addEventListener('click', e => {
        e.target.classList.toggle('active');
        const txt = e.target.dataset.text;
        const isActive = e.target.classList.contains('active');
        if(txt.includes('Binder')) {
            patientData.circulation.binder = isActive;
            if(isActive && !patientData.circulation.binderTime) patientData.circulation.binderTime = getTime();
            if(!isActive) patientData.circulation.binderTime = '';
        }
        if(txt.includes('KTD')) {
            patientData.circulation.ktd = isActive;
            if(isActive && !patientData.circulation.ktdTime) patientData.circulation.ktdTime = getTime();
            if(!isActive) patientData.circulation.ktdTime = '';
        }
        if(txt.includes('Tourniquet')) {
            patientData.circulation.tourniquet = isActive;
            if(isActive && !patientData.circulation.tourniquetTime) patientData.circulation.tourniquetTime = getTime();
            if(!isActive) patientData.circulation.tourniquetTime = '';
        }
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
        if(patientData.atmist.phDrugs.includes(d)) patientData.atmist.phDrugs = patientData.atmist.phDrugs.filter(x => x !== d);
        else patientData.atmist.phDrugs.push(d);
        updateNotes();
    }));
    
    bindCheck('zps_self', patientData.zero, 'self');
    bindCheck('zps_leader', patientData.zero, 'leader');
    bindCheck('zps_roles', patientData.zero, 'roles');
    bindCheck('zps_brief', patientData.zero, 'brief');
    bindCheck('zps_env', patientData.zero, 'env');
    bindCheck('zps_ppe', patientData.zero, 'ppe');
    bind('zps_notes', patientData.zero, 'notes');

    bind('age', patientData.atmist, 'age');
    bindCheck('ageEstimated', patientData.atmist, 'ageEst');
    bind('timeOfIncident', patientData.atmist, 'time');
    bind('mechanism', patientData.atmist, 'mech');
    bind('injuries', patientData.atmist, 'inj');
    bind('signs', patientData.atmist, 'signs');
    bind('ph_treatments_free', patientData.atmist, 'phTreatmentsFree');
    bind('ph_drugs_free', patientData.atmist, 'phDrugsFree');
    bind('safeguarding', patientData.atmist, 'safeguarding');
    bind('pregnancy', patientData.atmist, 'pregnancy');
    
    bind('preHospitalOther', patientData.prehosp, 'notes');
    ['a','m','p','l','e'].forEach(k => bind(`history_${k}`, patientData.prehosp.history, k));
    
    bindCheck('preHospitalRSI', patientData.airway, 'rsi');
    getEl('preHospitalRSI').addEventListener('change', e => getEl('rsiDetails').classList.toggle('hidden', !e.target.checked));
    ['size','length','grade','etco2','drugs'].forEach(k => bind(`rsi_${k}`, patientData.airway.rsiData, k));
    
    bindCheck('cspine_collar', patientData.airway, 'collar');
    bindCheck('cspine_blocks', patientData.airway, 'blocks');
    bind('airway_notes', patientData.airway, 'notes');
    
    bind('breathing_rr', patientData.breathing, 'rr');
    bind('breathing_sats', patientData.breathing, 'sats');
    bind('breathing_fio2', patientData.breathing, 'fio2');
    bind('breathing_notes', patientData.breathing, 'notes');
    
    bind('circ_hr', patientData.circulation, 'hr');
    bind('circ_bp', patientData.circulation, 'bp');
    bind('circ_capRefill', patientData.circulation, 'crt');
    bind('circ_notes', patientData.circulation, 'notes');
    document.querySelectorAll('input[name="txaGiven"]').forEach(r => r.addEventListener('change', e => { 
        patientData.circulation.txa = e.target.value; 
        if(e.target.value !== 'None' && !patientData.circulation.txaTime) patientData.circulation.txaTime = getTime();
        updateNotes(); 
    }));
    document.querySelectorAll('.access-chk').forEach(chk => chk.addEventListener('change', e => {
        if(e.target.checked) patientData.circulation.lines.push(e.target.value);
        else patientData.circulation.lines = patientData.circulation.lines.filter(x => x !== e.target.value);
        updateNotes();
    }));

    bindCheck('mhp_activated', patientData.mhp, 'activated');
    getEl('mhp_activated').addEventListener('change', e => {
            getEl('mhpDetails').classList.toggle('hidden', !e.target.checked);
            getEl('mhp_time').classList.toggle('hidden', !e.target.checked);
            if(e.target.checked && !patientData.mhp.time) {
                patientData.mhp.time = getTime();
                getEl('mhp_time').value = patientData.mhp.time;
            }
            updateNotes();
    });
    bind('mhp_time', patientData.mhp, 'time');
    ['crystalloid', 'prbc','ffp','plt','cryo'].forEach(k => bind(`mhp_${k}`, patientData.mhp, k));

    bindCheck('headInjury', patientData.disability, 'headInjury');
    document.querySelectorAll('input[name="disability_avpu"]').forEach(r => r.addEventListener('change', e => { patientData.disability.avpu = e.target.value; updateNotes(); }));
    bind('disability_pupil_left', patientData.disability, 'pupilL');
    bind('disability_pupil_right', patientData.disability, 'pupilR');
    bind('disability_glucose', patientData.disability, 'glucose');
    
    bind('exposure_temp', patientData.exposure, 'temp');
    bind('exposure_notes', patientData.exposure, 'notes');
    
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

    ['ruq', 'luq', 'pelvis', 'pericardial'].forEach(k => bind(`efast_${k}`, patientData.investigations.efast, k));
    bind('imagingDecisions', patientData.investigations, 'imaging');

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
            if (e.target.checked) patientData.secondary[areaId].tags.push(tag);
            else patientData.secondary[areaId].tags = patientData.secondary[areaId].tags.filter(t => t !== tag);
            updateNotes();
            }
    });

    getEl('resetData').addEventListener('click', () => {
        if(confirm('Reset form? All data will be lost.')) {
            localStorage.removeItem('wmebem_trauma_data');
            location.reload();
        }
    });

    // Quick Action Listeners
    getEl('btnNormalAirway').addEventListener('click', () => {
        patientData.airway.status = 'Patent';
        patientData.airway.adjuncts = ['None'];
        patientData.airway.collar = false;
        patientData.airway.blocks = false;
        document.querySelector('input[name="airwayStatus"][value="Patent"]').checked = true;
        document.querySelectorAll('[data-adj]').forEach(b => b.classList.remove('active'));
        const noneBtn = document.querySelector('[data-adj="None"]');
        if(noneBtn) noneBtn.classList.add('active');
        getEl('cspine_collar').checked = false;
        getEl('cspine_blocks').checked = false;
        updateNotes();
    });

    getEl('btnNormalBreathing').addEventListener('click', () => {
        patientData.breathing.rr = '16';
        patientData.breathing.sats = '98';
        patientData.breathing.o2 = 'Air';
        patientData.breathing.fio2 = '';
        patientData.breathing.findings = [];
        getEl('breathing_rr').value = '16';
        getEl('breathing_sats').value = '98';
        document.querySelector('input[name="breathing_o2"][value="Air"]').checked = true;
        getEl('fio2_container').classList.add('hidden');
        getEl('breathing_fio2').value = '';
        document.querySelectorAll('.lr-btn').forEach(b => b.classList.remove('active'));
        updateNotes();
    });

    getEl('btnNormalCirc').addEventListener('click', () => {
        patientData.circulation.hr = '80';
        patientData.circulation.bp = '120/80';
        patientData.circulation.crt = '2';
        patientData.circulation.txa = 'None';
        patientData.circulation.txaTime = '';
        patientData.circulation.bleeding = [];
        patientData.circulation.binder = false;
        patientData.circulation.ktd = false;
        patientData.circulation.tourniquet = false;
        
        getEl('circ_hr').value = '80';
        getEl('circ_bp').value = '120/80';
        getEl('circ_capRefill').value = '2';
        document.querySelector('input[name="txaGiven"][value="None"]').checked = true;
        
        document.querySelectorAll('.injury-btn').forEach(b => b.classList.remove('active'));
        
        patientData.circulation.binderTime = '';
        patientData.circulation.ktdTime = '';
        patientData.circulation.tourniquetTime = '';
        toggleAccessBtn('Binder', false);
        toggleAccessBtn('KTD', false);
        toggleAccessBtn('Tourniquet', false);
        updateTimeBtn('Binder', false);
        updateTimeBtn('KTD', false);
        updateTimeBtn('Tourniquet', false);
        
        const txaBtn = getEl('btn-txa-now');
        txaBtn.classList.remove('recorded');
        txaBtn.innerText = '🕒 Now';

        updateNotes();
    });

    getEl('btnNormalDisability').addEventListener('click', () => {
        patientData.disability.avpu = 'Alert';
        patientData.disability.gcsE = 4;
        patientData.disability.gcsV = 5;
        patientData.disability.gcsM = 6;
        patientData.disability.headInjury = false;
        patientData.disability.pupilL = '3';
        patientData.disability.pupilR = '3';
        patientData.disability.glucose = '5.5';

        document.querySelector('input[name="disability_avpu"][value="Alert"]').checked = true;
        getEl('disability_gcsE').value = '4';
        getEl('disability_gcsV').value = '5';
        getEl('disability_gcsM').value = '6';
        getEl('headInjury').checked = false;
        getEl('disability_pupil_left').value = '3';
        getEl('disability_pupil_right').value = '3';
        getEl('disability_glucose').value = '5.5';
        updateNotes();
    });

    getEl('btnNormalExposure').addEventListener('click', () => {
        patientData.exposure.temp = '36.5';
        getEl('exposure_temp').value = '36.5';
        updateNotes();
    });

    loadState();
    patientData.breathing.findings.forEach(obj => {
        const btn = document.querySelector(`.lr-btn[data-f="${obj.f}"][data-s="${obj.s}"]`);
        if(btn) btn.classList.add('active');
    });
    patientData.circulation.bleeding.forEach(site => {
        const btn = document.querySelector(`.injury-btn[data-site="${site}"]`);
        if(btn) btn.classList.add('active');
    });
    SS_AREAS.forEach(area => {
        if(patientData.secondary[area.id]) {
            patientData.secondary[area.id].tags.forEach(tag => {
                const chk = document.querySelector(`.tag-checkbox[data-area="${area.id}"][value="${tag}"]`);
                if(chk) chk.checked = true;
            });
            const txt = getEl(`ss_${area.id}`);
            if(txt) txt.value = patientData.secondary[area.id].text;
        }
    });
    updateNotes();
});
