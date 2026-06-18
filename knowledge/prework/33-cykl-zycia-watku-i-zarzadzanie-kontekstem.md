---
title: "[3.3] Cykl życia wątku i zarządzanie kontekstem"
course: "10xdevs-3-prework"
language: "pl"
source: "Przeprogramowani.pl"
exported: "2026-05-17"
format: "markdown"
---

W poprzedniej lekcji pokazaliśmy ci, jak dobry prompt potrafi naprowadzić agenta na właściwy tor i jaki prompt dzisiaj byłby już uważany za suboptymalny.

Ale co, gdy ten sam agent po czterdziestu minutach pracy zaczyna zachowywać się tak, jakby ktoś podmienił mu pamięć, mimo że cały czas otrzymuje prompty wysokiej jakości?

Sytuacja zawsze wygląda podobnie - jeszcze niedawno agent czytał pliki, lokalizował błąd i proponował diff z sensownym uzasadnieniem. A teraz powtarza się, „odkrywa" pliki, które sam znalazł trzy tury wcześniej, gubi nazwy ścieżek i generuje coraz dłuższe odpowiedzi... które nie prowadzą do żadnej decyzji.

Do tego po raz trzeci „naprawia" ten sam test obejściem, które przed chwilą sam uznał za błędne. Brzmi znajomo? Niestety, to nie jest problem z charakterem modelu.

Twój prompt się nie zmienił. Model się nie zmienił. Zmieniło się okno kontekstowe, a właściwie jego zawartość.

Wcześniejsze lekcje preworku ustawiły dwa fundamenty: kontekst jest zasobem, a dobry prompt potrzebuje celu i ograniczeń. Brakuje trzeciego - świadomego zarządzania kontekstem w czasie. Kiedy go czyścić, kiedy kompresować, kiedy izolować, a kiedy po prostu zacząć od nowa.

## Czym jest context engineering

W czerwcu 2025 roku Andrej Karpathy opisał `context engineering` jako praktykę wypełniania okna kontekstowego dokładnie tym, co jest potrzebne do następnego kroku Agenta.

Harrison Chase z LangChain ujął to bardziej operacyjnie: chodzi o systemy, które dostarczają modelowi właściwe informacje i narzędzia we właściwym formacie.

Różnica między `prompt engineeringiem` a `context engineeringiem` nie jest kosmetyczna. Prompt engineering to redagowanie tekstu - piszesz lepsze instrukcje i dostajesz lepsze odpowiedzi. Context engineering to **projektowanie systemu**, który decyduje, co w ogóle trafia do okna kontekstowego modelu, kiedy i w jakiej formie. Oczywiście, inaczej tym systemem będzie zarządzał twórca Agenta, a inaczej jego użytkownik, ale obu obowiązują te same ograniczenia.

W agencie działającym przez dziesiątki tur sam prompt to zaledwie punkt startowy. O wyniku operacji decyduje to, co agent widział na przekroju całej sesji.

LangChain w artykule „Context Engineering for Agents" zaproponował cztery strategie, które tworzą użyteczną mapę terenu:

- **Write** — zapisuj informacje poza kontekstem, żeby agent mógł do nich wrócić. Notatki w pliku, plany w markdownie, commity cząstkowych wyników. To pamięć, która przeżywa restart sesji.
- **Select** — wybieraj, co jest istotne dla następnego kroku. Zamiast wrzucać 20 plików „na wszelki wypadek", pozwól agentowi dociągać kontekst dynamicznie - grep, semantic search, odczyt na żądanie albo referencje ze znakiem `@` (w `@`\-mentions).
- **Compress** — redukuj objętość z zachowaniem sensu. Kompakcja historii, streszczenia, przycinanie starszych wiadomości.
- **Isolate** — separuj odpowiedzialności. Subagent eksploruje repozytorium we własnym oknie kontekstowym, a do głównej rozmowy wraca tylko podsumowanie.

Te cztery strategie to nie lista technik do zapamiętania, tylko mapa decyzji. Każda tura pracy z agentem jest - świadomie lub nie - decyzją `Write` / `Select` / `Compress` / `Isolate`.

Jako uczestnik 10xDevs będziesz tę mapę stosować codziennie. Programista nowej generacji podejmuje te decyzje celowo, a nie pozwala kontekstowi rosnąć, aż model zaczyna się dławić.

Więcej o budowaniu trwałej pamięci, pracy z repozytorium i izolacji zadań zobaczysz w głównych modułach 10xDevs. Tutaj wystarczy nam praktyczna mapa: co zrobić, gdy wątek zaczyna tracić jakość.

## Jak żyje wątek z agentem

Zobaczmy teraz, jak wygląda cykl życia jednej rozmowy i kiedy podejmować jakie decyzje.

Najprostszy schemat wygląda tak:

1. **Świeży wątek** \- agent dostaje reguły projektu, cel i pierwszy kontekst.
2. **Eksploracja** \- agent czyta pliki, logi, dokumentację i zbiera fakty.
3. **Plan** \- ustalasz zakres zmian, ograniczenia i sposób weryfikacji.
4. **Implementacja** \- agent modyfikuje pliki albo przygotowuje konkretny diff.
5. **Weryfikacja** \- uruchamiasz testy, build, lint albo ręczny scenariusz.
6. **Kompakcja lub przekazanie pracy** \- zapisujesz decyzje i redukujesz historię.
7. **Zamknięcie lub restart** \- kończysz logiczną jednostkę pracy albo zaczynasz nowy wątek.

Każdy wątek z agentem zaczyna się od **świeżego okna kontekstowego** \- system prompt, `AGENTS.md` lub `Cursor Rules` i twoja pierwsza wiadomość. To moment najwyższej jakości odpowiedzi, bo model ma mało danych i nikt nie zamieszał mu w głowie zbędnymi informacjami.

Z każdą kolejną turą do okna dochodzą odpowiedzi modelu, wyniki tool calli, odczyty plików, komunikaty o błędach. W praktyce im więcej przypadkowej historii trafia do rozmowy, tym trudniej modelowi utrzymać ostrość na aktualnej decyzji.

Kluczowa umiejętność operacyjna to rozpoznanie **sygnałów degradacji**.

Nie chodzi o magiczną liczbę tokenów. Chodzi o zachowanie:

- agent powtarza poprzednie ustalenia i „odkrywa" rzeczy, które sam znalazł kilka tur wcześniej,
- wymyśla ścieżki, komendy albo pliki, które nie pasują do repozytorium,
- ignoruje zaakceptowane ograniczenia, na przykład „nie ruszaj publicznego API",
- łata wokół testu, który nie przechodzi, zamiast wrócić do przyczyny,
- jego podsumowania robią się dłuższe, ale liczba decyzji maleje,
- zaprzecza wcześniejszym ustaleniom.

Kiedy widzisz dwa lub więcej takich sygnałów, czas na decyzję, nie na kolejny prompt. Serio - trzeci prompt „skup się bardziej" rzadko ratuje sytuację.

Masz cztery opcje, i nie są synonimami. Nazwy komend zależą od narzędzia, więc potraktuj poniższą tabelę jako mapę decyzji, a nie uniwersalną instrukcję klawiaturową:

| Sytuacja                                    | Narzędzie                                           | Dlaczego                                                                |
| ------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Sesja się rozrosła, ale kierunek jest dobry | Kompakcja, np. /compact <co zachować>               | Redukcja historii z zachowaniem decyzji, ścieżek i otwartych ryzyk      |
| Zmiana tematu lub koniec zadania            | Czyszczenie, np. /clear                             | Reset rozmowy przy zachowaniu reguł projektu ładowanych przez narzędzie |
| Ostatni krok był zły                        | Cofnięcie ostatnich tur, jeśli narzędzie to wspiera | Powrót przed błędną decyzję bez resetu całej sesji                      |
| Sesja jest nie do uratowania                | Nowy wątek                                          | Commitnij wiedzę do pliku, zacznij od zera z lepszym promptem           |

Kiedy stosować `/clear` a kiedy `/compact`? To zależy od sytuacji.

Czyszczenie wątku to operacja odzyskująca najwięcej miejsca w oknie, ale tracisz szczegóły bieżącej rozmowy. Stosuj je wtedy, kiedy dłuższa sesja z agentem służyła wyłącznie prototypowaniu, a nie docelowemu zadaniu.

Również wtedy, kiedy osiągnąłeś określone zadanie i chcesz przejść do nowego tematu.

Kompaktowanie to z kolei „miękki reset" z określeniem tego, co powinno zostać zachowane w uproszczonej formie. W zależności od narzędzia szczegóły starej historii mogą być niewidoczne albo mocno streszczone, więc nie traktuj kompakcji jak pełnego archiwum.

Anthropic w dokumentacji zaleca konkretną regułę - jeśli poprawiałeś agenta więcej niż dwa razy w tej samej sprawie, często lepiej zrobić `/clear` i zacząć od nowa z lepszym promptem niż brnąć dalej w zaśmieconym kontekście lub wykonywać `/compact`.

Lee Robinson z Cursora opisuje podobną zasadę: nowy wątek ma sens, gdy przechodzisz do innego zadania, agent powtarza te same błędy albo kończysz logiczną jednostkę pracy.

## Co zapisać przed resetem

Największy błąd przy `/clear` albo decyzji o nowym wątku? Każdorazowe usuwanie historii, którą właśnie wypracowałeś.

Przed resetem zapisz w pliku, commicie albo krótkim podsumowaniu:

- aktualny cel zadania,
- zaakceptowane decyzje techniczne,
- pliki, które zostały zmienione albo powinny zostać zmienione,
- komendy uruchomione do tej pory i ich wynik,
- status testów, buildu albo ręcznej weryfikacji,
- otwarte ryzyka i rzeczy, których agent nie powinien ruszać,
- następny prompt, od którego chcesz wznowić pracę.

To jest strategia `Write` w najprostszej wersji. Mało efektowna, bardzo skuteczna.

Przy kompakcji możesz użyć takiego szablonu:

```text
Zachowaj: finalne decyzje, ścieżki plików, wykonane komendy, status testów, zaakceptowane ograniczenia i nierozwiązane ryzyka.
Usuń: nieudane próby, duplikaty logów, pośrednie hipotezy, powtórzone wyjaśnienia i szczegóły, które nie wpływają na następny krok.
Następny krok: <jedno konkretne działanie, od którego agent ma zacząć po kompakcji>.

```

W trakcie 10xDevs będziemy do tego wracać przy planowaniu pracy z agentami, testach i przeglądach zmian. Na razie zapamiętaj prostą regułę: jeśli coś ma przetrwać reset, zapisz to poza rozmową.

## Izolacja i pamięć zewnętrzna

Compact i clear działają w ramach jednego wątku. Ale co, jeśli sam wątek nie jest właściwym miejscem na daną operację?

**Subagenty** to architekturalny wzorzec izolacji kontekstu, nie tylko wygodna funkcja. W narzędziach, które je wspierają, subagent pracuje we własnym oknie kontekstowym - wyniki odczytów plików, wyszukiwania i analizy zostają u niego. Do głównej rozmowy wraca tylko podsumowanie.

Anthropic w artykule o context engineering wymienia to jako jedną z trzech technik dla długich sesji, obok kompakcji i strukturyzowanych notatek. Najprościej: zamiast zaśmiecać główny kontekst danymi z eksploracji codebase'u, delegujesz ją subagentowi, a twoje okno zostaje czyste dla decyzji.

W zależności od narzędzia możesz korzystać z gotowych subagentów, definiować własne role w plikach konfiguracyjnych albo rozdzielać pracę przez osobne wątki. Mechanizm bywa inny, ale cel pozostaje ten sam: izolować eksplorację od miejsca, w którym podejmujesz decyzje.

Subagent może pracować na dwa sposoby, jeśli dane narzędzie to wspiera. W trybie foreground blokuje głównego agenta do momentu zwrócenia wyniku - naturalny wybór, gdy potrzebujesz odpowiedzi przed kolejnym krokiem. Tryb background to praca równoległa - długa eksploracja repozytorium, seria testów czy analiza logów działają w tle, a ty wracasz do wyników, kiedy będą gotowe.

W wielu środowiskach role agentów da się opisać plikami markdown z frontmatterem YAML - definiujesz nazwę, opis roli, wybór modelu i instrukcje. Klucz do skutecznej delegacji to zwykle opis roli: agent musi wiedzieć, kiedy dana specjalizacja ma sens.

Z subagentów wyłaniają się powtarzalne wzorce architektoniczne - weryfikator, który niezależnie sprawdza, czy deklarowana zmiana faktycznie działa; orkiestrator łączący planistę, implementera i testera w łańcuch; albo debugger wyspecjalizowany w analizie przyczyn źródłowych. Warto mieć z tyłu głowy jedno ograniczenie - każdy subagent zużywa tokeny niezależnie, więc pięć równoległych subagentów to mniej więcej pięciokrotny koszt jednego agenta. To nie powód, żeby ich unikać, ale powód, żeby delegować celowo, a nie „na wszelki wypadek".

Druga forma izolacji to **pamięć zewnętrzna**, która przeżywa restart sesji. Przykładami są chociażby `CLAUDE.md`, który jest wstrzykiwany w każdą rozmowę, albo `Cursor Rules`, które ładują się automatycznie na podstawie glob patterns. Sam możesz takie pliki tworzyć dynamicznie, na potrzeby aktualnie realizowanego zadania.

Plany zapisane w plikach markdownowych, commity cząstkowych wyników, notatki w scratchpadach - to wszystko formy strategii `Write`. Anthropic wręcz zaleca, żeby w połowie długiej sesji commitować postępy do gita, zrobić `/clear` i wznowić z czystym kontekstem oraz wiedzą zapisaną w repozytorium.

Czyli co robisz jutro rano?

- **Reguła decyzyjna:** jeden wątek powinien obsługiwać jedną logiczną jednostkę pracy. Po zmianie tematu zacznij nowy.
- **Kontrola bezpieczeństwa:** jeśli agent powtarza ustalenia, wymyśla ścieżki albo ignoruje ograniczenia, zatrzymaj pracę i wybierz `compact`, `clear`, cofnięcie albo nowy wątek.
- **Akcja:** przed resetem zapisz cel, decyzje, zmienione pliki, status weryfikacji i następny prompt poza rozmową.

## Materiały dodatkowe

- Context engineering / Andrej Karpathy / 2025-06-25 — <https://x.com/karpathy/status/1937902205765607626>
- The rise of context engineering / Harrison Chase / LangChain / 2025-06-23 — <https://www.langchain.com/blog/the-rise-of-context-engineering>
- Context Engineering for Agents / LangChain / 2025-07-02 — <https://www.langchain.com/blog/context-engineering-for-agents>
- Effective context engineering for AI agents / Anthropic Engineering / 2025-09-29 — <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- Context Engineering for AI Agents: Part 2 / Philipp Schmid / 2025-12-04 — <https://www.philschmid.de/context-engineering-part-2>
- Using Claude Code: session management and 1M context / Thariq Shihipar / 2026-04-15 — <https://claude.com/blog/using-claude-code-session-management-and-1m-context>
- Best practices for coding with agents / Lee Robinson / Cursor / 2026-01-09 — <https://cursor.com/blog/agent-best-practices>
- Subagents / Cursor Docs — <https://cursor.com/docs/subagents>
