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
    $("loadStatus").textContent = t("loadOk");
    document.querySelectorAll("[data-action]").forEach(b => b.disabled = false);
  } catch(e) {
    $("loadStatus").textContent = t("loadFail");
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
  $("quizBank").textContent=bankNames[bank];$("quizMode").textContent=t(({exam:"modeExam",all:"modeAll",random:"modeRandom",category:"modeCategory"})[mode]||"modeAll");
  $("timer").hidden=mode!=="exam";showPanel("quiz");renderQuestion();
  if(mode==="exam") startTimer();
  window.scrollTo({top:0,behavior:"smooth"});
}
function renderQuestion(){
  const q=state.questions[state.index];
  state.selected=null;state.locked=false;
  $("progress").textContent=t("question",{n:state.index+1,total:state.questions.length});
  $("categoryLabel").textContent=q.category || "Generale";
  $("progressBar").style.width=`${state.index/state.questions.length*100}%`;
  $("questionText").textContent=q.question;
  $("feedback").hidden=true;$("feedback").textContent="";
  $("next").disabled=true;$("next").textContent=state.mode==="all"||state.mode==="random"||state.mode==="category" ? t("confirm") : t("answer");
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
    $("feedback").innerHTML=(correct?"<strong class='good-text'>"+t("correct")+"</strong>":"<strong class='bad-text'>"+t("wrong")+"</strong>")+
      `<p>${t("exact")} ${escapeHtml(q.options[q.correct])}</p><small>${t("reference")} ${escapeHtml(q.manualPage ?? t("notSpecified"))}</small>`;
    $("next").textContent=state.index===state.questions.length-1?t("showResult"):t("next");
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
  $("resultTitle").textContent=exam?(passed?t("passed"):t("failed")):t("completed");
  $("score").textContent=`${correct}/${total}`;
  $("percentage").textContent=`${Math.round(correct/total*100)}%`;
  $("resultMessage").textContent=exam
    ? (expired?t("timeUp"):`${t("passRule")} ${passed?t("youPassed"):t("notPassed")}`)
    : t("answered",{correct,total});
  $("resultTitle").classList.toggle("passed",passed);$("resultTitle").classList.toggle("failed",exam&&!passed);
  const errors=state.questions.map((q,i)=>({q,a:state.answers[i],i})).filter(x=>!x.a||!x.a.correct);
  const byCat={};errors.forEach(x=>{const c=x.q.category||"Generale";byCat[c]=(byCat[c]||0)+1;});
  $("categoryStats").innerHTML=errors.length?'<h3>'+t("reviewTopics")+'</h3>'+Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<div class="stat-row"><span>${escapeHtml(c)}</span><strong>${n} errori</strong></div>`).join(""):`<p class='good-text'>${t("noErrors")}</p>`;
  $("reviewErrors").innerHTML=errors.length?'<h3>'+t("reviewErrors")+'</h3>'+errors.map(({q,a,i})=>`<article class="error-item"><strong>${i+1}. ${escapeHtml(q.question)}</strong><p>La tua risposta: ${a?escapeHtml(q.options[a.selected]):"Nessuna risposta"}</p><p class="good-text">Risposta corretta: ${escapeHtml(q.options[q.correct])}</p><small>Categoria: ${escapeHtml(q.category||"Generale")} · Manuale, pagina ${escapeHtml(q.manualPage??"non indicata")}</small></article>`).join(""):"";
  showPanel("resultsPanel");window.scrollTo({top:0,behavior:"smooth"});
}
function openCategories(bank){
  state.bank=bank;$("categoryTitle").textContent=bankNames[bank]+" · "+t("chooseCategory");
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
it:{tag:"Patente aeroportuale FCO / CIA",hero:"Allenati. Preparati. Verifica.",intro:"Due banche separate, modalità di ripasso e simulazione d'esame.",total:"domande totali",exam:"Esame completo",meta:"20 domande · 25 min",all:"Ripasso completo",random:"20 domande casuali",cats:"Allenamento per categoria",note:"Nota importante",disclaimer:"Strumento di studio non ufficiale. Non è emesso, approvato o garantito da ADR o ENAC e non sostituisce corsi, manuali, procedure aeroportuali, formazione o prove ufficiali. Verifica sempre la documentazione ufficiale vigente.",home:"Torna alla home",modeExam:"Simulazione d'esame",modeAll:"Ripasso completo",modeRandom:"20 domande casuali",modeCategory:"Allenamento per categoria",chooseCategory:"Scegli una categoria",back:"← Indietro",question:"Domanda {n} di {total}",confirm:"Conferma risposta",answer:"Rispondi",next:"Prossima domanda",showResult:"Vedi risultato",exit:"Esci",correct:"Risposta corretta.",wrong:"Risposta non corretta.",exact:"Risposta esatta:",reference:"Riferimento: manuale, pagina",notSpecified:"non indicata",passed:"Simulazione superata",failed:"Simulazione non superata",completed:"Allenamento completato",timeUp:"Tempo scaduto. La simulazione è terminata.",passRule:"Criterio di superamento: almeno 18 risposte corrette su 20.",youPassed:"Hai superato la simulazione.",notPassed:"Non hai raggiunto la soglia prevista.",answered:"Hai risposto correttamente a {correct} domande su {total}.",reviewTopics:"Argomenti da ripassare",errors:"errori",noErrors:"Nessun errore: ottimo lavoro!",reviewErrors:"Revisione errori",yourAnswer:"La tua risposta:",noAnswer:"Nessuna risposta",rightAnswer:"Risposta corretta:",category:"Categoria:",manual:"Manuale, pagina",questions:"domande",loadOk:"Banche caricate correttamente: 111 ADC A e 123 ADC M.",loadFail:"Non riesco a caricare le banche. Controlla che la Web App sia aperta da GitHub Pages o da un server web."},
en:{tag:"FCO / CIA Airport Driving Permit",hero:"Train. Prepare. Test yourself.",intro:"Two separate question banks, revision modes and exam simulation.",total:"questions in total",exam:"Full exam",meta:"20 questions · 25 min",all:"Review all questions",random:"20 random questions",cats:"Practice by category",note:"Important note",disclaimer:"Unofficial study aid. It is not issued, approved or guaranteed by ADR or ENAC and does not replace courses, manuals, airport procedures, training or official tests. Always check current official documentation.",home:"Back to home",modeExam:"Exam simulation",modeAll:"Review all questions",modeRandom:"20 random questions",modeCategory:"Practice by category",chooseCategory:"Choose a category",back:"← Back",question:"Question {n} of {total}",confirm:"Confirm answer",answer:"Answer",next:"Next question",showResult:"View result",exit:"Exit",correct:"Correct answer.",wrong:"Incorrect answer.",exact:"Correct answer:",reference:"Reference: manual, page",notSpecified:"not specified",passed:"Simulation passed",failed:"Simulation not passed",completed:"Practice completed",timeUp:"Time is up. The simulation has ended.",passRule:"Passing score: at least 18 correct answers out of 20.",youPassed:"You passed the simulation.",notPassed:"You did not reach the required score.",answered:"You answered {correct} out of {total} questions correctly.",reviewTopics:"Topics to review",errors:"errors",noErrors:"No mistakes: excellent work!",reviewErrors:"Review mistakes",yourAnswer:"Your answer:",noAnswer:"Not answered",rightAnswer:"Correct answer:",category:"Category:",manual:"Manual, page",questions:"questions",loadOk:"Question banks loaded: 111 ADC A and 123 ADC M.",loadFail:"Unable to load the question banks. Open the Web App from GitHub Pages or a web server."},
es:{tag:"Permiso de conducción aeroportuaria FCO / CIA",hero:"Entrena. Prepárate. Comprueba.",intro:"Dos bancos separados, modos de repaso y simulación de examen.",total:"preguntas en total",exam:"Examen completo",meta:"20 preguntas · 25 min",all:"Repasar todas las preguntas",random:"20 preguntas aleatorias",cats:"Práctica por categoría",note:"Nota importante",disclaimer:"Herramienta de estudio no oficial. No ha sido emitida, aprobada ni garantizada por ADR o ENAC y no sustituye cursos, manuales, procedimientos aeroportuarios, formación ni pruebas oficiales. Consulta la documentación oficial vigente.",home:"Volver al inicio",modeExam:"Simulación de examen",modeAll:"Repaso completo",modeRandom:"20 preguntas aleatorias",modeCategory:"Práctica por categoría",chooseCategory:"Elige una categoría",back:"← Atrás",question:"Pregunta {n} de {total}",confirm:"Confirmar respuesta",answer:"Responder",next:"Pregunta siguiente",showResult:"Ver resultado",exit:"Salir",correct:"Respuesta correcta.",wrong:"Respuesta incorrecta.",exact:"Respuesta correcta:",reference:"Referencia: manual, página",notSpecified:"no indicada",passed:"Simulación superada",failed:"Simulación no superada",completed:"Práctica completada",timeUp:"Se acabó el tiempo. La simulación ha terminado.",passRule:"Criterio para aprobar: al menos 18 respuestas correctas de 20.",youPassed:"Has superado la simulación.",notPassed:"No has alcanzado la puntuación requerida.",answered:"Has respondido correctamente {correct} de {total} preguntas.",reviewTopics:"Temas para repasar",errors:"errores",noErrors:"Sin errores: ¡excelente trabajo!",reviewErrors:"Revisión de errores",yourAnswer:"Tu respuesta:",noAnswer:"Sin respuesta",rightAnswer:"Respuesta correcta:",category:"Categoría:",manual:"Manual, página",questions:"preguntas",loadOk:"Bancos cargados: 111 ADC A y 123 ADC M.",loadFail:"No se pueden cargar los bancos. Abre la aplicación desde GitHub Pages o un servidor web."}
};
let uiLanguage="it";
const t=(key,vars={})=>Object.entries(vars).reduce((s,[k,v])=>s.replaceAll("{"+k+"}",v),uiText[uiLanguage][key]||uiText.it[key]||key);
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
 $("home").textContent=d.home;$("quit").textContent=t("exit");$("categoryBack").textContent=t("back");
 if(state.questions.length && !$("quizPanel").hidden){
  const modes={exam:"modeExam",all:"modeAll",random:"modeRandom",category:"modeCategory"};
  $("quizMode").textContent=t(modes[state.mode]||"modeAll");
  $("next").textContent=state.locked?(state.index===state.questions.length-1?t("showResult"):t("next")):t(state.mode==="exam"?"answer":"confirm");
 }
 if(!$("categoryPanel").hidden)$("categoryTitle").textContent=bankNames[state.bank]+" · "+t("chooseCategory");
}
$("languageSelect").addEventListener("change",e=>{uiLanguage=e.target.value;applyUiLanguage();});

applyUiLanguage();

loadBanks();
