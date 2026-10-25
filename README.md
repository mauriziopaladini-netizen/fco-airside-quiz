# FCO Airside Quiz

Repository con il progetto Android originale ripulito e una prima Web App sperimentale che usa le stesse banche domande.

## Struttura
- `android/`: progetto Android Studio (Java + Gradle Wrapper).
- `webapp/`: Web App statica per browser, pubblicabile con GitHub Pages.
- `shared/`: banche domande JSON condivise tra le versioni.

## Pubblicare la Web App con GitHub Pages
1. Crea un repository GitHub pubblico chiamato `fco-airside-quiz`.
2. Carica il contenuto di questa cartella nella radice del repository (non caricare la cartella ZIP come singolo file).
3. Apri **Settings → Pages**.
4. In **Build and deployment**, scegli **Deploy from a branch**, branch `main`, folder `/ (root)`, quindi **Save**.
5. Quando Pages ha terminato, l'indirizzo sarà simile a `https://TUO-UTENTE.github.io/fco-airside-quiz/webapp/`.

La Web App legge i JSON da `../shared/`, quindi mantieni la struttura delle cartelle. Puoi anche impostare Pages dalla root, ma il link da condividere è quello della cartella `/webapp/`.

## Compilare Android
1. Apri la cartella `android/` con Android Studio.
2. Usa JDK 17 e il Gradle Wrapper incluso (`gradlew.bat` su Windows).
3. Dopo la sincronizzazione Gradle, usa **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
4. Non caricare APK di debug nel repository come file sorgente; allega l'APK a una GitHub Release.

## Pubblicare l'APK in una Release
1. Nel repository GitHub, apri **Releases → Create a new release**.
2. Crea un tag (es. `v3.0.1`).
3. Allega il file APK generato e pubblica la Release.

## Attenzione prima della pubblicazione pubblica
Il repository pubblico rende il codice e i file JSON visibili a chiunque. Pubblica le banche domande soltanto se hai il diritto di ridistribuirle. Non includere password, chiavi, certificati di firma o dati personali.

## Limiti della Web App iniziale
Questa è una prima versione di base: interfaccia in italiano, modalità allenamento, casuale, categoria e simulazione da 20 domande/25 minuti. È una nuova implementazione web, non una conversione automatica dell'interfaccia Android. Verifica accuratamente domande, risposte e comportamento prima di distribuirla agli utenti.

## Disclaimer
Strumento di studio non ufficiale; non è emesso, approvato o garantito da ADR o ENAC e non sostituisce la documentazione o la formazione ufficiale.
