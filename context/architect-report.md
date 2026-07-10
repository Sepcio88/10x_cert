---
title: "Raport certyfikacyjny 10xArchitect — Moduł 4"
created: 2026-07-03
---

# Raport architektoniczny modułu 4 — CloudExamMatter

## 1. Opisane projekty

Jedno repozytorium dla wszystkich czterech artefaktów: **CloudExamMatter**
(`Sepcio88/10x_cert`, commit `c2273a4`) — Astro 6 (SSR) + wyspy React 19,
TypeScript 5, Supabase (Postgres/Auth/RLS), Cloudflare Workers, OpenRouter
(`gpt-4o-mini`) do generowania na żądanie pytań przygotowujących do
certyfikatów chmurowych. Skala: jeden developer, 46 commitów, projekt ma 2,5
tygodnia (2026-06-18 → 2026-07-03), ~55 modułów w `src/`. L2 →
`context/map/`. L3/L4 → `context/changes/practice-flow-analysis/`. L5 →
`context/domain/`.

## 2. Mapa projektu (L2)

Pełny artefakt: `context/map/repo-map.md` (+ 3 artefakty źródłowe: teren, struktura, kontrybutorzy).

- **Ryzyko wspólnego rdzenia**: `src/types.ts` ma 15 przychodzących zależności
  (Ca=15, I=0.06) — to pojedynczy plik o największym promieniu rażenia w
  repozytorium.
- **Czysta warstwowość, zero cykli**: dependency-cruiser na wszystkich 55
  modułach nie znalazł żadnych cyklicznych importów; gradient niestabilności
  przebiega czysto od `types.ts`/`utils.ts` (I≈0) przez warstwę
  service/db (I≈0,3–0,6) aż po pages/components/middleware (I=1,0) — nic w
  `lib/**` nie importuje z `components/**` ani `pages/**`.
- **Lokalne centrum**: przepływ generowania i oceniania sesji ćwiczeniowej
  (`PracticeGenerator.tsx`, `types.ts`, `question-generator.ts`) to
  najgoręcej zmieniany kod wg historii gita — dlatego został wybrany do L3.
- **CI/CD jest aktywnie rozwijane, nie przypadkowe**: `.github/workflows/ci.yml`
  to 2. najczęściej zmieniany plik w repozytorium (7 commitów) — istotny
  kontekst dla ścieżki 10xChampion (moduł 5).
- **Niewiadoma/ograniczenie**: 2,5 tygodnia historii to za mało, żeby cokolwiek
  nazwać "legacy" — liczby dot. churnu/sprzężenia mają charakter kierunkowy, a
  sygnał "jeden autor" odpowiada na pytanie "jak ta osoba pracuje", a nie "kto
  czym się opiekuje" (nie ma tu czynnika bus factor do zmapowania).

## 3. Analiza ficzera (L3)

Pełny artefakt: `context/changes/practice-flow-analysis/research.md`.

**Zbadany przepływ**: wybór egzaminu/liczby pytań → generowanie pytań
(OpenRouter) → odpowiadanie z feedbackiem explanation-first → zapis sesji →
odczyt w dashboardzie/historii. Wybrany, bo mapa repo (§2) wskazuje go
zarówno jako najgorętszą ścieżkę kodu, jak i tę, która najmocniej dotyka
strefy ryzyka `types.ts` (11 z 15 miejsc importu).

**Przegląd ficzera**: wejście przychodzi jako zwalidowane żądanie HTTP
(provider, exam, count); stan zmienia się dwukrotnie — raz, gdy OpenRouter
zwraca `Question[]` zwalidowane schematem zod, drugi raz, gdy klient
wysyła ukończoną sesję do przeliczenia wyniku po stronie serwera; odpowiedzią
jest zapisany, oceniony, możliwy do ponownego odwiedzenia wiersz sesji, który
zasila trend postępu dla danego egzaminu.

**Dług techniczny** (top 3, jeden potwierdzony przez ast-grep):
1. **Niezwalidowana granica odczytu z bazy** — `src/lib/db/sessions.ts` rzutuje
   nietypowany JSONB `payload` z Supabase wprost na typy aplikacji, bez
   `zod.safeParse`. Potwierdzone strukturalnie: `ast-grep -p '$X as unknown as $Y' src/lib/db/sessions.ts` → dokładnie 3 trafienia (linie 73, 111, 130),
   zgodnie z twierdzeniem. Każda *inna* granica w tym przepływie waliduje dane
   (odpowiedź LLM-a, odpowiedzi od klienta) — to jedyna, która tego nie robi.
2. **`database.types.ts` cicho się rozjeżdża** — synchronizowany ręcznie przez
   człowieka uruchamiającego `supabase gen types`; brak skryptu, brak
   sprawdzenia w CI; proces jest udokumentowany wyłącznie w
   *zarchiwizowanym* planie.
3. **`openrouter.ts` nie ma żadnego bezpośredniego pokrycia testami** —
   wszystkie testy generowania mockują na granicy fabryki klienta, więc
   faktyczne tłumaczenie błędów HTTP/timeoutów nigdy nie jest ćwiczone.

## 4. Plan refaktoryzacji (L4)

Pełne artefakty: `context/changes/practice-flow-analysis/plan.md` + `plan-brief.md`.

**Co jest refaktoryzowane**: dwie pozycje długu powyżej, które są prawdziwymi
problemami *kształtu* (nie lukami testowymi) — (A) dodanie schematu zod dla
payloadu sesji i walidacja we wszystkich trzech miejscach odczytu z bazy, z
odrzucaniem+logowaniem każdego wiersza, który nie przejdzie walidacji; (B)
dodanie skryptu `npm run db:types` oraz twardo failującego joba CI, który
porównuje wygenerowane na nowo typy z plikiem zacommitowanym w repo.

**Świadomie NIE robimy**: nie ruszamy rzutowania po stronie zapisu w
`saveSession` (już zwalidowane warstwę wyżej), nie dodajemy abstrakcji do
logowania, nie robimy banera UI dla odrzuconych sesji, nie piszemy testów
integracyjnych RLS, nie naprawiamy żadnego *obecnego* rozjazdu (istnieje
tylko jedna migracja — nie oczekujemy żadnego).

**Fazy** (obie jednofazowe, addytywne, w pełni odwracalne):
1. Walidacja granicy odczytu z bazy — auto: typecheck/lint/testy jednostkowe +
   nowe testy na zniekształcone wiersze; ręcznie: wiersz wstawiony ręcznie
   przez edytor SQL z błędnym kształtem degraduje się łagodnie, happy path
   bez zmian.
2. Automatyczne sprawdzenie rozjazdu `database.types.ts` — auto: wynik
   skryptu `db:types` zgadza się z zacommitowanym plikiem, nowy job CI
   przechodzi na czystym PR-ze; ręcznie: dostarczenie sekretu
   `SUPABASE_ACCESS_TOKEN` (krok wyłącznie dla człowieka), potwierdzenie, że
   PR symulujący rozjazd faili, a po cofnięciu zmiany przechodzi.

## 5. Domena wg DDD (L5)

Pełne artefakty: `context/domain/01-domain-distillation.md`,
`02-invariant-aggregate-refactor.md`, `03-anti-corruption-layer.md`.

**Ubiquitous language** (z 17 wyciągniętych pojęć): `Practice session`,
`Question`, `Grading`, `Saved session`, `Weak topic` są kluczowe i mapują się
czysto na kod. Dwa istotne pojęcia oznaczone jako **BRAK w kodzie**: `Exam`
w ogóle nie ma bytu/katalogu — to goły, niewalidowany string wrzucany wprost
do promptu LLM-a — a język Guardrails z PRD nigdy nie przewidział pojęcia
`GenerationConfidence`, które kod wykształcił niezależnie.

**Najostrzejszy rozjazd model-kod**: PRD nazywa Guardrail —
*"Once a session is saved, it remains retrievable — saved sessions are
never lost"* (`prd.md:58`) — który wprost przeczy kompletnej, otestowanej
ścieżce usuwania (polityka RLS na DELETE + route `DELETE` + przycisk-kosz w
UI, `sessions/[id].test.ts:45` potwierdzający, że usuwanie *działa*). Ponieważ
zestaw testów certyfikuje tę sprzeczność jako poprawne zachowanie, nigdy nie
wypłynie ona jako błąd CI.

**Niezmiennik #1 i jego agregat**: wybrany niezmiennik to *nie* dosłowny
guardrail "poprawność odpowiedzi" (niemożliwy do wyegzekwowania — żaden kod
nie sprawdzi prawdziwości twierdzenia LLM-a), tylko jego egzekwowalna
dekompozycja: **treść i wynik sesji muszą być autorytatywnie serwerowe.**
Diagnoza pokazała, że jest to zadeklarowane jako prawda w czterech miejscach
(komentarze w kodzie, README, testy oraz mój własny research L3 powyżej), a w
rzeczywistości jest fałszem — `POST /api/practice/sessions` przyjmuje *całą*
tablicę pytań, wraz z `correctOptionId`, wprost od klienta, i ocenia względem
tych samych niezaufanych danych. Każdy zalogowany użytkownik może sfałszować
perfekcyjny wynik. Proponowany agregat-strażnik, `PracticeAttempt`, nadaje
tożsamość w momencie generowania i zatrzymuje pytania po stronie serwera, więc
ukończenie sesji może być ocenione wyłącznie względem danych, które sam
serwer wytworzył.

**Anti-Corruption Layer**: najgorszym przeciekiem nie jest klient LLM-a (już
jest wąskim portem z jednym wywołującym), tylko `@supabase/supabase-js` —
jego surowy klient jest konstruowany identycznie w 9 miejscach w 4 warstwach
(liczba potwierdzona przez ast-grep + grep: 6 miejsc `.ts` przez
`ast-grep -p 'createClient($$$ARGS)'` + 3 miejsca `.astro`), a jego
wendorowy typ `User` jest zaszyty w globalnym kontrakcie `App.Locals`.
Projekt wprowadza parę port/adapter `AuthGateway` i `SessionsRepository`,
składaną raz w middleware..

## 6. Decyzje, które należą do mnie

Wybrałem przepływ generowania sesji do L3, bo tak wskazywały dane
o churnie z mapy repozytorium — nie dlatego, że wydawał się najłatwiejszy.

W planie L4 celowo wyciąłem rzutowanie po stronie zapisu w `db/sessions.ts` ze
scope'u. Dane są już walidowane warstwę wyżej, więc nie ma po co tego dotykać —
a przy okazji grzebanie tam zamazałoby granicę z pracą z L5, bo to właśnie L5
odpowiada za ten route w sposób bardziej fundamentalny, przez agregat.

Luka w walidacji odczytu z bazy (L4) i luka pozwalająca klientowi sfałszować
wynik (L5, INV-1) na pierwszy rzut oka wyglądają podobnie, ale świadomie
zostawiłem je jako osobne plany. L4 chroni tylko przed przypadkowym rozjazdem
danych — to defensywa na nieumyślne błędy. Odkrycie z L5 to coś innego: luka
na nieautryzowane wejscie, której żadna ilość walidacji po stronie odczytu nie złapie.
Wrzucenie tego do jednego worka umniejszyłoby wagę tej drugiej sprawy.

Najważniejsze odkrycie całego cyklu — że "autorytatywne ocenianie po stronie
serwera" jest nieprawdziwe dla treści ocenianej, nie tylko dla flagi
poprawności — przegapiłem sam w trakcie researchu L3. Zostawiam ten fakt tutaj
wprost. To najlepszy dowód na
to, że L5 ma rację bytu w tym procesie i nie jest zwykłym powtórzeniem L3/L4.
