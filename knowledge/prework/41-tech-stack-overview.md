---
title: "[4.1] Tech Stack Overview"
course: "10xdevs-3-prework"
language: "pl"
source: "Przeprogramowani.pl"
exported: "2026-05-17"
format: "markdown"
---

W poprzedniej lekcji uporządkowaliśmy wybór modeli. Teraz pojawia się drugie pytanie: "w jakim stacku powinienem zrobić projekt kursowy?".

Patrzysz na listę rekomendowanych technologii: Astro, React, TypeScript, Tailwind, Supabase, Cloudflare. Znasz może dwie z nich. Pierwsza myśl: "muszę się tego nauczyć przed startem kursu". Druga: "a jeśli na co dzień pracuję w innym stacku, to czy ten kurs nadal ma dla mnie sens?".

Ma. I nie, nie musisz przed startem 10xDevs 3.0 realizować kursu z Astro po godzinach.

Ten stack to **nasza rekomendacja** i najlepiej wspierana ścieżka. Nie jest to warunek ukończenia 10xDevs ani lista technologii, które musisz opanować przed startem. W lekcji 4.2 zaczniesz myśleć o projekcie kursowym, a w M1 dopiero zaczniesz pracować nad nim z agentem.

Ta lekcja ma dać ci spokój i prostą mapę decyzji: po czym poznasz stack dobry do pracy z agentem, dlaczego rekomendujemy nasz zestaw i kiedy własny stack też jest rozsądnym wyborem.

## Co czyni stack „agent-friendly"

Dobór stacku do pracy z agentem AI nie jest kwestią mody. W lekcji o LLM-ach omawialiśmy, że model przewiduje tokeny na podstawie wzorców z danych treningowych.

Dlatego stack dobry dla agenta powinien dawać mu dużo czytelnych sygnałów. Cztery są najważniejsze.

**Typowany.** Jawne kontrakty danych to dla agenta nie dekoracja, tylko mapa. Kiedy `UserProfile` ma zdefiniowane pola, agent nie musi zgadywać, czy użytkownik ma `name`, `fullName`, `displayName`, czy jeszcze coś z kosmosu.

TypeScript, Java, C#, Python z type hints czy inne typowane środowiska dają agentowi podobny rodzaj wsparcia. Różnią się składnią, ale zasada jest ta sama: im mniej zgadywania, tym mniej błędów.

**Bazujący na konwencjach.** Konwencja to przewidywalność. Jeśli projekt ma ustalone miejsca na routing, komponenty, logikę backendową, konfigurację i testy, agent szybciej rozumie, jak nawigować po nim nawigować.

To nie musi być nasz stack. Ważne, żeby w twoim ekosystemie istniał dojrzały sposób tworzenia projektu, a nie improwizacja.

**Popularny w danych treningowych.** Modele lepiej radzą sobie z technologiami, które mają dużo publicznych przykładów, tutoriali, repozytoriów i dyskusji. Nie chodzi o ślepe wybieranie najpopularniejszego rozwiązania, tylko o to, czy agent widział wystarczająco wiele podobnych wzorców poczas treningu.

Egzotyczny stack może być świetny dla zespołu ekspertów. Dla agenta bywa jednak jak praca z mapą bez nazw ulic.

**Dobrze udokumentowany.** Oficjalna dokumentacja, aktualne przykłady i jasne przewodniki pomagają agentowi trzymać się prawdziwych API zamiast wymyślać metody, które brzmią wiarygodnie.

W 10xDevs będziemy wielokrotnie wracać do tego samego wzorca: agent działa najlepiej, kiedy dostaje jasny kontekst, a nie kiedy musi domyślać się twoich intencji. Stack jest częścią tego kontekstu.

## Gdzie zły wybór potrafi dać w kość

Najgorszy wybór to nie "inny niż kursowy".

Sygnał ostrzegawczy jest prosty: często poprawiasz agenta nie dlatego, że źle rozwiązał problem, tylko dlatego, że nie potrafi sprawnie korzystać z Twoich technologii.

Dlatego przed wyborem stacku nie pytaj: "czy da się w tym pisać z AI?". Pytaj: "czy agent dostanie typy, konwencje, starter i aktualną dokumentację?"

Oczywiście luki w powyższych to nie wyrok, kontekst możemy uzupełniać samodzielnie poprzez pliki z instrukcjami (AGENTS.md, CLAUDE.md czy rules), ale wymaga to dodatkowej pracy i może nie dać tak dobrego efektu jak praca ze stackiem, który dostarcza tych elementów w naturalny sposób.

## Nasz rekomendowany stack

Nasz rekomendowany stack pokrywa wszystkie warstwy aplikacji webowej, od UI po wdrożenie na chmurę. Każda technologia ma jasną rolę i sprawdzony powód, dla którego dobrze działa w projektach budowanych z agentem.

| Warstwa               | Rekomendacja       | Dokumentacja                                                                                                | Dlaczego u nas świetnie działa                                                                                                                                                                                                                            |
| --------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meta-framework + API  | **Astro 6**        | [docs.astro.build](https://docs.astro.build/en/concepts/why-astro/)                                         | Dużo konwencji, [architektura islands](https://docs.astro.build/en/concepts/islands/), endpointy API i natywna integracja z Cloudflare                                                                                                                    |
| Komponenty UI         | **React 19**       | [react.dev](https://react.dev/learn)                                                                        | Ogromna baza wzorców i dobre wsparcie w narzędziach AI                                                                                                                                                                                                    |
| System typów          | **TypeScript**     | [typescriptlang.org](https://www.typescriptlang.org/docs/handbook/intro.html)                               | Jawne kontrakty, które agent czyta przy każdej decyzji                                                                                                                                                                                                    |
| Stylowanie            | **Tailwind CSS 4** | [tailwindcss.com](https://tailwindcss.com/docs/styling-with-utility-classes)                                | Style w klasach HTML, LLM świetnie sobie z tym radzi.                                                                                                                                                                                                     |
| Backend + Baza danych | **Supabase**       | [supabase.com/docs](https://supabase.com/docs/guides/getting-started)                                       | PostgreSQL + auth + storage + SDK w TypeScript (jest również wsparcie dla: Pythona, Swifta, Kotlina i Fluttera)                                                                                                                                           |
| Deployment            | **Cloudflare**     | [developers.cloudflare.com](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/) | [Pages](https://developers.cloudflare.com/pages/), [Workers](https://developers.cloudflare.com/workers/), [KV](https://developers.cloudflare.com/kv/) \+ natywny [@astrojs/cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) |

**Astro** zarządza routingiem, budowaniem stron, renderowaniem po stronie serwera i endpointami API. To w Astro definiujesz kursowe API aplikacji, np. obsługę formularza, webhooka albo endpoint pośredniczący między frontendem a usługami backendowymi.

Jego wyróżnikiem jest architektura islands: strona jest domyślnie HTML-em, a interaktywne fragmenty, takie jak formularz, modal czy dynamiczna lista, są osadzane jako izolowane "wyspy".

W styczniu 2026 zespół The Astro Technology Company dołączył do Cloudflare. To wzmacnia integrację z Cloudflare, ale Astro pozostaje open source, na licencji MIT i platform-agnostic.

**React** odpowiada za interaktywne wyspy. Nie budujesz całej aplikacji w React, tylko używasz go tam, gdzie statyczny HTML Astro nie wystarcza.

**TypeScript** obejmuje cały projekt: komponenty, endpointy API i logikę backendową. Dla agenta to najważniejszy sygnał nawigacyjny. Widzi `interface Product { id: string; price: number }` i nie musi zgadywać kształtu danych.

**Tailwind CSS** trzyma stylowanie blisko komponentu. Zamiast rozpraszać kontekst między plikiem komponentu i osobnym CSS-em, agent widzi strukturę i styl w jednym miejscu:

```html
<div>
  <h2>Card title</h2>
</div>
```

Nie jest to jedyny dobry sposób stylowania, ale w kursowym starterze [10x-astro-starter](https://github.com/przeprogramowani/10x-astro-starter) sprawdza się świetnie.

**Supabase** daje bazę PostgreSQL, auth, storage i SDK w TypeScript. W naszym stacku nie zastępuje warstwy API w Astro, tylko dostarcza gotowe usługi backendowe, z których korzystają endpointy Astro i kod aplikacji.

**Cloudflare** odpowiada za deployment i edge runtime. Astro ma oficjalną integrację z Cloudflare, więc ścieżka od lokalnego projektu do działającej wersji online jest krótka i dobrze opisana.

To nasza domyślna ścieżka. Najłatwiej będzie dostać wsparcie, porównać swój kod z przykładami i korzystać z naszego startera.

Ale nadal: domyślna nie znaczy jedyna.

## Jeśli preferujesz własny stack

Jeśli pracujesz zawodowo w innym ekosystemie, nie musisz go porzucać tylko dlatego, że kurs pokazuje przykłady w Astro, React i TypeScript.

Większość lekcji 10xDevs dotyczy sposobu pracy: jak pracować z kontekstem, jak planować z agentem, jak robić code review z AI i jak budować workflow. Te umiejętności przenoszą się między technologiami.

Warunek jest prosty: twój stack musi być wystarczająco czytelny dla agenta i wystarczająco znany dla ciebie.

Sprawdź go tak:

- Czy ma typy albo przynajmniej jawne schematy danych?
- Czy projekt startuje z oficjalnego startera lub dojrzałego szablonu?
- Czy struktura folderów, routing, testy i konfiguracja są oparte na konwencjach?
- Czy dokumentacja jest aktualna i łatwa do podlinkowania agentowi?
- Czy ty sam potrafisz rozpoznać, kiedy agent robi coś niezgodnego z praktyką twojego ekosystemu?

Jeśli odpowiedzi brzmią "tak", możesz realizować projekt w swoim środowisku. Jeśli kilka odpowiedzi brzmi "nie wiem", kursowy stack będzie bezpieczniejszą ścieżką na start.

Kursowy stack daje pełne wsparcie: gotowe startery, przykłady i sprawdzone wzorce. Własny stack daje większy transfer do twojej pracy, ale większy ciężar decyzji technicznych zostaje po twojej stronie.

## Porównaj dwie ścieżki

Jeśli nie wiesz, co wybrać, nie rozstrzygaj tego na podstawie sympatii do logo. Porównaj dwie opcje przez cztery kryteria.

| Kryterium               | Kursowy stack                                        | Mój stack                                                    |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| Typy / kontrakty danych | TypeScript w całym projekcie                         | Czy mam typy, schematy albo inne jawne kontrakty?            |
| Konwencje projektu      | Gotowy starter i ustalona struktura                  | Czy startuję z dojrzałego szablonu, a nie z pustego folderu? |
| Popularność wzorców     | Bardzo dużo przykładów webowych w publicznych danych | Czy agent ma z czego czerpać podobne wzorce?                 |
| Dokumentacja            | Oficjalne docs dla każdej warstwy                    | Czy mogę podlinkować agentowi aktualne docs i przykłady?     |
| Decyzja                 | Najbezpieczniejsza opcja                             | Dobry wybór, jeśli większość odpowiedzi brzmi "tak"          |

Tę tabelę możesz potraktować jako mini-pracę domową przed modułem 1\. Tam wybór stacku połączy się już z wyborem projektu, czyli z pytaniem: "co właściwie chcę zbudować w trakcie kursu?".

Tak więc nie musisz się jeszcze na nic deklarować, możesz zacząć zastanawiać się nad tym jaki projekt chciałbyś zrealizować na zaliczenie.

W podjęciu ostatecznej decyzji pomogą Ci dedykowane agent skille, które zaprezentujemy na samym początku modułu 1.

## Ile musisz wiedzieć na start

Krótka odpowiedź, niezależna od wybranego stacku: liczy się orientacja, a nie biegłość.

Kurs jest zaprojektowany tak, że agent pomaga ci pracować w środowisku, którego nie znasz perfekcyjnie. Stack jest narzędziem, nie celem nauki.

Co warto mieć przed Modułem 1:

- **Orientację w jakimś systemie typów**: TypeScript, Java, C#, Python z type hints albo inny system jawnych kontraktów. Nie musisz znać składni każdego frameworka. Masz rozumieć, dlaczego typy pomagają agentowi.
- **Ogólne pojęcie o HTTP i API**: endpoint, request, response, JSON. Bez względu na to, czy budujesz na Supabase, czy na własnym backendzie, ta warstwa się nie zmienia - chyba, że nie będziesz realizował aplikacji webowej (co również jest dopuszczalne).
- **Umiejętność uruchomienia startera**: `git clone`, instalacja zależności, komenda `dev` albo jej odpowiednik w twoim ekosystemie. Jeśli to dla ciebie naturalne, nie masz o co się martwić.

Czego **nie** musisz umieć:

- Składni żadnego konkretnego frameworka — nauczysz się jej w M1, pisząc z agentem.
- Konfiguracji narzędzi do statycznej analizy kodu — domyślne konfiguracje w starterach działają od razu.
- Wdrożenia na chmurze — to temat M1, lekcja o deploymencie.
- Zaawansowanych wzorców danego ekosystemu — kursowe projekty są tak zakrojone, żeby nie wymagać tego na start.

W trakcie 10xDevs będziemy dużo bardziej skupiać się na tym, jak prowadzisz agenta, jak sprawdzasz jego pracę i jak budujesz bezpieczny workflow. Stack ma ci w tym pomagać, a nie stać się osobnym źródłem stresu.

## Co warto wiedzieć

- **Reguła decyzji:** jeśli nie masz silnej preferencji, idź kursowym stackiem. Jeśli masz produkcyjny stack, zostań przy nim wtedy, gdy spełnia cztery kryteria agent-friendly.
- **Warto zapamiętać:** nie zaczynaj od pustego folderu. Wybierz starter z typami, lintingiem, formatowaniem i działającą komendą `dev`.
- **Akcja:** porównaj kursowy stack i swój stack w tabeli z tej lekcji. Nie musisz jeszcze finalizować wyboru, ale warto wiedzieć, skąd bierze się twoja decyzja.

Decyzję o projekcie i stacku domkniesz w module 1\. Na teraz wystarczy jedno: nie musisz znać naszego stacku przed startem, żeby skorzystać z kursu.

## Materiały dodatkowe

- _Why Astro_ / Astro Docs — <https://docs.astro.build/en/concepts/why-astro/>
- _Astro Islands_ / Astro Docs — <https://docs.astro.build/en/concepts/islands/>
- _The Astro Technology Company joins Cloudflare_ / Astro Blog — <https://astro.build/blog/joining-cloudflare/>
- _Thinking in React_ / React Docs — <https://react.dev/learn/thinking-in-react>
- _TypeScript Handbook_ / TypeScript Docs — <https://www.typescriptlang.org/docs/handbook/intro.html>
- _Utility-First Fundamentals_ / Tailwind CSS Docs — <https://tailwindcss.com/docs/styling-with-utility-classes>
- _Getting Started with Supabase_ / Supabase Docs — <https://supabase.com/docs/guides/getting-started>
- _Deploy an Astro Site to Cloudflare Pages_ / Cloudflare Docs — <https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/>
- _`@astrojs/cloudflare` adapter_ / Astro Docs — <https://docs.astro.build/en/guides/integrations-guide/cloudflare/>
- _Type hints_ / Python Enhancement Proposals — <https://peps.python.org/pep-0484/>
