// Enforce 5 free unit notes generations per device per day
function checkAndIncrementQuota() {
  const today = new Date().toISOString().slice(0, 10);
  const data = JSON.parse(localStorage.getItem('syllabora_quota') || '{}');

  if (data.date !== today) {
    localStorage.setItem('syllabora_quota', JSON.stringify({ date: today, count: 1 }));
    return true;
  }

  if (data.count >= 5) {
    alert("Free daily limit reached (5/5). Your quota will reset at midnight tomorrow!");
    return false;
  }

  data.count += 1;
  localStorage.setItem('syllabora_quota', JSON.stringify(data));
  return true;
}

// Universal Multi-Unit State
let courseMetadata = {
  subject: "",
  textbooks: [],
  reference_books: []
};

let courseUnits = [
  { unit_name: "UNIT - I", topics: [] }
];

let activeUnitIndex = 0; // -1 represents the "Textbooks & References" tab
let generatedUnitsCache = {}; // Cache: { 0: [topicNotes], 1: [topicNotes], "refs": {...} }
let currentTab = 'examiner';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('topics-list').addEventListener('input', (e) => {
    if (activeUnitIndex >= 0 && courseUnits[activeUnitIndex]) {
      const list = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
      courseUnits[activeUnitIndex].topics = list;
      document.getElementById('topic-count').innerText = `${list.length} Topics`;
    }
  });

  renderUnitTabs();
});

function logStatus(msg, isSuccess = true) {
  const log = document.getElementById('debug-log');
  const badge = document.getElementById('status-badge');
  if (log) log.innerText = msg;
  if (badge) {
    badge.innerText = isSuccess ? 'OK' : 'BUSY';
    badge.className = isSuccess ? 'text-[10px] text-emerald-400' : 'text-[10px] text-amber-400';
  }
}

// Secure proxy call to backend serverless function
async function callGemini(payload) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.text();
    throw new Error(`API Error (${res.status}): ${errData}`);
  }

  return await res.json();
}

// Render dynamic tabs: Unlimited units + Add Module + Textbooks
function renderUnitTabs() {
  const container = document.getElementById('unit-tabs-bar');
  if (!container) return;

  let html = `<span class="text-xs uppercase font-bold text-zinc-400 pl-1 whitespace-nowrap">Units:</span>`;
  
  courseUnits.forEach((u, idx) => {
    const isCurrent = idx === activeUnitIndex;
    const hasNotes = generatedUnitsCache[idx] && generatedUnitsCache[idx].length > 0;
    
    html += `
      <button onclick="selectUnitIndex(${idx})" class="px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
        isCurrent ? 'bg-amber-400 text-zinc-950 shadow-sm' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      }">
        <span>${u.unit_name ? u.unit_name.split(':')[0] : `Unit ${idx + 1}`}</span>
        ${hasNotes ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>' : ''}
      </button>
    `;
  });

  html += `
    <button onclick="addNewBlankUnit()" class="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-bold rounded-lg border border-zinc-700 whitespace-nowrap">
      + Add Module
    </button>
  `;

  const isRefsActive = activeUnitIndex === -1;
  const hasRefNotes = !!generatedUnitsCache["refs"];
  html += `
    <button onclick="selectReferencesTab()" class="ml-2 px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
      isRefsActive ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-zinc-200'
    }">
      <span>📚 References & Textbooks</span>
      ${hasRefNotes ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>' : ''}
    </button>
  `;

  container.innerHTML = html;
}

function selectUnitIndex(index) {
  if (index < 0 || index >= courseUnits.length) return;
  activeUnitIndex = index;
  renderUnitTabs();

  const unit = courseUnits[activeUnitIndex];
  document.getElementById('unit-name').value = unit.unit_name || `Unit ${activeUnitIndex + 1}`;
  document.getElementById('topics-list').value = (unit.topics || []).join(', ');
  document.getElementById('topic-count').innerText = `${(unit.topics || []).length} Topics`;

  if (generatedUnitsCache[activeUnitIndex] && generatedUnitsCache[activeUnitIndex].length > 0) {
    renderNotebook();
    document.getElementById('bottom-nav').classList.remove('hidden');
  } else {
    document.getElementById('notebook-canvas').innerHTML = `
      <h2 class="hand-title">${unit.unit_name || `Module ${activeUnitIndex + 1}`} &mdash; Ready to Synthesize</h2>
      <p class="mt-4">This unit contains ${(unit.topics || []).length} topics. Click <strong class="text-amber-600 font-bold">"Synthesize Complete Unit Notes"</strong> on the left panel to generate comprehensive, exam-ready handwritten notes.</p>
    `;
    document.getElementById('bottom-nav').classList.add('hidden');
  }
}

function selectReferencesTab() {
  activeUnitIndex = -1;
  renderUnitTabs();

  const canvas = document.getElementById('notebook-canvas');
  canvas.innerHTML = `
    <h2 class="hand-title">📚 Prescribed Textbooks & Reference Literature</h2>
    <p class="mt-2 text-sm text-slate-700">Official references prescribed by the university curriculum committee:</p>
    
    <div class="mt-5 p-4 bg-amber-50/70 border border-amber-200 rounded-lg">
      <p class="font-bold text-amber-900 text-sm uppercase">Prescribed Textbooks (T1, T2):</p>
      <ul class="list-disc list-inside text-xs mt-2 space-y-1.5 text-slate-800">
        ${(courseMetadata.textbooks.length ? courseMetadata.textbooks : ["No textbook scanned yet. Upload your syllabus image or enter topics on the left."]).map(t => `<li>${t}</li>`).join('')}
      </ul>
    </div>

    <div class="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <p class="font-bold text-slate-800 text-sm uppercase">Reference Books & Standards (R1, R2):</p>
      <ul class="list-disc list-inside text-xs mt-2 space-y-1.5 text-slate-700">
        ${(courseMetadata.reference_books.length ? courseMetadata.reference_books : ["No reference literature scanned yet."]).map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
  `;
  document.getElementById('bottom-nav').classList.add('hidden');
}

function addNewBlankUnit() {
  const newIndex = courseUnits.length;
  courseUnits.push({
    unit_name: `UNIT - ${newIndex + 1}: Module Title`,
    topics: []
  });
  selectUnitIndex(newIndex);
}

function goToNextUnit() {
  if (activeUnitIndex === -1) {
    selectUnitIndex(0);
  } else if (activeUnitIndex < courseUnits.length - 1) {
    selectUnitIndex(activeUnitIndex + 1);
  } else {
    selectReferencesTab();
  }
}

function goToPrevUnit() {
  if (activeUnitIndex === -1) {
    selectUnitIndex(courseUnits.length - 1);
  } else if (activeUnitIndex > 0) {
    selectUnitIndex(activeUnitIndex - 1);
  }
}

function switchTab(mode) {
  currentTab = mode;
  ['friendly', 'viva', 'examiner'].forEach(m => {
    const btn = document.getElementById(`tab-${m}`);
    if (m === mode) {
      btn.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg bg-amber-400 text-zinc-950 transition-all';
    } else {
      btn.className = 'flex-1 py-1.5 text-xs font-bold rounded-lg text-zinc-400 hover:text-zinc-200 transition-all';
    }
  });
  if (activeUnitIndex >= 0 && generatedUnitsCache[activeUnitIndex]) {
    renderNotebook();
  }
}

// Render active unit's notes into the notebook canvas
function renderNotebook() {
  const canvas = document.getElementById('notebook-canvas');
  const unitPayload = generatedUnitsCache[activeUnitIndex];
  if (!canvas || !unitPayload || unitPayload.length === 0) return;

  const subject = document.getElementById('subject-name').value || 'Course Subject';
  const unitName = courseUnits[activeUnitIndex].unit_name || `Unit ${activeUnitIndex + 1}`;

  let html = `
    <div class="border-b-2 border-slate-400 pb-4 mb-8">
      <div class="flex justify-between items-start">
        <div>
          <h1 class="hand-title text-4xl">${subject}</h1>
          <p class="text-xl font-bold text-slate-800">${unitName} &mdash; Comprehensive Master Notes</p>
        </div>
        <span class="text-xs bg-indigo-100 text-indigo-800 font-bold px-3 py-1 rounded-full border border-indigo-200">
          Unit ${activeUnitIndex + 1} of ${courseUnits.length}
        </span>
      </div>
    </div>
  `;

  unitPayload.forEach((data, index) => {
    html += `<div class="mb-14 pb-8 border-b border-slate-300">`;
    html += `<div class="text-xs uppercase font-bold text-red-600 tracking-wider">TOPIC ${index + 1} OF ${unitPayload.length}</div>`;

    if (currentTab === 'examiner') {
      html += `
        <h2 class="hand-title text-3xl mt-1">${data.topic_title}</h2>
        <div class="mt-4"><span class="badge">[2M] Formal Definition:</span> <span class="highlight">${data.formal_definition}</span></div>
        <p class="mt-2"><strong>Introductory Context:</strong> ${data.introduction}</p>

        <!-- Dynamic Visual Schematic / Process Flow -->
        <div class="mt-5 p-4 bg-amber-50/60 border border-amber-200 rounded-lg">
          <p class="text-xs font-bold uppercase tracking-wider text-amber-900 mb-2">📐 Architecture Schematic / Flowchart / Process Diagram:</p>
          <pre class="font-mono text-xs text-slate-900 bg-white p-3 rounded border border-amber-200 overflow-x-auto leading-relaxed">${data.architecture_diagram_ascii}</pre>
          <p class="mt-2 text-xs italic text-slate-700"><strong>Diagram Analysis:</strong> ${data.diagram_explanation}</p>
        </div>

        <!-- Types & Classifications -->
        <div class="mt-4">
          <p class="font-bold text-slate-900">Types & Classifications:</p>
          <ul class="list-disc list-inside mt-1 space-y-1">
            ${(data.types || []).map(t => `<li><strong>${t.name}:</strong>${t.description}</li>`).join('')}
          </ul>
        </div>

        <!-- Working Mechanism & Formula / Standard -->
        <div class="mt-4">
          <p class="font-bold text-slate-900"><span class="badge">[8M]</span> Working Principle / Framework / Procedure:</p>
          <p class="mt-1">${data.working_mechanism}</p>
          ${data.governing_formula_or_standard && data.governing_formula_or_standard !== 'N/A' ? `
            <div class="mt-3 p-2 bg-slate-100 rounded text-center font-bold text-slate-900 font-mono text-sm border border-slate-200">
              <span class="text-xs text-slate-500 uppercase block font-sans">Governing Equation / Statute / Standard:</span>
              ${data.governing_formula_or_standard}
            </div>
          ` : ''}
        </div>

        <!-- Advantages & Limitations -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div class="p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded">
            <p class="text-xs font-bold text-emerald-800 uppercase">Advantages & Merits:</p>
            <ul class="list-disc list-inside text-xs mt-1 space-y-1 text-emerald-950">
              ${(data.advantages || []).map(a => `<li>${a}</li>`).join('')}
            </ul>
          </div>
          <div class="p-3 bg-rose-50 border-l-4 border-rose-500 rounded">
            <p class="text-xs font-bold text-rose-800 uppercase">Limitations & Boundary Conditions:</p>
            <ul class="list-disc list-inside text-xs mt-1 space-y-1 text-rose-950">
              ${(data.limitations || []).map(l => `<li>${l}</li>`).join('')}
            </ul>
          </div>
        </div>

        <!-- Examiner Warning & Conclusion -->
        <div class="mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded">
          <p class="red-ink text-xs uppercase">Examiner Evaluation Warning:</p>
          <p class="text-xs mt-1">${data.examiner_warning}</p>
        </div>
        <p class="mt-3 text-xs italic"><strong>Topic Summary:</strong> ${data.conclusion}</p>
      `;
    } else if (currentTab === 'friendly') {
      html += `
        <h2 class="hand-title text-3xl mt-1">${data.topic_title}</h2>
        <p class="mt-3"><span class="highlight">Analogy:</span> ${data.friendly_analogy}</p>
        <p class="mt-3"><strong>Core Motivation:</strong> ${data.friendly_purpose}</p>
        <p class="mt-3"><strong>Plain English Explanation:</strong> ${data.friendly_explanation}</p>
      `;
    } else if (currentTab === 'viva') {
      html += `
        <h2 class="hand-title text-3xl mt-1">${data.topic_title} &mdash; Oral Viva Defense</h2>
        <div class="space-y-3 mt-3">
          ${(data.viva_questions || []).map((v, i) => `
            <div>
              <p class="red-ink">Q${i+1}:${v.question}</p>
              <p><strong>A:</strong> ${v.answer}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    html += `</div>`;
  });

  canvas.innerHTML = html;
  document.getElementById('bottom-nav').classList.remove('hidden');
}

// Universal Batch Synthesizer: Runs all topics in active unit
document.getElementById('btn-generate-unit').addEventListener('click', async () => {
  // Enforce 5 free unit notes generations per device per day
  if (!checkAndIncrementQuota()) return;

  const subject = document.getElementById('subject-name').value.trim();
  const unit = document.getElementById('unit-name').value.trim();
  const topicsText = document.getElementById('topics-list').value.trim();

  const topics = topicsText.split(',').map(t => t.trim()).filter(Boolean);
  if (topics.length === 0) return alert("Please enter or scan at least one topic.");

  courseUnits[activeUnitIndex].unit_name = unit;
  courseUnits[activeUnitIndex].topics = topics;
  renderUnitTabs();

  generatedUnitsCache[activeUnitIndex] = [];
  document.getElementById('notebook-canvas').innerHTML = `
    <h2 class="hand-title">Synthesizing ${unit} (${topics.length} Topics)...</h2>
    <p class="mt-2 text-sm text-slate-500">Processing topic 1 of ${topics.length}...</p>
  `;

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    logStatus(`Synthesizing (${i+1}/${topics.length}): "${topic}"...`, false);

    const prompt = `You are an elite university professor, textbook author, and senior university examiner.
Generate comprehensive, high-scoring study notes for:
Subject: "${subject}"
Module/Unit: "${unit}"
Topic: "${topic}"

Infer the exact academic discipline of this subject (Engineering, Medicine, Law, Business/Commerce, Science, or Humanities). 
Adapt your terminology, diagrams, and answer structure to match how a university topper and senior evaluator in that specific field write and grade 10/16-mark answers.

Output strictly valid JSON with this schema:
{
  "topic_title": "${topic}",
  "formal_definition": "2-line formal definition containing exact keywords for university 2-mark evaluation",
  "introduction": "Introductory conceptual background and why this topic is studied",
  "architecture_diagram_ascii": "An exhaustive ASCII diagram, flowchart, sequence map, anatomical pathway, or architectural schematic tailored to this discipline with clean labels and numbered stages",
  "diagram_explanation": "Detailed explanation of each component, block, party, or stage depicted in the diagram above",
  "types": [
    { "name": "Classification or Variant 1", "description": "Core mechanics, attributes, or use-case" },
    { "name": "Classification or Variant 2", "description": "Core mechanics, attributes, or use-case" }
  ],
  "working_mechanism": "Step-by-step operating principle, legal test, clinical mechanism, or business execution framework",
  "governing_formula_or_standard": "Primary governing formula, mathematical law, statutory legal act, or governing industry standard (or 'N/A' if purely theoretical)",
  "advantages": [ "Key advantage or primary merit with field relevance", "Secondary practical benefit" ],
  "limitations": [ "Primary technical bottleneck, legal loophole, or boundary condition", "Secondary limitation" ],
  "examiner_warning": "Common mistake students make in exam answers that causes loss of marks",
  "conclusion": "Final wrap-up summary and modern practical relevance",
  "friendly_analogy": "A relatable physical everyday analogy explaining this concept without academic jargon",
  "friendly_purpose": "The historical or engineering problem this concept was created to solve",
  "friendly_explanation": "How it works in plain conversational English",
  "viva_questions": [
    { "question": "Oral exam fundamental question", "answer": "Sharp 1-sentence answer" },
    { "question": "The 'Why not use alternative X?' question", "answer": "1-sentence answer" },
    { "question": "Examiner trap question testing an edge-case", "answer": "1-sentence answer" }
  ]
}`;

    try {
      const data = await callGemini({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      });
      const topicNotes = JSON.parse(data.candidates[0].content.parts[0].text);
      generatedUnitsCache[activeUnitIndex].push(topicNotes);
      renderNotebook();
      renderUnitTabs();
    } catch (err) {
      console.error(err);
      logStatus(`Error on "${topic}": ${err.message}`, false);
    }
  }

  logStatus(`${unit} Completed (${topics.length} topics)!`, true);
});

// Full Syllabus Image Scanner with Client-Side Canvas Compression
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) {
    document.getElementById('file-name').innerText = e.target.files[0].name;
    logStatus(`Image loaded: ${e.target.files[0].name}`);
  }
});

document.getElementById('btn-parse-image').addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) return alert("Select an image first.");

  logStatus("Reading and compressing image...", false);

  // Compress the image down using an in-memory HTML canvas to avoid payload limits
  const base64 = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const scale = img.width > MAX_WIDTH ? (MAX_WIDTH / img.width) : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // JPEG format at 75% quality maintains readability while keeping payload under ~300KB
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        res(compressedDataUrl.split(',')[1]);
      };
      img.onerror = rej;
      img.src = e.target.result;
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  logStatus("Extracting syllabus with Gemini Vision...", false);

  try {
    const data = await callGemini({
      contents: [{
        parts: [
          { 
            text: `Analyze this complete syllabus copy or book index.
Extract:
1. Course / Subject Name
2. EVERY module or unit listed without limit (Unit 1 to Unit N) with its title and all subtopics.
3. Prescribed Textbooks (author, title, publisher)
4. Reference Books

Output strictly valid JSON with this schema:
{
  "subject": "Course Name",
  "textbooks": ["Author, 'Book Title', Publisher"],
  "reference_books": ["Author, 'Ref Book Title'"],
  "units": [
    {
      "unit_name": "UNIT - I: Title",
      "topics": ["Topic 1", "Topic 2", "Topic 3"]
    }
  ]
}` 
          },
          { inline_data: { mime_type: 'image/jpeg', data: base64 } }
        ]
      }],
      generationConfig: { response_mime_type: "application/json" }
    });

    const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
    if (parsed.subject) {
      document.getElementById('subject-name').value = parsed.subject;
      courseMetadata.subject = parsed.subject;
    }
    if (parsed.textbooks) courseMetadata.textbooks = parsed.textbooks;
    if (parsed.reference_books) courseMetadata.reference_books = parsed.reference_books;

    if (parsed.units && Array.isArray(parsed.units) && parsed.units.length > 0) {
      courseUnits = parsed.units;
      activeUnitIndex = 0;
      selectUnitIndex(0);
      logStatus(`Extracted ${courseUnits.length} modules & reference books successfully!`, true);
    }
  } catch (err) {
    console.error(err);
    logStatus("OCR failed: " + err.message, false);
    alert("Extraction error: " + err.message);
  }
});