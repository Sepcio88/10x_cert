---
title: "[3.2] Wzorce i antywzorce promptowania"
course: "10xdevs-3-prework"
language: "pl"
source: "Przeprogramowani.pl"
exported: "2026-05-17"
format: "markdown"
---

W poprzedniej lekcji naszego preworku pokazaliśmy ci, jak LLMy przewidują kolejne tokeny i dlaczego ułomności takie jak zmyślanie logiki są wpisane w ich naturę.

Teraz czas odnieść tę wiedzę do praktyki.

Początki pracy z agentami zawsze wyglądają podobnie - wpisujesz „napraw ten błąd”, a potem obserwujesz, jak system przez kilkanaście minut błądzi w kodzie i w końcu... psuje ci builda. A kiedy coś faktycznie naprawia, ty masz poczucie "kurcze, to można zrobić lepiej". Klasyk.

Ta sama krótka instrukcja, która w ChatGPT daje bezpieczną podpowiedź tekstową, w środowisku agentowym prowadzi często do dziwnych modyfikacji w wielu plikach. Różnica nie leży w "lepszym modelu". Prompt chatbota to jednorazowe zapytanie niskiego ryzyka, a prompt do agenta to długoterminowy kontrakt wysokiej wagi.

W trakcie 10xDevs będziemy ten kontrakt rozbierać na bardzo konkretne workflow: planowanie, implementację, code review, testy, pracę na branchach i zespołowe zasady używania AI. Tutaj budujemy fundament.

## Dwa tryby pracy z AI

Słowo "prompt" obsługuje dziś dwa zupełnie różne tryby dialogu z AI. W pracy z przeglądarkowym chatbotem wpisujesz instrukcję, a po otrzymaniu tekstu sam decydujesz, co z nim zrobić. Tura trwa zwykle sekundy, nie ma efektów ubocznych, a drobne nieścisłości najwyżej nieznacznie pogarszają styl odpowiedzi.

W przypadku agenta ten sam tekst uruchamia autonomiczną pętlę decyzyjną. System planuje co robić, korzysta z narzędzi, obserwuje wyniki i sam koryguje efekty pracy - często przez dziesiątki następujących po sobie iteracji.

Dlatego musisz pamiętać o trzech kluczowych różnicach między typowym zapytaniem do ChatGPT a np. Claude Code:

1. **Czas trwania.** Prompt do chatbota żyje krótko - jedną turę. W agencie dwuznaczność, która wydaje się niegroźna na początku, w dziesiątej iteracji wykorzystywania narzędzi potrafi sprawić, że kod zacznie być modyfikowany w zupełnie nieoczekiwany sposób.
2. **Efekty uboczne.** Agent edytuje pliki, odpala testy i modyfikuje repozytorium. Twój styl komunikacji musi jasno określać nie tylko to, co robić, ale też czego stanowczo unikać: których plików nie dotykać, czy publiczne API ma zostać bez zmian, czy migracja może zmieniać dane, jaki budżet wydajności lub dostępności obowiązuje. System bez granic będzie improwizował.
3. **Kaskada błędów.** Chatbot nie liczy się z konsekwencjami swoich odpowiedzi. Agent - wręcz przeciwnie. Każde nieudane zadanie traktuje maksymalnie poważnie, starając się poprawić i wdrożyć niezbędne zmiany. Stąd - przy braku ostrożności - często obserwowalny efekt "pętli bez wyjścia" - sytuacji, w której agent traci poczucie celu i w pętli skupia się na naprawianiu tego, co w perspektywie oryginalnego polecenia zupełnie nieistotne.

Czy oznacza to, że potrzebujesz pisania idealnych, wielostronicowych esejów za każdym razem kiedy korzystasz z AI? Wręcz przeciwnie. W dobrze skonfigurowanym środowisku agentowym twój prompt jest krótki i celny — bo większość instrukcji żyje gdzie indziej, w hierarchii warstw, które konfigurujesz raz, a działają w każdej sesji.

## Anatomia prompta agentowego

W chacie twój prompt to zwykle jedyne, co model widzi. W środowisku agentowym jest odwrotnie — wiadomość, którą wpisujesz, to ostatnia warstwa w stosie instrukcji budowanych hierarchicznie.

Wyobraź sobie ten stos od dołu:

- **System prompt harnessu** — wbudowane zachowanie: bezpieczeństwo, kompresja kontekstu, zarządzanie narzędziami. Tego nie zmieniasz — to robota producenta (o harnessie mówiliśmy w lekcji 1.2).
- **Reguły projektowe** (`CLAUDE.md`, `AGENTS.md`) — trwałe zasady specyficzne dla twojego projektu. Piszesz je raz, a obowiązują w każdej sesji. Tu trafiają konwencje, ograniczenia i wzorce architektury. Będzie o tym dedykowana lekcja.
- **Pamięć** — kontekst budowany z poprzednich sesji, jeśli dane narzędzie i ustawienia organizacji na to pozwalają. Czasem agent zapamiętuje twoje preferencje, podjęte decyzje i feedback. Czasem pamięć jest wyłączona albo ograniczona, więc ważne decyzje i tak powinny trafić do projektu.
- **Skille** — gotowe szablony promptów wywoływane na żądanie (`/commit`, `/code-review`, `/plan`). Standaryzują powtarzalne zadania, żebyś nie pisał tych samych instrukcji za każdym razem.
- **Twój prompt** — konkretny cel do osiągnięcia tu i teraz.

Zwróć uwagę, kto i jak często konfiguruje poszczególne warstwy:

| Warstwa           | Kto konfiguruje             | Jak często                            | Przykład                                     |
| ----------------- | --------------------------- | ------------------------------------- | -------------------------------------------- |
| System prompt     | Producent narzędzia         | Nigdy (z twojej strony)               | Bezpieczeństwo, kompresja kontekstu          |
| Reguły projektowe | Ty lub zespół               | Od czasu do czasu — zmiany ewolucyjne | CLAUDE.md: "testy Vitest, Svelte, nie React" |
| Pamięć            | Narzędzie albo konfiguracja | Zależnie od środowiska                | "User stosuje conventional commits"          |
| Skille            | Ty lub zespół               | Reużywalnie, wg potrzeby              | /commit, /code-review                        |
| Prompt            | Ty, tu i teraz              | Każde zadanie                         | "Napraw bug w calculateDiscount()"           |

To dlatego dobry prompt agentowy bywa zaskakująco krótki. Ograniczenia, kontekst i konwencje żyją w niższych warstwach — nie musisz ich powtarzać za każdym razem. Twoja wiadomość skupia się na tym, co naprawdę się zmienia: **konkretny cel** i **kryteria sukcesu**.

Dobry prompt agentowy przygotowujesz więc jeszcze zanim zaczniesz go pisać — najpierw konfigurujesz warstwy poniżej, a potem określasz, jak sprawdzisz, czy praca została wykonana prawidłowo.

W rozmowie z chatbotem tłumaczysz modelowi, _jak_ ma ci odpowiedzieć. W agencie określasz, _po czym system pozna_, że zadanie zostało w całości ukończone (np. poprawny build, testy i brak błędów lintera). Resztę kontekstu agent ma już na pokładzie.

W głównym programie 10xDevs przećwiczymy też, które reguły warto trzymać w `AGENTS.md` lub `CLAUDE.md`, a które lepiej wynieść do osobnych skilli i procedur. Tu wystarczy jedna intuicja: prompt w dobrze skonfigurowanym środowisku nie musi opisywać całego systemu pracy od A do Z.

## Modele rozumujące w praktyce

Wiodące modele rozumujące potrafią rozkładać złożone problemy na mniejsze części.

W ich przypadku tradycyjne techniki "prowadzenia za rękę", takie jak narzucanie myślenia krok po kroku czy dostarczanie wielu przykładów rozwiązanych zadań, mogą wręcz pogorszyć rezultaty. Te modele analizują problem na własny, wyuczony sposób, a nasze próby narzucenia im konkretnego toku myślenia często wprowadzają szum.

Optymalny prompt dla takich modeli to czysty cel połączony z żelaznymi ograniczeniami, bez żadnych dodatkowych, zmyślnych sztuczek.

Zobaczmy to na trzech konkretnych przykładach, z których każdy wynika wprost z tego, jak te modele działają pod spodem.

**1\. Nie narzucaj kroków, jeśli nie musisz.**

Model rozumujący rozkłada problem wewnętrznie. Kiedy narzucasz mu sekwencję kroków, zmuszasz go do podążania twoją ścieżką zamiast znaleźć optymalną.

> ❌ _„Przeanalizuj tę funkcję krok po kroku. Najpierw sprawdź typy argumentów, potem prześledź przepływ danych, następnie zidentyfikuj błąd i zaproponuj poprawkę."_

> ✅ _„Napraw błąd powodujący podwójne naliczanie rabatu w calculateDiscount(). Testy w discount.test.ts muszą przechodzić."_

W pierwszym przypadku wymuszasz konkretny tok rozumowania, który - w zależności od problemu - może być gorszy od tego, co model sam by wybrał. W drugim dajesz cel i obiektywne kryterium sukcesu, a model sam decyduje, jak do niego dojść.

Są jednak wyjątki. Przy migracjach danych, bezpieczeństwie, płatnościach, dostępności czy twardych konwencjach zespołu, te kroki mogą być potrzebne. Wtedy nie prowadzisz modelu za rękę dla zabawy, tylko pilnujesz procesu, którego nie wolno pominąć.

**2\. Nie dawaj przykładów, które zamykają problem.**

Modele rozumujące zostały wytrenowane tak, aby samodzielnie dochodzić do rozwiązań problemów. Kiedy dostarczasz im gotowy wzorzec, zawężasz przestrzeń poszukiwań do twojego sposobu myślenia — a nie zawsze jest on najlepszy.

> ❌ _„Oto jak zoptymalizowałem podobną funkcję: \[15 linii kodu\]. Zoptymalizuj renderowanie w userList.ts w analogiczny sposób."_

> ✅ _„Zoptymalizuj renderowanie listy użytkowników w userList.ts — przy 5000 rekordów czas renderowania nie powinien przekraczać 200ms."_

W pierwszym prompcie model może posłusznie skopiować twój wzorzec, nawet jeśli istnieje znacznie lepsze rozwiązanie. W drugim dostaje konkretny, mierzalny cel i swobodę w doborze strategii.

To nie znaczy, że przykłady są złe. Są świetne, gdy pokazujesz styl odpowiedzi, format raportu, strukturę changeloga albo zasady własnego DSL-a. Problem zaczyna się wtedy, gdy przykład udaje najlepsze rozwiązanie techniczne.

**3\. Nie narzucaj techniki — podaj ograniczenia.**

To naturalna konsekwencja dwóch poprzednich zasad. Kiedy mówisz modelowi "użyj wzorca Observer" albo "napisz to z użyciem reduce", odcinasz go od potencjalnie lepszych alternatyw.

> ❌ _„Użyj wzorca Observer do synchronizacji stanu między komponentami. Stwórz klasę EventBus z interfejsem Subscriber."_

> ✅ _„Komponenty Dashboard i Sidebar muszą reagować na zmianę filtrów w czasie rzeczywistym. Aktualnie stan jest niespójny po szybkim przełączaniu. Napraw synchronizację — bez zmiany publicznego API komponentów."_

Pierwszy prompt to gotowa specyfikacja techniczna, która nie zostawia modelowi żadnej przestrzeni do refleksji. Drugi definiuje problem, objaw i granicę — resztę model ustali sam, i bardzo prawdopodobne, że będzie to podejście `good enough`.

**Ważne:** Zdarzają się oczywiście sytuacje, kiedy narzucenie konkretnego wzorca ma sens. Jeśli po 1–2 próbach agent wciąż nie trafia w twoje oczekiwania, a ty masz silne preferencje co do stylu implementacji, wtedy warto być bardziej konkretnym. Możesz też poprosić agenta o zaproponowanie np. trzech różnych podejść do realizacji zadania — z uwzględnieniem złożoności i dobrych praktyk — a dopiero wtedy wybrać jedno i dać zielone światło do implementacji.

Czyli nie chodzi o zakaz instrukcji. Chodzi o to, żeby nie mylić celu z mikrozarządzaniem.

## Popularne antywzorce promptowania

Skoro znamy właściwą strukturę, spójrzmy na typowe potknięcia. Praca z agentem wymaga po prostu znacznie większej dyscypliny niż swobodna rozmowa na czacie.

**1\. Brak granic.**Agent bez określonych ograniczeń od razu zaczyna improwizować. Zmiana prostego warunku IF może przerodzić się w wielki refaktor niepowiązanego pliku, dziwną aktualizację bezpiecznej zależności czy zmianę konwencji nazewniczych na drugim końcu projektu. Zamiast małej poprawki otrzymujesz potężny diff pełen niechcianych niespodzianek.

Najczęściej brakuje prostych granic: "edytuj tylko `src/billing/*`", "nie zmieniaj publicznego API", "nie dodawaj zależności", "najpierw pokaż plan", "bez mojej zgody nie uruchamiaj migracji".

**2\. Przeładowanie całego kontekstu na start.**Wrzucanie całości kodu aplikacji do pierwszego prompta to bardzo zły pomysł. Model natychmiast gubi się w nadmiarze informacji, nawet jeśli są to poprawne dane. Zdecydowanie lepiej jest dać agentowi albo wąski zakres przestrzeni roboczej (kiedy wiesz, którego fragmentu projektu dotyczy zmiana), albo swobodę przeszukiwania plików i samodzielnej eksploracji niezbędnych powiązań (kiedy model ma wyszukać odpowiednie obszary do edycji).

**3\. Brak obiektywnych kryteriów.**Zwroty typu "upewnij się, że działa" kończą się sztucznym zapewnieniem przez model, że wszystko wygląda wyśmienicie - bardzo często bez wykonania ani jednej komendy w terminalu. System potrzebuje konkretnego punktu odniesienia: komendy lintera, jasnego statusu kompilacji czy przechodzących testów. To możesz konfigurować zarówno na poziomie dokumentów typu `CLAUDE.md`, jak i reużywalnych komend albo hooków.

Jeszcze lepiej, jeśli kryterium sprawdza zachowanie, a nie tylko implementację. Test dopisany przez agenta może przecież przykrywać dokładnie ten sam błąd, który przed chwilą wygenerował. Niby zielono, a jednak nie o to chodziło.

**4\. Kompresja hierarchii w jedną warstwę.**Wrzucanie do `CLAUDE.md` absolutnie wszystkiego — reguł, procedur, preferencji, kontekstu — sprawia, że model gubi te najważniejsze instrukcje w szumie. Powtarzalne procedury lepiej wynieść do skilli, preferencje zostawić pamięci, a w pliku konfiguracyjnym trzymać tylko fundamentalne reguły projektu.

**5\. Ufanie poprawnej składni.**Kod może się kompilować i nadal robić złą rzecz. Agent potrafi dodać semantycznie błędny warunek, naprawić problem przez połknięcie wyjątku albo ominąć decyzję podjętą w połowie wątku, bo późniejszy kontekst stał się głośniejszy od wcześniejszego.

To jest moment, w którym jako uczestnik 10xDevs masz myśleć jak inżynier, nie jak widz pokazu AI. Poprawna składnia to dopiero start rozmowy.

Czy jesteś w stanie ustrzec się tych wszystkich błędów przy pierwszym uruchomieniu? Prawdopodobnie nie, ale systematyczne budowanie dobrych promptów i całego środowiska agentowego - co dokładnie przećwiczymy na żywym kodzie w 10xDevs - bardzo szybko wejdzie ci w nawyk.

## Kontrakt prompta

Dobry prompt agentowy nie musi być długi. Powinien za to odpowiadać na kilka konkretnych pytań:

- **Cel:** co ma być prawdą po zakończeniu pracy?
- **Zakres:** które pliki, moduły albo ścieżki są w grze?
- **Granice:** czego agent nie może zmienić bez zgody?
- **Kontekst:** skąd ma brać prawdę: issue, logi, test, dokumentację, fragment kodu?
- **Weryfikacja:** jaką komendą lub scenariuszem sprawdzi wynik?
- **Raport:** co ma zwrócić na końcu: diff summary, ryzyka, testy, decyzje?
- **Uprawnienia:** czy wolno edytować pliki, czy tylko eksplorować i zaplanować?

Jeśli masz już wstępnie skonfigurowane `AGENTS.md` / `CLAUDE.md`, część tych elementów możesz pominąć (np. jak uruchomić testy po implementacji).

## Gotowe szablony

Poniższe szablony nie są magicznymi formułkami. Traktuj je jak startowe kontrakty, które dopasowujesz do swojego repozytorium.

**Bugfix**

```text
Naprawiamy krytyczny incydent. Oto zgłoszenie z supportu:
<TICKET>
[krótki opis objawu].
</TICKET>

Prawdopodobny zakres zmian dotyczy @{module/directory/file}
Najpierw znajdź przyczynę i wskaż minimalny plan, potem wprowadź poprawkę.
Nie zmieniaj publicznego API bez mojej zgody.

Weryfikacja: uruchom [komenda testu/builda] i opisz wynik.
Na końcu podsumuj zmienione pliki i ryzyka.

```

**Refaktor**

```text
Zrefaktoryzuj [obszar], zachowując obecne zachowanie.

Cel: [np. uproszczenie duplikacji / rozdzielenie odpowiedzialności].
Zakres: [pliki/moduły].
Nie zmieniaj kontraktu publicznych funkcji ani formatu danych.
Jeśli zauważysz potrzebę zmiany publicznego API, zatrzymaj się i poinformuj mnie.

Weryfikacja: [komenda] oraz krótki opis, jak potwierdziłeś brak zmiany zachowania.

```

**Code review**

```text
Przejrzyj zmiany pod kątem błędów, regresji i brakujących testów.

Oto reguły zespołowe: {rules}

Skup się na zachowaniu, bezpieczeństwie, edge case'ach i zgodności z konwencjami projektu.
Zwróć tylko konkretne uwagi z plikiem i linią.
Na końcu dodaj krótką listę testów, których brakuje albo których nie da się ocenić z diffu.

```

**Eksploracja bez edycji**

```text
Zbadaj, jak w tym projekcie działa [obszar/funkcja].

Znajdź najważniejsze miejsca w kodzie, zależności i przepływ danych między składowymi.
Na końcu zaproponuj 2-3 możliwe podejścia do rozwiązania [problem], z ryzykami.
Zatrzymaj się przed implementacją i nie edytuj plików.

```

**Implementacja po planie**

```text
Zaimplementuj zatwierdzony plan z [link/sekcja].

Jeśli plan okaże się nieaktualny, zatrzymaj się i wyjaśnij konflikt.
Weryfikacja: [komenda].

```

Najważniejszy wzorzec jest prosty: najpierw eksploruj nabudowująć kontekt, a później edytuj (to ma być niemal trywialne po wcześniejszym zebraniu informacji).

## Najważniejsze zasady

- **Określaj kryteria sukcesu, a nie ścieżkę.** Zanim zaczniesz pisać prompt, zastanów się: "po czym system zorientuje się, że skończył?". Brak twardych kryteriów weryfikacji to najszybsza droga do nieskończonych, bezproduktywnych iteracji.
- **Rozkładaj instrukcje na warstwy.** Reguły projektowe w `CLAUDE.md`, powtarzalne procedury w skillach, preferencje w pamięci, cel w prompcie. Każda warstwa ma swój zakres — nie zgniataj ich w jedno miejsce.
- **Nie narzucaj procesu nowym modelom.** Modele rozumujące wymagają konkretnego celu i jasnych granic. Próby podawania dziesiątek przykładów czy prowadzenia ich krok po kroku zakłócają ich skuteczne, wbudowane procesy analityczne. Naginaj te reguły w szczególnych przypadkach, kiedy model naprawdę nie ma pojęcia jak podejść do danego problemu.

Co możesz zrobić od razu?

- **Reguła decyzyjna:** jeśli zadanie jest niejasne albo dotyka wielu plików, najpierw poproś o eksplorację i plan, a dopiero potem pozwól na edycję.
- **Kontrola bezpieczeństwa:** każdy prompt z prawem do edycji powinien mieć zakres, granice i komendę weryfikującą lub odpowiednie instrukcje w regułach projektu.
- **Akcja na dziś:** na podstawie zebranej wiedzy zastanów się, czego do tej pory brakowało twoim promptom. Jakie elementy podawać wprost, a jakie umieścić w projektowej konfiguracji środowiska?

## Materiały dodatkowe

- Prompt engineering overview / Anthropic Docs / 2025 — <https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview>
- Reasoning best practices / OpenAI Docs / 2025 — <https://developers.openai.com/api/docs/guides/reasoning-best-practices>
- Effective context engineering for AI agents / Anthropic Engineering / 2025-09-29 — <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- Agentic Engineering Patterns / Simon Willison / 2026-02-23 — <https://simonwillison.net/guides/agentic-engineering-patterns/>
- AGENTS.md / agentsmd / GitHub — <https://github.com/agentsmd/agents.md>
- Chain of Draft: Thinking Faster by Writing Less / Xu et al. / arXiv 2502.18600 / 2025 — <https://arxiv.org/abs/2502.18600>
