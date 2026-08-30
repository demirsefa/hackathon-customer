# Submission videosu — çekim senaryosu

**4:50 · 8 sahne · tek çekim · ekran kaydı + ses**

Konuşma dili **İngilizce, B2 seviye** — basit kelimeler, kısa cümleler. Yönergeler
Türkçe. Sadece `SÖYLE` bloklarını sesli oku.

> **Sayılar rakamla yazıldı.** `28 / 28` görüyorsan "twenty-eight out of twenty-eight"
> de. Ekranda rakam olması okumayı hızlandırır.
>
> `//` işareti **nefes molası**. Orada yarım saniye dur, sonra devam et.

---

## Teknik özet

|            |                                                                       |
| ---------- | --------------------------------------------------------------------- |
| Süre       | **4:50** — 5:00 sınırının altında                                     |
| Kayıt      | `Cmd+Shift+5` → çubuktaki **4. ikon** (köşesinde ● olan) → **Record** |
| Ses        | `Options ▾` → **Microphone** → mikrofonun. Varsayılan **None**!       |
| Durdurma   | `Cmd + Ctrl + Esc`                                                    |
| Format     | macOS `.mov` — YouTube doğrudan alır                                  |
| Montaj     | **Yok.** Tek çekim                                                    |
| Görünürlük | YouTube → **Unlisted** (Private **değil**)                            |

Terminal fontu **16–18pt** (`Cmd` + `+`). Bildirimleri sustur.

**Takılırsan baştan başlama.** "Sorry, let me say that again." de, cümleyi tekrar kur,
devam et. Jüri akıcılığa değil içeriğe bakıyor.

---

## Çekim listesi

| #   | Sahne            | Süre | Zaman         | Ekranda                      |
| --- | ---------------- | ---- | ------------- | ---------------------------- |
| 0   | Tanıtım          | 0:08 | `0:00 – 0:08` | Boş terminal                 |
| 1   | Problem          | 0:32 | `0:08 – 0:40` | Boş terminal                 |
| 2   | Komut            | 0:22 | `0:40 – 1:02` | `yarn sim overload --replay` |
| 3   | Baseline         | 0:40 | `1:02 – 1:42` | `9 / 42 (21%)`               |
| 4   | Advanced         | 0:33 | `1:42 – 2:15` | `32 / 42 (76%)`              |
| 5   | ⭐ Kayıt kapısı  | 1:00 | `2:15 – 3:15` | `auth-01` + `ORD-1060`       |
| 6   | Kaldırılan deney | 0:42 | `3:15 – 3:57` | `8`                          |
| 7   | Kalan sorun      | 0:34 | `3:57 – 4:31` | `queued 68`, `256`           |
| 8   | Kapanış          | 0:19 | `4:31 – 4:50` | Repro komutu                 |

**Sahne 5 en önemlisi.** Zaman daralırsa 1, 3, 7'den kırp — **5'e dokunma**.

**Kaydı başlatmadan önce:**

```bash
cd "$(git rev-parse --show-toplevel)" && clear
```

---

# 0 · Tanıtım — `0:00 – 0:08`

**EKRAN** — Boş terminal. Kameraya değil ekrana konuşuyorsun.

**SÖYLE**

> Hi, I'm Sefa. // This is **Support Triage Agent**, my submission for the
> **micro1 Agentic Workflows Hackathon**.

_Hemen Sahne 1'e geç, ara verme._

---

# 1 · Problem — `0:08 – 0:38`

**EKRAN** — Boş terminal. Sadece konuşuyorsun.

**YAZ**

```bash
clear
```

**SÖYLE**

> Merve runs a support desk alone. //
>
> Her work day is **420 minutes**. One message takes her **10 minutes**. //
> So she can handle **42** messages in a day. //
> **90** messages arrive.

> The hard part is not writing the replies. // A model can already write a good reply. //
>
> The hard part is **which ones she opens first**, // and **which ones get answered
> without her**.

**Vurgu:** "420", "10", "42", "90" — bu dört sayı yavaş ve net. Problemin tamamı bunlarda.

---

# 2 · Komut — `0:38 – 1:00`

**EKRAN** — Komutu yaz, Enter'a bas, çıktı aksın. İki blok gelir: `baseline` ve `advanced`.

**YAZ**

```bash
yarn sim overload --replay
```

**SÖYLE**

> One command. //
>
> It replays model answers that are saved inside this repository. //
> **No API key. No internet.** The same numbers every time. //
>
> These are real model outputs. We recorded them and committed them as evidence, in
> `fixtures/llm-cache.json`.

**Not:** Çıktı akarken konuşmaya devam et, bitmesini bekleme. Komut 1 saniyeden kısa sürer.

---

# 3 · Baseline — `1:00 – 1:38`

**EKRAN** — `baseline — overload · 90 arrival(s)` bloğu.
`CRITICAL COVERAGE 9 / 42 (21%)` satırını imleçle göster.

**YAZ**

```bash
jq -c '.coverage | {criticalReached, critical, queued}' trajectories/baseline-overload.json
```

**SÖYLE**

> First, the baseline. // This is what a good engineer builds on day one. //
>
> **One** model call gives the category, the urgency and the draft together. //
> Then **one** simple check: is this category on a sensitive list?

> Now the result. // **42** messages really needed her eyes. // She reached **9**. //
> That is **21 percent**.

> And look at this number: it held back only **15** messages out of **90**. //
> The other **75** it answered on its own, without her.

**Vurgu:** "9" ve "21 percent" yavaş. Sonra bir saniye dur — sonraki sahne bunu ikiye katlıyor.

---

# 4 · Advanced — `1:38 – 2:10`

**EKRAN** — Aynı çıktının `advanced — overload` bloğu.
`CRITICAL COVERAGE 32 / 42 (76%)` satırı.

**YAZ**

```bash
jq -c '.scorecard | {llmCalls, cases}' trajectories/baseline.json trajectories/advanced.json
```

**SÖYLE**

> Same command. Same **90** messages. Same recorded model. //
>
> **32** out of **42**. // That is **76 percent**, up from **21**.

> And now the important part — the cost. //
> **28** model calls for **28** cases. // That is **1** call per case. //
> **Exactly what the baseline spends.**

> This is not a bigger budget. It is a better order.

**Vurgu:** "Exactly what the baseline spends" — cümlenin en güçlü yeri. Yavaş söyle.

---

# 5 · ⭐ Neden: kayıt kapısı — `2:10 – 3:10`

**EKRAN** — İki komutu arka arkaya çalıştır. Önce nazik bir Türkçe cevap, hemen ardından
tek satırlık sipariş kaydı. **İkisi ekranda birlikte kalsın** — zıtlık görünsün.

**YAZ**

```bash
jq -r '.run.runs[] | select(.caseId=="auth-01") | "sender: \(.message.senderId)\n\n\(.decision.draft)"' trajectories/baseline.json
```

**SÖYLE**

> Let me show you why. // Case `auth-01`. //
>
> A customer called **S-ARAS** asks when order **1060** will arrive. //
> This is the reply the baseline sent. //
>
> It is polite. It is professional. It is well written. // The model did its job well.

_(Şimdi ikinci komut. Kısa bir sessizlik bırak — jüri cevabı okusun.)_

**YAZ**

```bash
jq '.orders[] | select(.orderId == "ORD-1060")' fixtures/cases.json
```

**SÖYLE**

> Now look at the records. //
>
> Order **1060** belongs to **S-BEREN**. // Not to S-ARAS. //
>
> A stranger was just told about **somebody else's package**.

> You cannot find this by reading the message. // The message is perfect. //
> The fact was in the database the whole time, and the baseline never opened it.

> The advanced line opens the records **first**, before it calls the model. //
> All **6** of these cases are caught. // At **zero** model calls.

**Bu sahnenin tezi:** iyi yazılmış cevap ≠ gönderilmesi gereken cevap. Acele etme.

---

# 6 · Kaldırılan deney — `3:10 – 3:50`

**EKRAN** — Komut `8` yazdırır.

**YAZ**

```bash
jq '[to_entries[] | select(.value.prompt | startswith("TASK: verify"))] | length' fixtures/llm-cache.json
```

**SÖYLE**

> One more thing — something we **removed**. //
>
> We built a third model call. It asked the model: "is your own draft safe?" //
> It sounded like a good idea.

> It was not. // It blocked **4** good replies, and it caught **0** real problems. //
> Every case it touched, it made worse.

> We took it out. // Wrong holds went from **4** to **0**. //
> Cost went from **1.29** calls per case down to **1.00**.

> Its recorded answers are still in the cache — **8** of them. //
> We kept them, so you can see the removal was **measured**, not guessed.

**Vurgu:** "4" ve "0" arka arkaya. Sonra "1.29" → "1.00" — "one point two nine", "one point zero".

---

# 7 · Kalan sorun — `3:50 – 4:22`

**EKRAN** — `queued 68`, `opened 66`, `256`.

**YAZ**

```bash
jq -c '.coverage | {queued, opened, averageWaitMinutes}' trajectories/advanced-overload.json
```

**SÖYLE**

> What is still broken? //
>
> Routing is now **28** out of **28**. Nothing is sent that should be held. //
> But there is a new problem, and it is the **queue**.

> The system holds **68** messages out of **90**. // And every one of them belongs there. //
> But her day only fits **42**.

> The average wait is **256** minutes. // **8** urgent messages were opened too late. //
> **2** were never reached at all.

> Good sorting does not create more hours. //
> On a normal day, when the volume fits, the same design reaches **19** out of **19**.

**Not:** Bu sahne zorunlu — "Main failure mode" dört teslimattan biri. Kesme.

---

# 8 · Kapanış + imza — `4:22 – 4:50`

**EKRAN** — Repro komutu terminalde yazılı.

**YAZ**

```bash
corepack enable && yarn install && yarn sim overload --replay
```

**SÖYLE**

> Three commands from a clean clone. //
> **No API key. No internet.** // You get these exact numbers. //
>
> I'm **Sefa Demir**. // Everything — the code, the records and the reproduction guide —
> is in the repository, on GitHub, under **demirsefa**. //
>
> Thank you for watching.

---

## Videoda geçen her sayı — kaynağıyla

Hepsi commit'lenmiş kayıtlardan okundu, README ile birebir uyuşuyor.

| Sayı                              | Nerede                                                             |
| --------------------------------- | ------------------------------------------------------------------ |
| 420 dk, 10 dk, 42 kapasite        | `trajectories/advanced-overload.md` → operatör modeli              |
| 90 mesaj                          | `coverage.arrivals`                                                |
| 9 / 42 (21%) baseline             | `trajectories/baseline-overload.json` → `coverage.criticalReached` |
| 32 / 42 (76%) advanced            | `trajectories/advanced-overload.json` → `coverage.criticalReached` |
| 15 tutuldu / 68 tutuldu           | aynı dosyaların `coverage.queued` alanı                            |
| 66 açıldı, 256 dk                 | `advanced-overload.json` → `coverage.opened`, `averageWaitMinutes` |
| 8 geç açıldı, 2 hiç ulaşılmadı    | `advanced-overload.json` → `coverage.missed`                       |
| 28 / 28 routing                   | `trajectories/advanced.json` → `scorecard.routedCorrectly`         |
| 1.00 çağrı / vaka                 | `scorecard.llmCalls` = 28, `scorecard.cases` = 28, iki hatta da    |
| 6 / 6 authority, 0 çağrı          | `advanced.json` → `bySubset`; `auth-01` → `llmCalls: 0`            |
| S-ARAS ≠ S-BEREN                  | `fixtures/cases.json` → `orders[ORD-1060].ownerSenderId`           |
| 4 → 0 gereksiz tutma, 1.29 → 1.00 | README Improvement Changelog, aşama 8                              |
| 8 adet `TASK: verify`             | `fixtures/llm-cache.json`                                          |
| 19 / 19 normal gün                | `trajectories/advanced-normal-day.json`                            |

---

# Kayıt sonrası kontrol listesi

### 1. YouTube'a yükle — **Unlisted**

<https://studio.youtube.com> → **Create → Upload videos** → görünürlük **Unlisted**.

> ⚠️ **Private SEÇME.** Private videoyu jüri **açamaz** — submission değerlendirilmemiş
> sayılır. **Unlisted**: linki olan izler, aramada çıkmaz.

"Made for kids" → **No**. **Processing bitmesini bekleme** — upload biter bitmez link çalışır.

### 2. Linki README'ye yaz

```bash
python3 -c "
import pathlib
URL = 'BURAYA_YOUTUBE_LINKI'
p = pathlib.Path('README.md')
old = '<!-- VIDEO LINK GOES HERE - the submission is incomplete without it -->'
s = p.read_text(encoding='utf-8')
assert URL != 'BURAYA_YOUTUBE_LINKI', 'once URL degiskenine linki yapistir'
assert old in s, 'placeholder bulunamadi - README zaten degismis olabilir'
p.write_text(s.replace(old, URL), encoding='utf-8')
print('README.md guncellendi:', URL)
"
```

Doğrula:

```bash
grep -n -A5 '^## Video' README.md
```

### 3. `yarn check` — hepsi yeşil olmalı

```bash
yarn check
```

> Tek kırmızı test `submission.contract.test.ts` → _"the Video section has no URL in it
> (rule 1)"_. Linki yapıştırınca yeşile döner. Dönmezse 2. adımı tekrar et.

### 4. Commit ve push — **GitHub geride**

> 🛑 Push, `pre-push` kancasındaki `SUBMISSION` sözleşmesi rule 1 tarafından bloke
> ediliyor: _"the Video section carries a link"_. Bu kasıtlı bir kapı, arıza değil —
> video linki README'ye girmeden hiçbir şey GitHub'a çıkmıyor. **`--no-verify` ile geçme.**
>
> 2. adımı yaptığın an kapı açılır ve tek push bekleyen commit'lerin hepsini gönderir.

```bash
git add README.md
```

```bash
git commit -m "docs(readme): submission videosu linklendi"
```

```bash
git push origin main
```

Doğrula — bu komut **boş** dönmeli:

```bash
git log --oneline origin/main..HEAD
```

### 5. HackerEarth submission formu

- **Repo:** <https://github.com/demirsefa/hackathon-customer>
- **Video:** aynı Unlisted YouTube linki
- **Headline metric:** critical coverage under overload,
  **9 / 42 (21%) → 32 / 42 (76%)**, at **1.00 model calls per case**
- Formu **gönder** ve onay ekranını gördüğüne emin ol. Gönderilmemiş form = yok.
