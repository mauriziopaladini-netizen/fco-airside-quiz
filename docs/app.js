const $ = id => document.getElementById(id);
const banks = { a: [], m: [] };
const state = { bank: "a", mode: "practice", questions: [], index: 0, answers: [], selected: null, locked: false, timerId: null, remaining: 1500, category: null };
const letters = ["A","B","C","D","E","F"];
const labels = { exam: "Simulazione d'esame", all: "Ripasso completo", random: "20 domande casuali", category: "Allenamento per categoria" };
const bankNames = { a: "ADC A · Apron", m: "ADC M · Area di manovra" };
async function loadBanks() {
  try {
    const [a,m] = await Promise.all([
      fetch("./shared/adc_a_questions.json").then(r => { if(!r.ok) throw Error("ADC A"); return r.json(); }),
      fetch("./shared/adc_m_questions.json").then(r => { if(!r.ok) throw Error("ADC M"); return r.json(); })
    ]);
    banks.a = a.questions; banks.m = m.questions;
    $("loadStatus").textContent = "Banche caricate correttamente: 111 ADC A e 123 ADC M.";
    document.querySelectorAll("[data-action]").forEach(b => b.disabled = false);
  } catch(e) {
    $("loadStatus").textContent = "Non riesco a caricare le banche. Controlla che la Web App sia aperta da GitHub Pages o da un server web.";
    document.querySelectorAll("[data-action]").forEach(b => b.disabled = true);
  }
}
function shuffle(list) {
  const a = [...list];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function stopTimer(){ if(state.timerId){clearInterval(state.timerId);state.timerId=null;} }
function showPanel(id){["categoryPanel","quizPanel","resultsPanel"].forEach(x => $(x).hidden = x !== id);}
function begin(bank, mode, category=null) {
  stopTimer(); state.bank=bank; state.mode=mode; state.category=category;
  let pool = banks[bank];
  if(category) pool = pool.filter(q => (q.category || "Generale") === category);
  const count = mode === "exam" || mode === "random" ? 20 : pool.length;
  state.questions = shuffle(pool).slice(0, Math.min(count,pool.length));
  if(!state.questions.length) return;
  state.index=0;state.answers=[];state.selected=null;state.locked=false;state.remaining=1500;
  $("quizBank").textContent=bankNames[bank];$("quizMode").textContent=labels[mode] || "Allenamento";
  $("timer").hidden=mode!=="exam";showPanel("quiz");renderQuestion();
  if(mode==="exam") startTimer();
  window.scrollTo({top:0,behavior:"smooth"});
}
function renderQuestion(){
  const q=state.questions[state.index];
  state.selected=null;state.locked=false;
  $("progress").textContent=`Domanda ${state.index+1} di ${state.questions.length}`;
  $("categoryLabel").textContent=q.category || "Generale";
  $("progressBar").style.width=`${state.index/state.questions.length*100}%`;
  $("questionText").textContent=q.question;
  $("feedback").hidden=true;$("feedback").textContent="";
  $("next").disabled=true;$("next").textContent=state.mode==="all"||state.mode==="random"||state.mode==="category" ? "Conferma risposta" : "Rispondi";
  const opts=$("options");opts.innerHTML="";
  q.options.forEach((opt,i)=>{
    const b=document.createElement("button");b.type="button";b.className="option";
    b.innerHTML=`<span class="letter">${letters[i]||i+1}</span><span>${escapeHtml(opt)}</span>`;
    b.addEventListener("click",()=>choose(i));opts.appendChild(b);
  });
}
function choose(i){
  if(state.locked)return;state.selected=i;
  [...$("options").children].forEach((b,j)=>b.classList.toggle("selected",j===i));
  $("next").disabled=false;
}
function advance(){
  if(state.mode!=="exam" && state.locked){moveNext();return;}
  if(state.selected===null||state.locked)return;
  const q=state.questions[state.index], correct=state.selected===q.correct;
  state.answers[state.index]={selected:state.selected,correct};
  if(state.mode!=="exam"){
    state.locked=true;
    [...$("options").children].forEach((b,j)=>{b.disabled=true;if(j===q.correct)b.classList.add("correct");if(j===state.selected&&!correct)b.classList.add("wrong");});
    $("feedback").hidden=false;
    $("feedback").innerHTML=(correct?"<strong class='good-text'>Risposta corretta.</strong>":"<strong class='bad-text'>Risposta non corretta.</strong>")+
      `<p>Risposta esatta: ${escapeHtml(q.options[q.correct])}</p><small>Riferimento: manuale, pagina ${escapeHtml(q.manualPage ?? "non indicata")}</small>`;
    $("next").textContent=state.index===state.questions.length-1?"Vedi risultato":"Prossima domanda";
    return;
  }
  moveNext();
}
function moveNext(){if(state.index<state.questions.length-1){state.index++;renderQuestion();}else finish(false);}
function startTimer(){
  updateTimer();state.timerId=setInterval(()=>{state.remaining--;updateTimer();if(state.remaining<=0){stopTimer();finish(true);}},1000);
}
function updateTimer(){
  const m=Math.floor(state.remaining/60),s=state.remaining%60;
  $("timer").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  $("timer").classList.toggle("urgent",state.remaining<=120);
}
function finish(expired){
  stopTimer();
  const correct=state.answers.filter(a=>a&&a.correct).length;
  const total=state.questions.length, exam=state.mode==="exam", passed=exam&&correct>=18&&!expired;
  $("resultTitle").textContent=exam?(passed?"Simulazione superata": "Simulazione non superata"):"Allenamento completato";
  $("score").textContent=`${correct}/${total}`;
  $("percentage").textContent=`${Math.round(correct/total*100)}%`;
  $("resultMessage").textContent=exam
    ? (expired?"Tempo scaduto. La simulazione è terminata.":`Criterio di superamento: almeno 18 risposte corrette su 20. ${passed?"Hai superato la simulazione.":"Non hai raggiunto la soglia prevista."}`)
    : `Hai risposto correttamente a ${correct} domande su ${total}.`;
  $("resultTitle").classList.toggle("passed",passed);$("resultTitle").classList.toggle("failed",exam&&!passed);
  const errors=state.questions.map((q,i)=>({q,a:state.answers[i],i})).filter(x=>!x.a||!x.a.correct);
  const byCat={};errors.forEach(x=>{const c=x.q.category||"Generale";byCat[c]=(byCat[c]||0)+1;});
  $("categoryStats").innerHTML=errors.length?'<h3>Argomenti da ripassare</h3>'+Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<div class="stat-row"><span>${escapeHtml(c)}</span><strong>${n} errori</strong></div>`).join(""):"<p class='good-text'>Nessun errore: ottimo lavoro!</p>";
  $("reviewErrors").innerHTML=errors.length?'<h3>Revisione errori</h3>'+errors.map(({q,a,i})=>`<article class="error-item"><strong>${i+1}. ${escapeHtml(q.question)}</strong><p>La tua risposta: ${a?escapeHtml(q.options[a.selected]):"Nessuna risposta"}</p><p class="good-text">Risposta corretta: ${escapeHtml(q.options[q.correct])}</p><small>Categoria: ${escapeHtml(q.category||"Generale")} · Manuale, pagina ${escapeHtml(q.manualPage??"non indicata")}</small></article>`).join(""):"";
  showPanel("resultsPanel");window.scrollTo({top:0,behavior:"smooth"});
}
function openCategories(bank){
  state.bank=bank;$("categoryTitle").textContent=bankNames[bank]+" · scegli una categoria";
  const counts={};banks[bank].forEach(q=>{const c=q.category||"Generale";counts[c]=(counts[c]||0)+1;});
  $("categoryList").innerHTML=Object.entries(counts).sort((a,b)=>a[0].localeCompare(b[0],"it")).map(([c,n])=>`<button class="category-button" data-category="${escapeHtml(c)}"><span>${escapeHtml(c)}</span><strong>${n} domande →</strong></button>`).join("");
  $("categoryList").querySelectorAll("[data-category]").forEach(b=>b.addEventListener("click",()=>begin(bank,"category",b.dataset.category)));
  showPanel("categoryPanel");window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>{
  if(b.dataset.action==="categories")openCategories(b.dataset.bank);
  else begin(b.dataset.bank,b.dataset.action);
}));
$("next").addEventListener("click",advance);
$("quit").addEventListener("click",()=>{stopTimer();showPanel(null);window.scrollTo({top:0,behavior:"smooth"});});
$("categoryBack").addEventListener("click",()=>{showPanel(null);});
$("home").addEventListener("click",()=>{stopTimer();showPanel(null);});
$("retry").addEventListener("click",()=>begin(state.bank,state.mode,state.category));

const uiText={
it:{tag:"Patente aeroportuale FCO / CIA",hero:"Allenati. Preparati. Verifica.",intro:"Due banche separate, modalità di ripasso e simulazione d'esame.",total:"domande totali",exam:"Esame completo",meta:"20 domande · 25 min",all:"Ripasso completo",random:"20 domande casuali",cats:"Allenamento per categoria",note:"Nota importante",disclaimer:"Strumento di studio non ufficiale. Non è emesso, approvato o garantito da ADR o ENAC e non sostituisce corsi, manuali, procedure aeroportuali, formazione o prove ufficiali. Verifica sempre la documentazione ufficiale vigente.",home:"Torna alla home"},
en:{tag:"FCO / CIA Airport Driving Permit",hero:"Train. Prepare. Test yourself.",intro:"Two separate question banks, revision modes and exam simulation.",total:"questions in total",exam:"Full exam",meta:"20 questions · 25 min",all:"Review all questions",random:"20 random questions",cats:"Practice by category",note:"Important note",disclaimer:"Unofficial study aid. It is not issued, approved or guaranteed by ADR or ENAC and does not replace courses, manuals, airport procedures, training or official tests. Always check current official documentation.",home:"Back to home"},
es:{tag:"Permiso de conducción aeroportuaria FCO / CIA",hero:"Entrena. Prepárate. Comprueba.",intro:"Dos bancos separados, modos de repaso y simulación de examen.",total:"preguntas en total",exam:"Examen completo",meta:"20 preguntas · 25 min",all:"Repasar todas las preguntas",random:"20 preguntas aleatorias",cats:"Práctica por categoría",note:"Nota importante",disclaimer:"Herramienta de estudio no oficial. No ha sido emitida, aprobada ni garantizada por ADR o ENAC y no sustituye cursos, manuales, procedimientos aeroportuarios, formación ni pruebas oficiales. Consulta la documentación oficial vigente.",home:"Volver al inicio"}
};
let uiLanguage="it";
function applyUiLanguage(){
 const d=uiText[uiLanguage];document.documentElement.lang=uiLanguage;
 document.querySelector(".brand-copy p").textContent=d.tag;
 document.querySelector(".hero h2").textContent=d.hero;
 document.querySelector(".hero .muted").textContent=d.intro;
 document.querySelector(".bank-total span").textContent=d.total;
 document.querySelectorAll(".bank-card").forEach(card=>{
  const bs=card.querySelectorAll("button");
  bs[0].childNodes[0].textContent=d.exam+" ";bs[0].querySelector("small").textContent=d.meta;
  bs[1].textContent=d.all;bs[2].textContent=d.random;bs[3].textContent=d.cats;
 });
 document.querySelector(".disclaimer strong").textContent=d.note;
 document.querySelector(".disclaimer p").textContent=d.disclaimer;
 $("home").textContent=d.home;
}
$("languageSelect").addEventListener("change",e=>{uiLanguage=e.target.value;applyUiLanguage();});
applyUiLanguage();

loadBanks();