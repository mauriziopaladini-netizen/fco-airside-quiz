package com.fco.airsidequiz;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Space;
import android.widget.TextView;
import android.widget.Toast;

import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class MainActivity extends Activity {
    private static final int BLUE = Color.rgb(47, 183, 255);
    private static final int BLUE_DARK = Color.rgb(18, 103, 156);
    private static final int BG = Color.rgb(7, 17, 31);
    private static final int CARD = Color.rgb(14, 32, 52);
    private static final int WHITE = Color.rgb(243, 247, 252);
    private static final int MUTED = Color.rgb(160, 177, 198);
    private static final int GREEN = Color.rgb(54, 211, 153);
    private static final int RED = Color.rgb(244, 113, 116);

    private final List<QuizQuestion> adcA = new ArrayList<>();
    private final List<QuizQuestion> adcM = new ArrayList<>();
    private List<QuizQuestion> activeBank = adcA;
    private final List<QuizQuestion> quiz = new ArrayList<>();
    private final List<WrongAnswer> wrongAnswers = new ArrayList<>();
    private final Map<String, String> translationCache = new HashMap<>();

    private LinearLayout content;
    private TextView timerView;
    private CountDownTimer timer;
    private Translator translator;
    private String language = "it";
    private int index = 0;
    private int score = 0;
    private boolean examMode = false;
    private boolean lastExam = false;
    private boolean lastTimeExpired = false;
    private boolean answerLocked = false;
    private long remainingSeconds = 25 * 60L;

    private SharedPreferences prefs;

    static class QuizQuestion {
        String question;
        List<String> options;
        int correct;
        String category;
        int page;
        QuizQuestion(String q, List<String> o, int c, String cat, int p) {
            question = q; options = o; correct = c; category = cat; page = p;
        }
    }

    static class WrongAnswer {
        QuizQuestion q;
        String chosen;
        WrongAnswer(QuizQuestion question, String choice) { q = question; chosen = choice; }
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        prefs = getSharedPreferences("fco_airside", MODE_PRIVATE);
        language = prefs.getString("language", "it");
        loadBank("adc_a_questions.json", adcA);
        loadBank("adc_m_questions.json", adcM);
        home();
    }

    @Override protected void onDestroy() {
        stopTimer();
        if (translator != null) translator.close();
        super.onDestroy();
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private TextView text(String s, float size, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(s); v.setTextSize(size); v.setTextColor(color);
        v.setPadding(dp(4), dp(3), dp(4), dp(3));
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return v;
    }

    private Button button(String label, View.OnClickListener listener) {
        Button b = new Button(this);
        b.setText(label); b.setTextSize(15); b.setAllCaps(false); b.setTextColor(WHITE);
        b.setGravity(Gravity.CENTER); b.setBackgroundColor(BLUE_DARK);
        b.setOnClickListener(listener);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, dp(56));
        p.setMargins(0, dp(6), 0, dp(6)); b.setLayoutParams(p);
        return b;
    }

    private void base(String title, String subtitle) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(BG);
        root.setPadding(dp(18), dp(14), dp(18), dp(14));

        LinearLayout header = new LinearLayout(this); header.setOrientation(LinearLayout.VERTICAL);
        TextView brand = text("✈  FCO AIRSIDE", 25, WHITE, true);
        header.addView(brand);
        header.addView(text(title, 18, BLUE, true));
        if (subtitle != null && !subtitle.isEmpty()) header.addView(text(subtitle, 12, MUTED, false));
        root.addView(header);

        ScrollView scroll = new ScrollView(this);
        content = new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1f));
        setContentView(root);
    }

    private String L(String key) {
        Map<String,String> m = new HashMap<>();
        if (language.equals("en")) {
            m.put("language", "🌐 Language: English"); m.put("a", "ADC A • Apron"); m.put("m", "ADC M • Movement Area");
            m.put("exam", "📝 FULL EXAM • 20 questions / 25 min"); m.put("practice", "📚 Practice – all questions");
            m.put("random", "🔀 20 random questions"); m.put("categories", "📊 Practice by category"); m.put("info", "ℹ️ Information");
            m.put("back", "‹ Home"); m.put("start", "▶ START EXAM"); m.put("errors", "❌ Review errors"); m.put("home", "🏠 Home");
            m.put("newExam", "🔄 New exam"); m.put("newPractice", "🔄 New practice"); m.put("passed", "SIMULATION PASSED • at least 18/20");
            m.put("failed", "SIMULATION NOT PASSED"); m.put("trainingDone", "Practice completed"); m.put("timeExpired", "Time expired");
            m.put("complete", "Simulation completed"); m.put("correct", "Correct"); m.put("errorsWord", "Errors");
            m.put("review", "Error review"); m.put("yourAnswer", "Your answer"); m.put("correctAnswer", "Correct"); m.put("manual", "Manual");
            m.put("source", "Source"); m.put("category", "Category"); m.put("languageTitle", "Select language");
            m.put("disclaimer", "⚠️ STUDY DISCLAIMER"); m.put("close", "OK"); m.put("translation", "Translation");
        } else if (language.equals("es")) {
            m.put("language", "🌐 Idioma: Español"); m.put("a", "ADC A • Apron"); m.put("m", "ADC M • Área de maniobras");
            m.put("exam", "📝 EXAMEN COMPLETO • 20 preguntas / 25 min"); m.put("practice", "📚 Repaso – todas las preguntas");
            m.put("random", "🔀 20 preguntas aleatorias"); m.put("categories", "📊 Práctica por categoría"); m.put("info", "ℹ️ Información");
            m.put("back", "‹ Inicio"); m.put("start", "▶ INICIAR EXAMEN"); m.put("errors", "❌ Revisar errores"); m.put("home", "🏠 Inicio");
            m.put("newExam", "🔄 Nuevo examen"); m.put("newPractice", "🔄 Nuevo repaso"); m.put("passed", "SIMULACIÓN SUPERADA • al menos 18/20");
            m.put("failed", "SIMULACIÓN NO SUPERADA"); m.put("trainingDone", "Repaso completado"); m.put("timeExpired", "Tiempo agotado");
            m.put("complete", "Simulación completada"); m.put("correct", "Correctas"); m.put("errorsWord", "Errores");
            m.put("review", "Revisión de errores"); m.put("yourAnswer", "Tu respuesta"); m.put("correctAnswer", "Correcta"); m.put("manual", "Manual");
            m.put("source", "Fuente"); m.put("category", "Categoría"); m.put("languageTitle", "Selecciona el idioma");
            m.put("disclaimer", "⚠️ AVISO DE ESTUDIO"); m.put("close", "OK"); m.put("translation", "Traducción");
        } else {
            m.put("language", "🌐 Lingua: Italiano"); m.put("a", "ADC A • Apron"); m.put("m", "ADC M • Area di Manovra");
            m.put("exam", "📝 ESAME COMPLETO • 20 domande / 25 min"); m.put("practice", "📚 Ripasso – tutte le domande");
            m.put("random", "🔀 20 domande casuali"); m.put("categories", "📊 Allenamento per categoria"); m.put("info", "ℹ️ Informazioni");
            m.put("back", "‹ Home"); m.put("start", "▶ INIZIA ESAME"); m.put("errors", "❌ Rivedi gli errori"); m.put("home", "🏠 Home");
            m.put("newExam", "🔄 Nuovo esame"); m.put("newPractice", "🔄 Nuovo allenamento"); m.put("passed", "SIMULAZIONE SUPERATA • almeno 18/20");
            m.put("failed", "SIMULAZIONE NON SUPERATA"); m.put("trainingDone", "Allenamento completato"); m.put("timeExpired", "Tempo esaurito");
            m.put("complete", "Simulazione completata"); m.put("correct", "Corrette"); m.put("errorsWord", "Errori");
            m.put("review", "Revisione errori"); m.put("yourAnswer", "La tua risposta"); m.put("correctAnswer", "Corretta"); m.put("manual", "Manuale");
            m.put("source", "Fonte"); m.put("category", "Categoria"); m.put("languageTitle", "Seleziona lingua");
            m.put("disclaimer", "⚠️ DISCLAIMER STUDIO"); m.put("close", "OK"); m.put("translation", "Traduzione");
        }
        return m.containsKey(key) ? m.get(key) : key;
    }

    private void home() {
        stopTimer(); lastExam = false;
        base("Patente Aeroportuale FCO/CIA", "ADC A + ADC M • banca offline • 234 domande");

        content.addView(button(L("language"), v -> chooseLanguage()));
        content.addView(text("234 DOMANDE • 111 ADC A + 123 ADC M", 14, GREEN, true));
        content.addView(text("Le banche sono separate per abilitazione. Le domande e le chiavi presenti nell'app sono state consolidate per lo studio sulla base dei materiali disponibili. Per l'uso operativo e per l'esame fanno fede i documenti e le procedure ADR vigenti.", 13, MUTED, false));
        content.addView(disclaimerCard());

        content.addView(sectionTitle("🛫  " + L("a")));
        content.addView(button(L("exam"), v -> examSection(adcA)));
        content.addView(button(L("practice"), v -> startPractice(adcA, adcA.size())));
        content.addView(button(L("random"), v -> startPractice(adcA, Math.min(20, adcA.size()))));
        content.addView(button(L("categories"), v -> categories(adcA)));

        content.addView(sectionTitle("🛬  " + L("m")));
        content.addView(button(L("exam"), v -> examSection(adcM)));
        content.addView(button(L("practice"), v -> startPractice(adcM, adcM.size())));
        content.addView(button(L("random"), v -> startPractice(adcM, Math.min(20, adcM.size()))));
        content.addView(button(L("categories"), v -> categories(adcM)));

        content.addView(sectionTitle("ℹ️  " + L("info")));
        content.addView(button(L("info"), v -> info()));
    }

    private TextView sectionTitle(String s) {
        TextView v = text(s, 20, WHITE, true);
        v.setPadding(dp(4), dp(20), dp(4), dp(5)); return v;
    }

    private TextView disclaimerCard() {
        TextView v = text(L("disclaimer") + "\n\n" + disclaimerText(), 13, MUTED, false);
        v.setPadding(dp(12), dp(12), dp(12), dp(12)); v.setBackgroundColor(CARD);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2); p.setMargins(0, dp(8), 0, dp(12)); v.setLayoutParams(p);
        return v;
    }

    private String disclaimerText() {
        if (language.equals("en")) return "This app is an unofficial study aid. It is not issued, approved or guaranteed by ADR or ENAC and does not replace courses, manuals, airport procedures, Volume 3 radio-telephony training, or official tests. Questions were prepared for study from the available materials. Translations are auxiliary and may contain terminology differences. Always verify the current official documentation before relying on any information.";
        if (language.equals("es")) return "Esta app es una herramienta de estudio no oficial. No ha sido emitida, aprobada ni garantizada por ADR o ENAC y no sustituye cursos, manuales, procedimientos aeroportuarios, formación de radiotelefonía del Volumen 3 ni pruebas oficiales. Las preguntas se prepararon con fines de estudio a partir de los materiales disponibles. Las traducciones son auxiliares y pueden presentar diferencias terminológicas. Verifica siempre la documentación oficial vigente.";
        return "Questa app è uno strumento di studio non ufficiale. Non è emessa, approvata o garantita da ADR o ENAC e non sostituisce corsi, manuali, procedure aeroportuali, formazione di radiotelefonia del Volume 3 né prove ufficiali. Le domande sono state preparate a fini didattici sulla base dei materiali disponibili. Le traduzioni sono ausiliarie e possono presentare differenze terminologiche. Verifica sempre la documentazione ufficiale vigente.";
    }

    private void chooseLanguage() {
        final String[] labels = {"🇮🇹 Italiano", "🇬🇧 English", "🇪🇸 Español"};
        int checked = language.equals("en") ? 1 : language.equals("es") ? 2 : 0;
        new AlertDialog.Builder(this).setTitle(L("languageTitle"))
                .setSingleChoiceItems(labels, checked, (d, which) -> {
                    String next = which == 1 ? "en" : which == 2 ? "es" : "it";
                    d.dismiss(); setLanguage(next);
                }).show();
    }

    private void setLanguage(String next) {
        if (next.equals(language)) { home(); return; }
        if (translator != null) { translator.close(); translator = null; }
        translationCache.clear(); language = next; prefs.edit().putString("language", language).apply();
        if (!language.equals("it")) {
            prepareTranslator(() -> home());
        } else home();
    }

    private void prepareTranslator(final Runnable onReady) {
        String target = language.equals("en") ? TranslateLanguage.ENGLISH : TranslateLanguage.SPANISH;
        TranslatorOptions options = new TranslatorOptions.Builder().setSourceLanguage(TranslateLanguage.ITALIAN).setTargetLanguage(target).build();
        translator = Translation.getClient(options);
        DownloadConditions conditions = new DownloadConditions.Builder().build();
        Toast.makeText(this, language.equals("en") ? "Downloading English translation model…" : "Downloading Spanish translation model…", Toast.LENGTH_LONG).show();
        translator.downloadModelIfNeeded(conditions).addOnSuccessListener(v -> onReady.run()).addOnFailureListener(e -> {
            Toast.makeText(this, "Modello non disponibile: l'app userà l'italiano come fallback.", Toast.LENGTH_LONG).show(); onReady.run();
        });
    }

    private void examSection(List<QuizQuestion> bank) {
        stopTimer(); activeBank = bank;
        String title = bank == adcA ? L("a") : L("m");
        base(title + " • ESAME", "20 domande • 25 minuti");
        content.addView(text("20 domande estratte casualmente dalla banca selezionata", 17, WHITE, true));
        content.addView(text("• Tempo massimo: 25 minuti\n• Una risposta per domanda\n• Nessun feedback durante l'esame\n• Revisione degli errori alla fine\n• Criterio della simulazione: 18/20", 14, MUTED, false));
        content.addView(disclaimerCard());
        content.addView(button(L("start"), v -> startExam(bank)));
        content.addView(button(L("back"), v -> home()));
    }

    private void startExam(List<QuizQuestion> bank) {
        activeBank = bank; quiz.clear(); quiz.addAll(bank); Collections.shuffle(quiz); if (quiz.size() > 20) quiz.subList(20, quiz.size()).clear();
        index = 0; score = 0; wrongAnswers.clear(); answerLocked = false; examMode = true; lastExam = true; lastTimeExpired = false; remainingSeconds = 25 * 60L;
        renderQuestion(); startTimer();
    }

    private void startTimer() {
        if (timer != null) timer.cancel();
        timer = new CountDownTimer(remainingSeconds * 1000L, 1000L) {
            @Override public void onTick(long ms) { remainingSeconds = ms / 1000L; updateTimer(); }
            @Override public void onFinish() { remainingSeconds = 0; updateTimer(); if (examMode) { examMode = false; lastTimeExpired = true; showResult(); } }
        }.start();
        updateTimer();
    }

    private void stopTimer() { if (timer != null) { timer.cancel(); timer = null; } timerView = null; }

    private void updateTimer() {
        if (timerView == null) return; long m = remainingSeconds / 60; long s = remainingSeconds % 60;
        timerView.setText(String.format(Locale.ITALY, "⏱  %02d:%02d", m, s)); timerView.setTextColor(remainingSeconds <= 120 ? RED : GREEN);
    }

    private void categories(List<QuizQuestion> bank) {
        activeBank = bank; base(bank == adcA ? L("a") : L("m"), L("categories"));
        Set<String> cats = new HashSet<>(); for (QuizQuestion q : bank) cats.add(q.category);
        List<String> sorted = new ArrayList<>(cats); Collections.sort(sorted);
        for (String cat : sorted) { int n = 0; for (QuizQuestion q : bank) if (q.category.equals(cat)) n++; content.addView(button(cat + " • " + n, v -> startCategory(bank, cat))); }
        content.addView(button(L("back"), v -> home()));
    }

    private void startCategory(List<QuizQuestion> bank, String category) {
        activeBank = bank; quiz.clear(); for (QuizQuestion q : bank) if (q.category.equals(category)) quiz.add(q); Collections.shuffle(quiz);
        index = 0; score = 0; wrongAnswers.clear(); answerLocked = false; examMode = false; lastExam = false; renderQuestion();
    }

    private void startPractice(List<QuizQuestion> bank, int count) {
        activeBank = bank; quiz.clear(); quiz.addAll(bank); Collections.shuffle(quiz); if (count < quiz.size()) quiz.subList(count, quiz.size()).clear();
        index = 0; score = 0; wrongAnswers.clear(); answerLocked = false; examMode = false; lastExam = false; renderQuestion();
    }

    private void renderQuestion() {
        if (index >= quiz.size()) { showResult(); return; }
        QuizQuestion q = quiz.get(index);
        base(examMode ? (activeBank == adcA ? "ADC A • ESAME" : "ADC M • ESAME") : (activeBank == adcA ? L("a") : L("m")), "Domanda " + (index + 1) + " di " + quiz.size());
        if (examMode) {
            timerView = text("⏱  25:00", 16, GREEN, true); timerView.setGravity(Gravity.END); content.addView(timerView); updateTimer();
        }
        ProgressBar p = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal); p.setMax(quiz.size()); p.setProgress(index);
        content.addView(p, new LinearLayout.LayoutParams(-1, dp(7)));
        TextView cat = text(q.category.toUpperCase(Locale.ROOT), 12, BLUE, true); content.addView(cat);
        TextView question = text(q.question, 20, WHITE, true); question.setPadding(dp(4), dp(12), dp(4), dp(16)); content.addView(question);
        Button[] optionButtons = new Button[3];
        for (int i = 0; i < 3; i++) {
            Button b = new Button(this); b.setText((char)('A' + i) + ".  " + q.options.get(i)); b.setTextSize(15); b.setAllCaps(false); b.setGravity(Gravity.START | Gravity.CENTER_VERTICAL); b.setTextColor(WHITE); b.setPadding(dp(14),0,dp(14),0); b.setBackgroundColor(CARD);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(66)); lp.setMargins(0, dp(6), 0, dp(6)); b.setLayoutParams(lp);
            final int choice = i; b.setOnClickListener(v -> answer(choice)); optionButtons[i] = b; content.addView(b);
        }
        if (!examMode) content.addView(text(L("source") + ": Volume " + (activeBank == adcA ? "1 FCO/CIA" : "2 ADC") + " • " + L("manual") + " p. " + q.page, 11, MUTED, false));
        if (!language.equals("it")) translateQuestion(q, question, cat, optionButtons);
    }

    private void translateQuestion(QuizQuestion q, TextView question, TextView cat, Button[] buttons) {
        if (translator == null) { return; }
        String key = language + "|" + q.question;
        String cached = translationCache.get(key);
        if (cached != null) question.setText(cached);
        translateText(q.question, translated -> question.setText(translated));
        translateText(q.category, translated -> cat.setText(translated.toUpperCase(Locale.ROOT)));
        for (int i = 0; i < 3; i++) { final int idx = i; translateText(q.options.get(i), translated -> buttons[idx].setText((char)('A' + idx) + ".  " + translated)); }
    }

    private void translateText(String source, java.util.function.Consumer<String> consumer) {
        if (language.equals("it") || translator == null) { consumer.accept(source); return; }
        String key = language + "|" + source; String cached = translationCache.get(key); if (cached != null) { consumer.accept(cached); return; }
        translator.translate(source).addOnSuccessListener(t -> { translationCache.put(key, t); consumer.accept(t); }).addOnFailureListener(e -> consumer.accept(source));
    }

    private void answer(int choice) {
        if (answerLocked || index >= quiz.size()) return; answerLocked = true;
        QuizQuestion q = quiz.get(index); boolean correct = choice == q.correct;
        if (correct) score++; else wrongAnswers.add(new WrongAnswer(q, q.options.get(choice)));
        if (examMode) { index++; answerLocked = false; renderQuestion(); return; }
        String correctText = q.options.get(q.correct);
        String title = correct ? "✓ " + L("correct") : "✕ " + L("errorsWord");
        String message = (correct ? "" : L("yourAnswer") + ": " + q.options.get(choice) + "\n\n") + L("correctAnswer") + ": " + correctText + "\n\n" + L("manual") + ": p. " + q.page;
        new AlertDialog.Builder(this).setTitle(title).setMessage(message).setPositiveButton(index + 1 < quiz.size() ? "Avanti" : "Risultato", (d,w) -> { index++; answerLocked = false; renderQuestion(); }).setCancelable(false).show();
    }

    private void showResult() {
        stopTimer(); examMode = false;
        base(lastExam ? (activeBank == adcA ? "ADC A • ESITO ESAME" : "ADC M • ESITO ESAME") : "Risultato", lastTimeExpired ? L("timeExpired") : L("complete"));
        int pct = quiz.isEmpty() ? 0 : Math.round(score * 100f / quiz.size());
        TextView scoreView = text(score + " / " + quiz.size(), 46, (lastExam && score >= 18 && !lastTimeExpired) ? GREEN : WHITE, true); scoreView.setGravity(Gravity.CENTER); content.addView(scoreView);
        TextView pctView = text(pct + "%", 23, WHITE, true); pctView.setGravity(Gravity.CENTER); content.addView(pctView);
        if (lastExam) { boolean pass = score >= 18 && !lastTimeExpired; TextView r = text(pass ? L("passed") : L("failed"), 16, pass ? GREEN : RED, true); r.setGravity(Gravity.CENTER); content.addView(r); }
        content.addView(text(L("errorsWord") + ": " + wrongAnswers.size() + " • " + L("correct") + ": " + score, 14, MUTED, true));
        if (!wrongAnswers.isEmpty()) {
            content.addView(text("📊 " + (language.equals("en") ? "Topics to review" : language.equals("es") ? "Temas a repasar" : "Categorie da ripassare"), 18, WHITE, true));
            addCategoryStats();
            content.addView(button(L("errors"), v -> reviewErrors()));
        }
        content.addView(button(lastExam ? L("newExam") : L("newPractice"), v -> { if (lastExam) examSection(activeBank); else startPractice(activeBank, Math.min(20, activeBank.size())); }));
        content.addView(button(L("home"), v -> home()));
    }

    private void addCategoryStats() {
        Map<String,Integer> counts = new HashMap<>();
        for (WrongAnswer w : wrongAnswers) counts.put(w.q.category, counts.getOrDefault(w.q.category, 0) + 1);
        List<Map.Entry<String,Integer>> list = new ArrayList<>(counts.entrySet()); list.sort((a,b) -> b.getValue() - a.getValue());
        for (Map.Entry<String,Integer> e : list) content.addView(text("• " + e.getKey() + " — " + e.getValue() + " " + L("errorsWord").toLowerCase(Locale.ROOT), 14, MUTED, false));
    }

    private void reviewErrors() {
        base(L("review"), wrongAnswers.size() + " " + L("errorsWord").toLowerCase(Locale.ROOT));
        for (int i = 0; i < wrongAnswers.size(); i++) {
            WrongAnswer w = wrongAnswers.get(i);
            content.addView(text((i + 1) + ". " + w.q.question, 17, WHITE, true));
            content.addView(text(L("yourAnswer") + ": " + w.chosen, 14, RED, false));
            content.addView(text("✓ " + L("correctAnswer") + ": " + w.q.options.get(w.q.correct), 14, GREEN, true));
            content.addView(text(L("manual") + ": p. " + w.q.page + " • " + L("category") + ": " + w.q.category, 11, MUTED, false));
            content.addView(new Space(this), new LinearLayout.LayoutParams(1, dp(12)));
        }
        content.addView(button(L("back"), v -> showResult()));
    }

    private void info() {
        String sourceA = "Volume 1 – Abilitazione alla guida in Apron FCO/CIA, Ed. 1 Rev. 1, 12/06/2024.";
        String sourceM = "Volume 2 – E-16 ADC, Abilitazione alla guida in Area di Manovra, Aeroporto Leonardo da Vinci Roma Fiumicino.";
        new AlertDialog.Builder(this).setTitle("FCO Airside Quiz")
                .setMessage("111 domande ADC A + 123 domande ADC M.\n\n" + sourceA + "\n" + sourceM + "\n\n" + disclaimerText() + "\n\nLe traduzioni English/Español sono realizzate on-device con Google ML Kit; al primo utilizzo viene scaricato il modello linguistico.")
                .setPositiveButton(L("close"), null).show();
    }

    private void loadBank(String asset, List<QuizQuestion> target) {
        try (BufferedReader r = new BufferedReader(new InputStreamReader(getAssets().open(asset), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder(); String line; while ((line = r.readLine()) != null) sb.append(line);
            JSONObject root = new JSONObject(sb.toString()); JSONArray arr = root.getJSONArray("questions");
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i); JSONArray opts = o.getJSONArray("options"); List<String> options = new ArrayList<>();
                for (int j = 0; j < opts.length(); j++) options.add(opts.getString(j));
                target.add(new QuizQuestion(o.getString("question"), options, o.getInt("correct"), o.getString("category"), o.getInt("manualPage")));
            }
        } catch (Exception e) { throw new RuntimeException("Unable to load question bank: " + asset, e); }
    }
}
