---
title: "[4.2] Dobry i zły projekt kursowy"
course: "10xdevs-3-prework"
language: "pl"
source: "Przeprogramowani.pl"
exported: "2026-05-17"
format: "markdown"
---

Masz już w głowie kilka pomysłów. Jeden wygląda ambitnie, drugi praktycznie, trzeci brzmi jak coś, co świetnie wyglądałoby na Demo Day. I dokładnie w tym momencie łatwo pomylić projekt kursowy z produktem, startupem albo case study do portfolio na pół roku pracy.

W 10xDevs projekt kursowy ma inne zadanie. Ma dać ci realne środowisko do pracy z agentem, artefaktami, testami, CI/CD i decyzjami technicznymi. Nie musi być duży. Nie musi być webowy. Nie musi być zbudowany w naszym stacku. Musi być wystarczająco konkretny, żeby dało się go dowieźć razem z kursem.

Dobry projekt kursowy to nie ten, który najładniej brzmi w opisie. Dobry projekt to taki, który szybko daje pierwszy działający przepływ użytkownika, ma jasną logikę biznesową i naturalnie spełnia wymagania certyfikacji.

## Dobry projekt jest mniejszy, niż myślisz

Najważniejsze słowo w tej lekcji to **MVP (Minimum Viable Product)**, czyli najmniejsza wersja produktu, która nadal daje użytkownikowi konkretną wartość. Nie „wersja prototyp do wyrzucenia”. Nie „wersja bez sensu”. Nie „połowa aplikacji”. MVP to najmniejszy spójny przepływ, który można uruchomić, sprawdzić i pokazać.

Dla przykładowej aplikacji do fiszek, MVP może oznaczać: wklejam tekst, aplikacja generuje propozycje fiszek, ja akceptuję wybrane i zapisuję je w bazie. Nie potrzeba wsparcia dla organizacji, płatności, importu z PDF-ów, aplikacji mobilnej i algorytmu powtórek opartego o machine learning.

Dla aplikacji do planowania treningów MVP może oznaczać: użytkownik podaje cel i ograniczenia, aplikacja generuje plan tygodnia, użytkownik oznacza wykonane sesje, a system aktualizuje rekomendację. To już jest logika biznesowa. To już ma dane. To już da się przetestować z perspektywy użytkownika.

Reguła jest prosta: **jeśli pierwszy działający przepływ wymaga więcej niż tygodnia pracy po godzinach, zmniejsz MVP**. Tydzień nie jest formalnym limitem. To czujnik dymu. Jeżeli na samo dojście do „czegoś działającego” potrzebujesz kilku tygodni lub miesięcy, to w trakcie kursu zabraknie ci czasu na dokumentację, testy, CI/CD, poprawki po feedbacku (i normalne życie).

MVP ma jeszcze jedną zaletę: pomaga agentowi. Agent lepiej pracuje, kiedy ma jasny cel, krótką pętlę weryfikacji i konkretny kontekst. Projekt z małym, wyraźnym rdzeniem łatwiej opisać w **PRD (Product Requirements Document)**, łatwiej rozbić na taski i łatwiej sprawdzić testem end-to-end.

## Co musi mieć projekt zaliczeniowy

Certyfikacja nie ocenia, czy zrobiłeś największą aplikację w kohorcie. Oceniamy, czy projekt pokazuje praktyczne użycie procesu pracy z kursu i czy spełnia minimalne wymagania techniczne.

Projekt powinien mieć **mechanizm kontroli dostępu** odpowiedni do typu aplikacji. W aplikacji webowej będzie to najczęściej logowanie. W aplikacji desktopowej może to być lokalny profil użytkownika, klucz dostępu albo inny mechanizm, który realnie pasuje do domeny. Chodzi o to, żeby aplikacja rozróżniała użytkownika, stan albo uprawnienia, a nie była anonimową stroną demonstracyjną.

Drugi element to **zarządzanie danymi**. Projekt powinien pozwalać tworzyć, odczytywać, aktualizować i usuwać elementy w sposób sensowny dla domeny. Nie chodzi o sztuczną listę CRUD (Create, Read, Update, Delete) doklejoną tylko po to, żeby odhaczyć wymaganie. Chodzi o dane, które są potrzebne użytkownikowi: fiszki, zadania, notatki, treningi, przepisy, transakcje, zgłoszenia, rekordy pomiarowe.

Trzeci element to **logika biznesowa**. To może być AI, ale nie musi. Ważne, żeby aplikacja podejmowała jakąś decyzję domenową: klasyfikuje, rekomenduje, waliduje, przelicza, układa plan, sprawdza warunki, generuje propozycję albo prowadzi użytkownika przez proces. Jeśli nie umiesz opisać tej logiki w jednym zdaniu, projekt jest jeszcze za mglisty.

Czwarty element to artefakty projektowe z modułów 1-3: PRD, specyfikacje, plany, kontekst dla AI. W 10xDevs nie chodzi tylko o finalny kod. Chodzi też o to, czy potrafisz przygotować agentowi kontekst, na którym agent może efektywnie pracować.

Piąty element to co najmniej jeden test weryfikujący działanie z perspektywy użytkownika. Nie musi to być rozbudowana suita testów. Ma istnieć test, który sprawdza kluczowy przepływ i daje sygnał: użytkownik może wykonać najważniejszą akcję.

Szósty element to **CI/CD (Continuous Integration / Continuous Delivery albo Deployment)**, czyli pipeline, który buduje aplikację i uruchamia testy. Publiczny deployment, App Store albo instalowalny pakiet są bardzo mile widziane, ale traktuj je jako warstwę ponad minimum, nie jako pierwszy problem do rozwiązania.

Akceptowane są różne ścieżki: własna aplikacja z logiką biznesową lub rozbudowanie istniejącego projektu o nowy moduł. Stack też jest otwarty: web, desktop, mobile, embedded, JavaScript, .NET, Java, Python, PHP albo coś innego. Kluczowe pytanie nie brzmi „czy to jest nasz stack?”, tylko „czy projekt pozwoli ci przećwiczyć workflow z AI i spełnić wymagania bez topienia czasu na rozruch?”.

Aktualne terminy składania projektów dla tej edycji:

| Moment           | Data             | Informacja zwrotna  |
| ---------------- | ---------------- | ------------------- |
| Koniec szkolenia | 19 czerwca 2026  | nie dotyczy         |
| 1\. termin       | 5 lipca 2026     | do 19 lipca 2026    |
| 2\. termin       | 10 sierpnia 2026 | do 25 sierpnia 2026 |
| 3\. termin       | 14 września 2026 | do 30 września 2026 |

Nie musisz finalizować decyzji o projekcie dzisiaj. Ostateczny wybór projektu i stacku ustalisz w pierwszym tygodniu kursu. Prework ma cię przygotować do dobrej decyzji, nie wymusza deklaracji przed czasem.

## Zły projekt ma wysoki próg zero-to-one

Najbardziej niebezpieczny projekt nie zawsze wygląda źle. Często brzmi świetnie: własny system automatyzacji firmy, aplikacja z pięcioma integracjami, wieloplatformowy produkt mobilny, narzędzie na niszowym frameworku, którego od dawna chciałeś się nauczyć.

Problem zaczyna się wtedy, gdy przez długi czas zakopiesz się w zadaniach technicznych. Konfigurujesz autoryzację z zewnętrznym dostawcą. Walczysz z biblioteką, której agent prawie nie zna. Projektujesz integrację z API, zanim istnieje podstawowy przepływ użytkownika. Przez tydzień pracujesz, ale nadal nie da się wykonać jednej sensownej akcji.

To właśnie wysoki próg **zero-to-one**: trzeba włożyć dużo pracy, zanim powstanie coś działającego. W kursie realizowanym po godzinach to najszybciej zabija momentum.

Drugi częsty błąd to za duże MVP. Opis zaczyna się niewinnie: „aplikacja do zarządzania finansami osobistymi”. Po pięciu minutach ma już import z banku, skanowanie paragonów, wykresy, budżety, alerty, role rodzinne, coacha AI i integrację z kalendarzem. Każda funkcja osobno jest sensowna. Razem tworzą projekt, który konkuruje z aplikacją produktową, a nie z zakresem kursu.

Trzeci błąd to pusty CRUD. Aplikacja pozwala dodawać, edytować i usuwać rekordy, ale nie ma decyzji domenowej. Lista książek, lista filmów, lista kontaktów albo lista zadań może być dobrym fundamentem, ale sama lista zwykle nie wystarczy. Dodaj regułę: rekomendację następnej książki, plan powtórki, priorytetyzację zadań, walidację danych, scoring, workflow akceptacji, klasyfikację zgłoszeń.

Dobry projekt szybko daje efekty. Zły projekt to firma, a nie side-project.

## Dobry vs zły projekt

Użyj tej tabeli do pierwszej oceny pomysłu. Nie musisz mieć jeszcze idealnej odpowiedzi w każdym wierszu. Masz zobaczyć, gdzie projekt jest mocny, a gdzie udaje prostszy, niż jest naprawdę.

| Kryterium        | Dobry projekt                                    | Zły projekt                                     | Pytanie kontrolne                                   |
| ---------------- | ------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------- |
| Użytkownik       | Wiesz, kto używa aplikacji i po co               | „Dla wszystkich”                                | Kto jest adresatem pierwszej akcji?                 |
| Problem          | Jeden konkretny ból lub potrzeba                 | Ogólna platforma do wszystkiego                 | Jaki konkretny problem rozwiązuje aplikacja?        |
| MVP              | 1-2 kluczowe przepływy                           | Lista funkcji jak roadmapa produktu             | Co powinno zadziałać w pierwszym tygodniu?          |
| Dane             | Dane wynikają z domeny                           | Sztuczny CRUD doklejony do wymagań              | Co użytkownik tworzy lub aktualizuje?               |
| Logika biznesowa | Aplikacja podejmuje decyzję domenową             | Rekordy tylko leżą w bazie                      | Jaką regułę działania da się opisać jednym zdaniem? |
| Stack            | Znany, oparty o konwencje, dobrze udokumentowany | Niszowy albo wybrany tylko z ciekawości         | Czy agent i ty macie dość kontekstu?                |
| Test             | Da się przetestować główny przepływ              | Test nie ma czego sensownie sprawdzić           | Co musi przejść, żeby projekt uznać za sprawny?     |
| CI/CD            | Build i testy da się uruchomić automatycznie     | Projekt wymaga postawienia całej infrastruktury | Czy repo może samo sprawdzić podstawową jakość?     |

Jeśli masz dwa pomysły, nie wybieraj tego, który brzmi bardziej efektownie. Wybierz ten, który ma krótszą drogę do pierwszego przepływu i bardziej oczywistą logikę biznesową. Efektowność pojawia się później, gdy działający rdzeń można dopracować.

## Jak ocenić swój pomysł

Zanim zaczniesz rozmawiać z agentem o implementacji, opisz projekt korzystając z pytań kontrolnych powyżej.

Jeśli nie umiesz wypełnić któregoś pola, to nie jest problem. To sygnał, że jeszcze nie pora kodować. W module 1 i 2 dostaniesz workflow, który pomoże dopracować PRD i kontekst dla agenta. Teraz wystarczy, że zobaczysz ryzyko wcześniej.

Możesz też obejrzeć prezentacje projektów absolwentów poprzednich edycji i wypisać trzy wzorce dobrych projektów. Traktuj to jako opcjonalną inspirację, nie jako listę pomysłów do skopiowania:

- [Demo Day 10xDevs — projekty absolwentów 1\. edycji](https://www.youtube.com/watch?v=b-gOI128G2s)
- [Demo Day 10xDevs — projekty absolwentów 2\. edycji](https://www.youtube.com/watch?v=duTuGy1xF-Q)

Zwróć uwagę nie na to, które projekty były największe, tylko które miały czytelny problem, działający przepływ i prostą historię: „użytkownik robi X, aplikacja pomaga mu osiągnąć Y”.

## Co warto wiedzieć

- **Reguła decyzji:** pierwszy działający przepływ powinien być możliwy do zrobienia w tydzień pracy po godzinach. Jeśli nie jest, zmniejsz MVP, zanim zaczniesz pisać PRD.
- **Warto pamiętać:** opisz logikę biznesową jednym zdaniem. Jeśli jedyne zdanie brzmi „użytkownik może dodawać i usuwać rekordy”, projekt potrzebuje mocniejszej domeny.
- **Akcja:** wypełnij sześciopolową tabelę oceny pomysłu i dopiero potem wróć do decyzji o stacku. Stack ma obsługiwać projekt, nie zastępować decyzji o projekcie.

Na tym etapie nie chodzi o ostateczne zamknięcie tematu - to zrobimy w module 1\. Chodzi o to, żeby wejść w kurs z pomysłem, który ma szansę przeżyć kontakt z kalendarzem, agentem i własnym budżetem energii.
