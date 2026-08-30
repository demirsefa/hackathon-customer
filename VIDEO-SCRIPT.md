# Submission videosu — çekim senaryosu

**Süre 4:50 · 8 sahne · tek çekim · ekran kaydı + ses**

Konuşma dili **İngilizce** (jüri uluslararası, repo İngilizce). Yönergeler Türkçe.
Sadece `SÖYLE` bloklarını oku.

---

## Teknik özet

|            |                                                                         |
| ---------- | ----------------------------------------------------------------------- |
| Süre       | **4:50** — 5:00 sınırının altında, 10 sn pay                            |
| Kayıt      | `Cmd+Shift+5` → **Record Entire Screen**                                |
| Ses        | **Options → Microphone → (mikrofonun)** — kaydı başlatmadan **doğrula** |
| Çözünürlük | Ekranın kendisi; 1080p veya üstü yeterli                                |
| Format     | macOS `.mov` çıkarır — YouTube doğrudan kabul eder, dönüştürme yok      |
| Montaj     | **Yok.** Tek çekim                                                      |
| Görünürlük | YouTube → **Unlisted** (Private **değil**)                              |

**Terminal:** font en az 16–18pt (`Cmd` + `+`). Jüri telefondan izleyebilir.
Bildirimleri sustur (Focus / Do Not Disturb).

**Tek çekim kuralı:** takılırsan **baştan başlama**. "Sorry, I mean…" de, cümleyi
tekrar kur, devam et. Jüri akıcılığa değil içeriğe bakıyor. 25 dakikada mükemmel çekim
aramak, hiç video olmamasına giden en kısa yol.

---

## Çekim listesi — tek bakışta

| #   | Sahne            | Süre | Zaman         | Ekranda ne var                        |
| --- | ---------------- | ---- | ------------- | ------------------------------------- |
| 1   | Problem          | 0:35 | `0:00 – 0:35` | Boş terminal, sadece konuşma          |
| 2   | Komut            | 0:25 | `0:35 – 1:00` | `yarn sim overload --replay` akıyor   |
| 3   | Baseline         | 0:42 | `1:00 – 1:42` | `9 / 42 (21%)`                        |
| 4   | Advanced         | 0:33 | `1:42 – 2:15` | `32 / 42 (76%)`, maliyet aynı         |
| 5   | ⭐ Kayıt kapısı  | 1:00 | `2:15 – 3:15` | `auth-01` taslağı + `ORD-1060` sahibi |
| 6   | Kaldırılan deney | 0:42 | `3:15 – 3:57` | `TASK: verify` → `8`                  |
| 7   | Hâlâ bozuk olan  | 0:34 | `3:57 – 4:31` | `queued 68`, `256` dk                 |
| 8   | Kapanış          | 0:19 | `4:31 – 4:50` | Repro komutu                          |

**Sahne 5 en önemlisi.** Zaman daralırsa 1, 3 ve 7'den kırp; 5'e dokunma.

**Hazırlık — kaydı başlatmadan önce çalıştır:**

```bash
cd "$(git rev-parse --show-toplevel)" && clear
```

---

# 1 · Problem — `0:00 – 0:35`

**EKRAN** — Temiz terminal, repo kökü. Hiçbir şey çalışmıyor. Sadece sen konuşuyorsun.

**YAZ**

```bash
clear
```

**SÖYLE**

> Merve runs a support desk alone. Her shift is four hundred and twenty working minutes,
> and a case takes her ten. So forty-two fit in a day. Ninety arrive.

> The bottleneck is not writing replies. A model already writes decent replies. It is
> which ones she opens first, and which get answered without her.

---

# 2 · Komut — `0:35 – 1:00`

**EKRAN** — Komutu yazıyorsun, çıktı akıyor. İki blok geliyor: `baseline` ve `advanced`.

**YAZ**

```bash
yarn sim overload --replay
```

**SÖYLE**

> One command. It replays model responses recorded in this repository — no API key, no
> network, the same numbers every time.

> These are real model outputs, committed as evidence in `fixtures/llm-cache.json`.

---

# 3 · Baseline — `1:00 – 1:42`

**EKRAN** — Çıktının `baseline — overload · 90 arrival(s)` bloğu.
`CRITICAL COVERAGE 9 / 42 (21%)` satırını imleçle göster.

**YAZ**

```bash
jq -c '.coverage | {criticalReached, critical, queued}' trajectories/baseline-overload.json
```

**SÖYLE**

> The baseline is what a competent person writes first. One call returning category,
> urgency and a draft together, then one risk check on the category.

> Of the forty-two messages she had to see, she reaches nine. Twenty-one percent.

> It held back only fifteen of the ninety. The rest it answered without her.

---

# 4 · Advanced — `1:42 – 2:15`

**EKRAN** — Aynı çıktının `advanced — overload` bloğu.
`CRITICAL COVERAGE 32 / 42 (76%)` satırı.

**YAZ**

```bash
jq -c '.scorecard | {llmCalls, cases}' trajectories/baseline.json trajectories/advanced.json
```

**SÖYLE**

> Same command, same ninety arrivals, same recorded model. Thirty-two of forty-two.
> Seventy-six percent, up from twenty-one.

> And look at the cost: twenty-eight model calls over twenty-eight cases. One call per
> case — exactly what the baseline spends.

---

# 5 · ⭐ Neden: kayıt kapısı — `2:15 – 3:15`

**EKRAN** — İki komut arka arkaya. Önce Türkçe, nazik bir cevap; hemen ardından tek
satırlık sipariş kaydı. İkisi ekranda **birlikte** kalsın — karşıtlık görsel olarak
görünmeli.

**YAZ**

```bash
jq -r '.run.runs[] | select(.caseId=="auth-01") | "sender: \(.message.senderId)\n\n\(.decision.draft)"' trajectories/baseline.json
```

**YAZ**

```bash
jq '.orders[] | select(.orderId == "ORD-1060")' fixtures/cases.json
```

**SÖYLE**

> Case `auth-01`. Sender S-ARAS asks when order ten-sixty arrives. The baseline sends
> this reply. It is polite, professional, correctly formatted. The model did its job.

> Now the records. Order ten-sixty is owned by S-BEREN. A stranger was just told about
> somebody else's parcel.

> No amount of reading the text finds that out. The fact was in the records the whole
> time, and the baseline never opened them.

> The advanced line opens them first. All six authority cases caught — at zero model calls.

---

# 6 · Kaldırılan deney — `3:15 – 3:57`

**EKRAN** — `fixtures/llm-cache.json` içinde kalan `TASK: verify` kayıtlarının sayısı: `8`.

**YAZ**

```bash
jq '[to_entries[] | select(.value.prompt | startswith("TASK: verify"))] | length' fixtures/llm-cache.json
```

**SÖYLE**

> We built a third call: ask the model whether its own draft was sound. It sounded right.

> It refused four legitimate replies and rescued none. Every case it touched, it made worse.

> Removing it took unnecessary holds from four to zero, and cost from one-point-two-nine
> to one-point-zero per case.

> Its recorded responses are still in the cache — eight of them — as the evidence that
> the removal was measured, not guessed.

---

# 7 · Hâlâ bozuk olan — `3:57 – 4:31`

**EKRAN** — Kuyruğun gerçek boyutu: `queued 68`, `opened 66`, `256` dakika.

**YAZ**

```bash
jq -c '.coverage | {queued, opened, averageWaitMinutes}' trajectories/advanced-overload.json
```

**SÖYLE**

> Routing is now twenty-eight out of twenty-eight. The failure that is left is a
> different shape, and it is the queue.

> The line holds sixty-eight of ninety arrivals, and every one of them belongs there —
> against a day that fits forty-two.

> The average wait is two hundred and fifty-six working minutes. Eight critical arrivals
> were opened after their window had closed, and two were never reached at all.

> Correct triage does not create hours. On a normal day, where the volume fits, the same
> design reaches nineteen of nineteen.

---

# 8 · Kapanış — `4:31 – 4:50`

**EKRAN** — Repro komutu terminalde.

**YAZ**

```bash
corepack enable && yarn install && yarn sim overload --replay
```

**SÖYLE**

> From a clean clone: `corepack enable`, `yarn install`, `yarn sim overload --replay`.

> No API key, no network. You get these exact numbers. Thank you.

---

## Videoda geçen her sayı — kaynağıyla

Hepsi commit'lenmiş kayıtlardan okundu, README ile birebir uyuşuyor.

| Sayı                              | Nerede                                                             |
| --------------------------------- | ------------------------------------------------------------------ |
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

<https://studio.youtube.com> → **Create → Upload videos**. Görünürlük ekranında
**Unlisted** seç.

> ⚠️ **Private SEÇME.** Private videoyu jüri **açamaz** — link çalışmaz, submission
> değerlendirilmemiş sayılır. Doğru seçenek **Unlisted**: linki olan izler, aramada çıkmaz.

"Made for kids" → **No**. Yayın bitince linki kopyala.

### 2. Linki README'ye yaz

Linki komuttaki `BURAYA_YOUTUBE_LINKI` yerine yapıştır, sonra çalıştır:

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

### 3. `yarn check` — **562 / 562** bekleniyor

```bash
yarn check
```

> Şu an **561 / 562**. Tek kırmızı test `submission.contract.test.ts`, sebebi tam olarak
> bu: _"the Video section has no URL in it (rule 1)"_. Linki yapıştırınca 562 / 562 olur.
> Yeşile dönmezse linki yanlış yere koymuşsundur — 2. adımı tekrar et.

### 4. Commit ve push

```bash
git add README.md
```

```bash
git commit -m "docs(readme): submission videosu linklendi"
```

```bash
git push origin main
```

Doğrula:

```bash
git status --short && git log --oneline -1
```

### 5. HackerEarth submission formu

- **Repo:** <https://github.com/demirsefa/hackathon-customer>
- **Video:** aynı Unlisted YouTube linki
- **Headline metric:** critical coverage under overload,
  **9 / 42 (21%) → 32 / 42 (76%)**, at **1.00 model calls per case**
- Formu **gönder** ve onay ekranını/mailini gördüğüne emin ol. Gönderilmemiş form = yok.
