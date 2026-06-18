---
title: "[3.5] Rekomendowane modele i jak być na bieżąco"
course: "10xdevs-3-prework"
language: "pl"
source: "Przeprogramowani.pl"
exported: "2026-05-17"
format: "markdown"
---

W poprzedniej lekcji zdecydowałeś, w jakim języku rozmawiać z agentem. Ostatnia decyzja operacyjna przed startem M1 to wybór modelu.

Otwierasz Cursora, Claude Code, Codexa albo Copilota i widzisz kilkadziesiąt nazw. GPT-5.5, GPT-5.4 mini, GPT-5.3-Codex, Claude Opus 4.7, Sonnet 4.6, Gemini 3.1 Pro, DeepSeek V4, Qwen, Kimi, GLM...

Próbując się odnaleźć w tym kryzysie urodzaju, szybko znajdziesz różne rankingi, które obiecują obiektywną prawdę o „najlepszym" modelu.

Zwykle ludzie wybierają ten z najwyższą pozycją w SWE-bench i zaczynają kodować, bo tak chyba... powinno się robić?

Nie powinno. W 2026 roku polowanie na najwyższy wynik w rankingu to najgorszy sposób na wybór modelu. Lepszy: dobierz rangę modelu do zadania, ustaw sensowne domyślne ustawienia projektu i naucz się odróżniać sygnał od szumu w informacjach o nowych wersjach.

## Co wybrać na początek

Zanim wyjaśnimy, dlaczego rankingom nie warto ufać, zacznijmy od konkretu — co wybrać na początek pracy z narzędziami, żebyś mógł zacząć programować z AI.

Paul Gauthier z Aidera zaproponował w 2024 roku podział ról, który w 2026 stał się standardem pracy z agentami: **Koder** do szybkiej egzekucji w znanych zadaniach i **Architekt** do planu, analizy i decyzji pod niepewnością. Przekładając to na konkretne modele:

Stan na 27 kwietnia 2026 wygląda tak:

| Narzędzie      | Default do codziennej pracy                   | Tani / lekki tryb                                                              | Planowanie i trudne decyzje                                     |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Claude Code    | Sonnet 4.6                                    | Haiku 4.5 lub niższy effort przy prostych zadaniach                            | Opus 4.7 lub opusplan                                           |
| Codex          | GPT-5.3-Codex albo GPT-5.4 do pracy agentowej | GPT-5.4 mini / nano do subzadań, przeglądu plików i prostych poprawek          | GPT-5.5 przy złożonym planowaniu i długich pętlach agentowych   |
| Cursor         | Composer 2                                    | Composer 2, modele mini/flash albo tańszy model przez własny klucz API         | Opus 4.7, GPT-5.5                                               |
| GitHub Copilot | Modele 1x: GPT-5.3-Codex, Sonnet 4.6          | Modele 0x-0.33x: GPT-5 mini, GPT-5.4 mini/nano, Gemini 3 Flash, Grok Code Fast | GPT-5.5 albo Opus 4.7, ale pamiętaj o mnożniku premium requests |

Praktycznie: domyślnie ustaw model, który dobrze dowozi codzienną egzekucję. Najmocniejszy model zostaw do planów implementacji, architektury, trudnego debugowania, code review i decyzji, których nie chcesz poprawiać pięć razy.

Ta heurystyka jest niezależna od narzędzia. Nie oszczędzaj na modelu, kiedy sukces zależy od architektury, migracji, bezpieczeństwa, oceny UI, koordynacji wielu plików albo pracy, która ma trafić do produkcji bez wielu rund ręcznej korekty.

Jeśli masz droższą subskrypcję Claude Code albo Codexa (za $100-$200 miesięcznie), optymalizacja kosztu per prompt nie jest tak pilna. Wtedy prostota często wygrywa: możesz stosować ten sam, topowy model, do planowania i egzekucji.

Jedno zastrzeżenie: **te nazwy mają datę ważności krótszą niż ten prework**. Modele zmieniają się co kilka tygodni.

Kursowy kanał aktualizacji modeli na Circle będzie twoim źródłem prawdy w trakcie 10xDevs. Podział na tiery (lekki / codzienny / planujący) pozostaje stabilny niezależnie od nazw.

## Tanie modele z Chin

Największa zmiana ostatnich miesięcy nie polega na tym, że modele frontier stały się trochę lepsze. Polega na tym, że open-source'owe modele z Chin zaczęły oferować jakość „wystarczająco dobrą" w cenach, które potrafią wyglądać absurdalnie nisko obok zachodnich modeli premium.

DeepSeek V4 Flash, Qwen przez Alibaba Cloud Model Studio, Kimi K2.6/K2.5 i GLM przez Z.ai lub plany agregowane typu Alibaba Coding Plan to realne opcje do codziennej pracy: poprawiania prostych błędów, generowania testów, eksploracji repo, przepisywania małych komponentów, pracy z dokumentacją i równoległych subzadań.

Brzmi jak darmowy obiad? No właśnie, nie do końca.

Tani model może być najdroższym wyborem, jeśli przez słabsze dopasowanie do twojego repo generuje trzy rundy poprawek, gubi kontekst, miesza konwencje albo wymaga cięższego review. Wtedy oszczędzasz na tokenach, ale płacisz czasem, uwagą i ryzykiem regresji.

Dlatego traktuj chińskie modele jako **budżetową warstwę roboczą**, a nie automatyczny zamiennik frontier:

- sprawdzaj politykę danych, region przetwarzania i zgodę firmy,
- używaj ich najpierw do zadań odwracalnych i dobrze testowalnych,
- nie oddawaj im planowania architektury, bezpieczeństwa ani decyzji produktowych wysokiego ryzyka bez mocniejszego modelu lub senior review,
- obserwuj OpenRouter i oficjalne cenniki, bo dostępność i ceny zmieniają się szybciej niż nazwy w dropdownie.

I jeszcze jedno: w tym momencie nie rekomendujemy wykorzystywania tych modeli lokalnie (zamiast przez API) jako głównego narzędzia do kodowania. Najlepsze małe modele nadal są dużo słabsze od modeli dostępnych w chmurze. Modele, które zapewniają lokalnie zadowalającą jakość, jak [Qwen3.6-27B](https://willitrunai.com/blog/qwen-3-6-27b-vram-requirements), wciąż wymagają mocnej stacji roboczej, dużej ilości VRAM i często budżetu sprzętowego powyżej 30 tysięcy złotych, jeśli chcesz pracować komfortowo (bez długiego oczekiwania na wygenerowanie odpowiedzi oraz przegrzewającego się sprzętu).

To świetny temat do eksperymentów, ale kiepski domyślny wybór na start kursu.

W trakcie 10xDevs wrócimy do tego w praktyce: pokażemy, jak oceniać model nie po nazwie, tylko po jakości diffu, koszcie pętli i dopasowaniu do harnessu.

Masz co ustawić. Ale czemu nie wybrać po prostu tego z najwyższym SWE-bench? Bo ten wynik kłamie — zobaczmy jak.

## Dlaczego rankingi kłamią

**Benchmark to trzy rzeczy naraz**: zestaw zadań, metryka i protokół ewaluacji. Zmień którykolwiek element — zmieni się wynik. Zdanie „Model X osiąga 80% na SWE-bench" nie mówi ci, który wariant benchmarku, jaki harness, jaki limit kroków ani jaka metryka.

W codziennej pracy rankingi mogą cię zmylić na trzy konkretne sposoby.

**Prawo Goodharta**: kiedy benchmark staje się celem, producenci optymalizują pod niego zamiast pod faktyczne możliwości modelu. Wynik? OpenAI w lutym 2026 przestało raportować wyniki SWE-bench Verified — powołując się na saturację i kontaminację danych. Konkretne modele wiodące potrafiły odtworzyć z pamięci rozwiązania benchmarkowe.

Benchmark, który miał mierzyć jakość kodowania, zaczął mierzyć zdolność modelu do zapamiętywania testów.

**Benchmark mierzy nie to, co myślisz**: FeatureBench wykazał, że Claude Opus 4.5 osiąga 74% na naprawach błędów, ale tylko 11% na budowaniu nowych funkcjonalności. Przez dwa lata branża utożsamiała „umie naprawiać bugi" z „umie kodować", bo SWE-bench był jedynym popularnym benchmarkiem.

To najniebezpieczniejszy tryb awarii rankingu — daje złudzenie posiadania danych, których nie masz.

**pass@1 zawyża obraz niezawodności**: jeśli model rozwiązuje zadanie z prawdopodobieństwem 90% w jednym kroku (pass@1 = 0,9), to w pięciu kolejnych krokach skończy je poprawnie w zaledwie 59% przypadków (0,9⁵ = 0,59). Im dłuższa pętla agenta, tym większe rozbieżności. W produkcji liczy się **pass^k** — czy model da radę za każdym razem, nie przynajmniej raz.

Każdy benchmark przechodzi cykl życia trwający 12-18 miesięcy. HumanEval zsaturował się do 2024\. SWE-bench Verified wycofany w lutym 2026.

Benchmark, któremu ufasz dzisiaj, przestanie różnicować modele w ciągu roku.

| Status                 | Przykłady                        | Co to znaczy                                           |
| ---------------------- | -------------------------------- | ------------------------------------------------------ |
| Zsaturowane / wycofane | HumanEval, SWE-bench Verified    | Bezużyteczne — modele wiodące na szczycie              |
| Aktywne i różnicujące  | SWE-bench Pro, SWE-rebench       | Używaj tych — realne różnice między modelami           |
| Wschodzące             | FeatureBench, Terminal-Bench 2.0 | Obserwuj — mierzą wymiary, których reszta nie obejmuje |

Innymi słowy: nigdy nie opieraj się na jednym benchmarku. Wybieraj na podstawie kilku i w porównaniach uwzględniaj **koszt za token (a najlepiej rozwiązanie)**, nie sam procent w rankingu.

Cena tokena, cena requestu i cena subskrypcji to dopiero początek. Prawdziwy koszt obejmuje liczbę iteracji, jakość review, trafność planu, czas do merge i to, czy model kończy pracę w jednym kawałku, czy zostawia ci „prawie działa".

## Kiedy zbudowaliśmy własny benchmark

Z dokładnie tej frustracji powstał **10x-bench** — nasz wewnętrzny, open source'owy benchmark. Publiczne rankingi testują naprawianie bugów w repozytoriach Pythona. Ale jeśli twój zespół dostarcza strony w Astro, React i Tailwind, te liczby nie mówią ci prawie nic.

10x-bench testuje coś innego: czy model potrafi zbudować kompletną, gotową do wdrożenia wielostronicową witrynę z jednego prompta — bez iteracyjnego poprawiania. 10 kryteriów (7 automatycznych + 3 oceniane przez ludzi), twardy warunek wejściowy: jeśli `npm run build` się nie powiedzie, wynik to zero — tak jak w produkcji.

Najciekawsze okazało się to, czego żaden syntetyczny benchmark nie sprawdza. Modele, które bezbłędnie generowały strukturę kodu, jednocześnie zmyślały odcinki podcastu, wstawiały "rickrollowe" identyfikatory YouTube i fabrykowały biogramy zespołu. 74 próby, 14 modeli — te awarie treściowe okazały się najczęstszym trybem porażki.

Cały projekt jest open source na 10xbench.ai. Szersze spojrzenie na temat benchmarków — pięć problemów strukturalnych, cykl życia, ważona karta decyzyjna — znajdziesz w ebooku [_Rankingi modeli AI kłamią_](https://www.10xdevs.pl/lm2-e-book).

Szczegółowy raport z naszego benchmarku pokażemy w pierwszej lekcji kursu. W preworku wystarczy ci jedna zasada: benchmark jest początkiem rozmowy o modelu, nie końcem decyzji.

## Jak być na bieżąco bez FOMO

Skoro rankingi kłamią, jak w ogóle pilnować, kiedy zmienić model? Odpowiedź nie wymaga codziennego scrollowania X.

Zacznij od **hierarchii sygnału** — od najsilniejszego:

1. **Oficjalne blogi laboratoriów** (Anthropic, OpenAI, Google DeepMind) — kiedy pojawia się nowy model, dowiesz się z pierwszego źródła.
2. **OpenRouter i rankingi użycia** (OpenRouter, Chatbot Arena) — nie mówią, który model „jest lepszy", ale pokazują dostępność, ceny, popularność i realny ruch między modelami. To dobry radar, szczególnie dla modeli spoza głównego dropdownu twojego narzędzia.
3. **Syntetyczne benchmarki** (SWE-bench Pro, SWE-rebench) — traktuj jako jeden z wielu punktów danych, nie jako ostateczną odpowiedź.

Zamiast codziennego monitorowania ustaw sobie **dwutygodniowy model check**: raz na dwa tygodnie sprawdź, czy w narzędziach, których używasz, pojawiły się nowe modele albo zmieniły się mnożniki kosztów. Jeśli nie — pracuj dalej z tym, co masz.

Jako uczestnik 10xDevs masz dodatkową przewagę — kursowy kanał na Circle działa jako filtr, dzięki któremu informacje o zmianach w modelach dostajesz przetworzone i z kontekstem, zamiast samodzielnie przebijać się przez szum.

## Co warto wiedzieć

- **Reguła decyzyjna:** zacznij od głównych modeli w narzędziach, których używasz na co dzień, a chińskie alternatywy traktuj jako świadomą optymalizację kosztu w wybranych zadaniach.
- **Warto pamiętać:** zanim użyjesz DeepSeek, Qwen, Kimi albo GLM w pracy z repozytorium firmy, sprawdź politykę danych, region przetwarzania i zasady klienta. Cena nie anuluje compliance. Niestety.
- **Akcja:** ustaw w swoim preferowanym narzędziu trzy domyślne wybory: model do codziennej egzekucji, tani/lekki model do prostych zadań i mocny model do planowania implementacji.

## Materiały dodatkowe

- _Rankingi modeli AI kłamią_ — ebook 10xDevs 3.0 — <https://www.10xdevs.pl/lm2-e-book>
- _Separating code reasoning and editing_ / Paul Gauthier / Aider / 2024-09-26 — <https://aider.chat/2024/09/26/architect.html>
- _OpenAI API models_ / OpenAI / 2026 — <https://developers.openai.com/api/docs/models>
- _GPT-5.2-Codex model_ / OpenAI / 2026 — <https://developers.openai.com/api/docs/models/gpt-5.2-codex>
- _Claude Code model configuration_ / Anthropic / 2026 — <https://code.claude.com/docs/en/model-config>
- _Claude Sonnet 4.6_ / Anthropic / 2026 — <https://www.anthropic.com/claude/sonnet>
- _Claude Opus 4.7_ / Anthropic / 2026 — <https://www.anthropic.com/claude/opus>
- _Supported AI models in GitHub Copilot_ / GitHub Docs / 2026 — <https://docs.github.com/en/copilot/reference/ai-models/supported-models>
- _Requests in GitHub Copilot_ / GitHub Docs / 2026 — <https://docs.github.com/en/copilot/concepts/billing/copilot-requests>
- _Cursor models and pricing_ / Cursor Docs / 2026 — <https://docs.cursor.com/models>
- _DeepSeek API pricing_ / DeepSeek / 2026 — <https://api-docs.deepseek.com/quick%5Fstart/pricing/>
- _Kimi API models_ / Moonshot AI / 2026 — <https://platform.kimi.ai/docs/models>
- _Alibaba Cloud Model Studio Coding Plan_ / Alibaba Cloud / 2026 — <https://www.alibabacloud.com/help/en/model-studio/coding-plan>
- _Alibaba Cloud Model Studio pricing_ / Alibaba Cloud / 2026 — <https://www.alibabacloud.com/help/en/model-studio/billing-for-model-studio>
- _Qwen3.6-27B VRAM Requirements_ / Will It Run AI / 2026-04-23 — <https://willitrunai.com/blog/qwen-3-6-27b-vram-requirements>
- _SWE-bench Pro Leaderboard_ / Scale AI SEAL / 2026 — <https://scale.com/leaderboard/swe%5Fbench%5Fpro%5Fpublic>
- _SWE-rebench_ / 2026 — <https://swe-rebench.com>
- _FeatureBench_ / ICLR 2026 — <https://arxiv.org/abs/2602.10975>
- _Chatbot Arena Leaderboard_ / 2026 — <https://lmarena.ai/leaderboard>
- _10x-bench — LLM Website Generation Benchmark_ / Przeprogramowani / 2026 — <https://github.com/przeprogramowani/10x-bench>
- _OpenRouter rankings — Programming_ / 2026 — <https://openrouter.ai/rankings/programming?view=month>
