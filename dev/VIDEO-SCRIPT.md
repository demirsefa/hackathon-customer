# Submission videosu — çekim senaryosu

**~4:20 · 7 sahne · tek çekim · ekran kaydı + ses**

Konuşma dili **İngilizce, B2 seviye** — kısa cümle, basit kelime. Yönergeler Türkçe;
sadece `SÖYLE` bloklarını sesli oku. `//` işareti nefes molası: yarım saniye dur.

Her sahnede **EKRANDA** bloğu var: komutun gerçek çıktısı, birebir. Çekimden önce
komutları bir kez çalıştır — ekranda ne göreceğini bilerek konuşmak, canlı okumaktan
çok daha kolay.

> ⚠️ **Geçen çekimin tek hatası buydu.** Sahne 2'de komut **`overload`** olacak.
> Ekranda `normal-day` çalışıp anlatımda `9 / 42` demek, README'nin `## Video`
> bölümüne bir düzeltme paragrafı yazdırdı. Bu sefer doğru koşarsa o paragraf silinir.

Kayıttan önce:

```bash
cd "$(git rev-parse --show-toplevel)" && clear
```

Terminal fontu 16–18pt, bildirimler kapalı. Takılırsan baştan başlama — "let me say
that again" de, cümleyi tekrar kur, devam et. Jüri akıcılığa değil içeriğe bakıyor.

## Telaffuz — metinde geçen zor kelimeler

Türkçe okunuşla yazıldı. Büyük harfli hece **vurgulu** olan.

| Kelime                | Oku                   | Kelime        | Oku         |
| --------------------- | --------------------- | ------------- | ----------- |
| **triage**            | TRİ-yaaj              | **records**   | RE-kırdz    |
| **agent / agentic**   | EY-cınt / ey-CEN-tik  | **database**  | DEY-tı-beys |
| **hackathon**         | HE-kı-ton             | **measured**  | ME-jırd     |
| **coverage**          | KA-vı-ric             | **guessed**   | GEST        |
| **category**          | KE-tı-gori            | **average**   | EV-rıc      |
| **sensitive**         | SEN-sı-tiv            | **budget**    | BA-cıt      |
| **urgent**            | ÖR-cınt               | **exactly**   | ig-ZEKT-li  |
| **routing**           | RUU-ting              | **percent**   | pır-SENT    |
| **arrive**            | ı-RAYV                | **neighbour** | NEY-bır     |
| **polite**            | pı-LAYT               | **package**   | PE-kıc      |
| **removed / removal** | rı-MUUVD / rı-MUU-vıl | **answered**  | AAN-sırd    |

**Sayılar.** Rakam gördüğün gibi oku:

| Yazılı  | Söylenen                    | Yazılı | Söylenen              |
| ------- | --------------------------- | ------ | --------------------- |
| 9 / 42  | nine out of forty-two       | 1.29   | one point two nine    |
| 32 / 42 | thirty-two out of forty-two | 1.00   | one point zero        |
| 21%     | twenty-one percent          | 256    | two hundred fifty-six |
| 76%     | seventy-six percent         | 420    | four hundred twenty   |

## Çekim listesi

| #   | Sahne                | Süre | Zaman         | Ekranda                      |
| --- | -------------------- | ---- | ------------- | ---------------------------- |
| 1   | Problem              | 0:35 | `0:00 – 0:35` | Boş terminal                 |
| 2   | Koşu                 | 0:20 | `0:35 – 0:55` | `yarn sim overload --replay` |
| 3   | Baseline             | 0:35 | `0:55 – 1:30` | `9 / 42 (21%)`               |
| 4   | Advanced             | 0:30 | `1:30 – 2:00` | `32 / 42 (76%)` + maliyet    |
| 5   | ⭐ Kayıt kapısı      | 0:55 | `2:00 – 2:55` | `auth-01` + `ORD-1060`       |
| 6   | Kaldırılan deney     | 0:40 | `2:55 – 3:35` | `8`                          |
| 7   | Kalan sorun, kapanış | 0:45 | `3:35 – 4:20` | `68`, `256`, repro komutu    |

**Sahne 5 ve 6 zorunlu** — biri tezin kendisi, diğeri briefin açıkça istediği
"kaldırdığın bir deney" satırı. Zaman daralırsa 1 ve 3'ten kırp.

---

# 1 · Problem — `0:00`

**EKRAN** — Boş terminal. Komut yok.

**SÖYLE**

> Hi, I'm Sefa. This is **Support Triage Agent**, my project for the micro1 Agentic
> Workflows Hackathon. //
>
> Merve runs a support desk alone. Her work day is **420** minutes. One message takes
> her **10** minutes. // So she can do **42** in a day. // **90** arrive. //
>
> The hard part is not writing the replies — a model does that already. // The hard
> part is **which ones she opens first**, and **which ones get answered without her**.

_Vurgu: 420, 10, 42, 90. Problemin tamamı bu dört sayıda._

---

# 2 · Koşu — `0:35`

**YAZ**

```bash
yarn sim overload --replay
```

**EKRANDA** — Uzun bir gün dökümü akar, sonunda özet gelir. Akmasını bekleme, konuşmaya
devam et; komut bir saniyeden kısa sürer. **Bu sahnenin amacı gerçek koşuyu göstermek**
— sayıları okumayacaksın, onlar 3. sahnede temiz ekranda.

**SÖYLE**

> One command. // It replays real model answers that are saved in this project. //
> **No API key, no internet** — the same numbers every time.

---

# 3 · Baseline — `0:55`

**YAZ** — 2. sahnedeki koşunun baseline sonucu, altı satırda.

```bash
jq -r '.coverage | "\(.pipeline) — \(.scenario)\n\n  critical coverage   \(.criticalReached) / \(.critical)   (\(.criticalReached*100/.critical|round)%)\n  held for her        \(.queued) of \(.arrivals)\n  she opened          \(.opened)\n  average wait        \(.averageWaitMinutes) min\n  model calls         \(.llmCalls) for \(.arrivals) messages"' trajectories/baseline-overload.json
```

**EKRANDA**

```text
baseline — overload

  critical coverage   9 / 42   (21%)
  held for her        15 of 90
  she opened          15
  average wait        15 min
  model calls         90 for 90 messages
```

**SÖYLE**

> First, the baseline. // The simple version — and a fair one, not built to lose. //
> **One** model call gives the category, the urgency and the draft together. // Then one
> check: is this category sensitive? //
>
> **42** messages needed her eyes. She reached **9**. // **21 percent**. //
>
> And it held back only **15** out of **90**. The other **75** it answered on its own.

_"nine" ve "twenty-one percent" yavaş. Sonra bir saniye dur._

---

# 4 · Advanced — `1:30`

**YAZ** — Aynı komut, tek fark dosya adı: `baseline` yerine `advanced`.

```bash
jq -r '.coverage | "\(.pipeline) — \(.scenario)\n\n  critical coverage   \(.criticalReached) / \(.critical)   (\(.criticalReached*100/.critical|round)%)\n  held for her        \(.queued) of \(.arrivals)\n  she opened          \(.opened)\n  average wait        \(.averageWaitMinutes) min\n  model calls         \(.llmCalls) for \(.arrivals) messages"' trajectories/advanced-overload.json
```

**EKRANDA**

```text
advanced — overload

  critical coverage   32 / 42   (76%)
  held for her        68 of 90
  she opened          66
  average wait        256 min
  model calls         90 for 90 messages
```

**SÖYLE**

> Same run, new design. // **32** out of **42**. **76 percent**, up from **21**. //
>
> And the same **90** model calls for the same **90** messages.

**YAZ** — maliyetin nereden geldiği. Vaka başına dağılımı yazar.

```bash
jq -r '"\(.scorecard.pipeline): \(.scorecard.llmCalls) calls / \(.scorecard.cases) cases  ·  per case " + ([.run.runs[].decision.llmCalls] | group_by(.) | map("\(length)×\(.[0])") | join(", "))' trajectories/baseline.json trajectories/advanced.json
```

**EKRANDA**

```text
baseline: 28 calls / 28 cases  ·  per case 28×1
advanced: 28 calls / 28 cases  ·  per case 8×0, 12×1, 8×2
```

**SÖYLE**

> **Exactly the same budget.** // But look at the shape. // The baseline spends one call
> on every case. // The advanced line spends **nothing** on eight of them — the records
> already decided those — and **two** on eight others. // It comes out the same. //
>
> This is not a bigger budget. It is a better order.

_"Exactly the same budget" ve "a better order" yavaş._

---

# 5 · ⭐ Kayıt kapısı — `2:00`

İki komut arka arkaya. **İkisi ekranda birlikte kalsın** — zıtlık görünsün.

**YAZ**

```bash
jq -r '.run.runs[] | select(.caseId=="auth-01") | "sender: \(.message.senderId)\n\n\(.decision.draft)"' trajectories/baseline.json
```

**EKRANDA**

```text
sender: S-ARAS

Merhaba, ORD-1060 numaralı siparişinizin teslimat durumunu kontrol ediyoruz.
Adreste kimse bulunmama ihtimaline karşı komşuya bırakılması talebinizi kargo
firmasına iletebiliriz; ancak bu seçenek kargo firmasının politikasına bağlıdır.
Teslimat tarihini ve komşuya bırakma seçeneğinin uygunluğunu netleştirip en kısa
sürede size dönüş yapacağız. Anlayışınız için teşekkür ederiz.
```

**SÖYLE**

> Where does that come from? Let me show you one case. //
>
> A customer called **S-ARAS** asks if order **1060** arrives today, and if it can be
> left with a **neighbour**. // This is the reply the baseline sent. //
>
> It is polite. It is well written. The model did its job.

_Kısa bir sessizlik bırak — jüri cevabı okusun._

**YAZ**

```bash
jq '.orders[] | select(.orderId == "ORD-1060")' fixtures/cases.json
```

**EKRANDA**

```text
{
  "orderId": "ORD-1060",
  "ownerSenderId": "S-BEREN",
  "status": "shipped"
}
```

**SÖYLE**

> Now look at the records. // Order **1060** belongs to **S-BEREN**. Not S-ARAS. //
>
> A stranger asked us to leave somebody else's package with his neighbour — and we
> offered to arrange it. //
>
> You cannot find this by reading the message. The message is perfect. // The fact was
> in the database the whole time, and the baseline never opened it. //
>
> The advanced line opens the records **first**, before any model call. // All **6** of
> these cases are caught, at **zero** model calls.

_Bu sahnenin tezi: iyi yazılmış cevap, gönderilmesi gereken cevap demek değil._

---

# 6 · Kaldırılan deney — `2:55`

**YAZ**

```bash
jq '[to_entries[] | select(.value.prompt | startswith("TASK: verify"))] | length' fixtures/llm-cache.json
```

**EKRANDA**

```text
8
```

**SÖYLE**

> Now something we **removed**. // We built a third model call. It asked the model: is
> your own draft safe? //
>
> It was not helpful. // It blocked **4** good replies and caught **0** real problems.
> Every case it touched, it made worse. //
>
> We took it out. Wrong holds went from **4** to **0**. // Cost went from **1.29** down
> to **1.00** calls per case. //
>
> Its answers are still in the cache — **8** of them. // So you can see the removal was
> **measured**, not guessed.

_"four" ve "zero" arka arkaya, net. Sonra "one point two nine" → "one point zero"._

---

# 7 · Kalan sorun ve kapanış — `3:35`

**YAZ**

```bash
jq -c '.coverage | {queued, opened, averageWaitMinutes}' trajectories/advanced-overload.json
```

**EKRANDA**

```text
{"queued":68,"opened":66,"averageWaitMinutes":256}
```

**SÖYLE**

> What is still broken? // Routing is now **28** out of **28**. Nothing is sent that
> should be held. //
>
> But the system holds **68** out of **90**, and every one of them belongs there. // Her
> day fits **42**. //
>
> She waits **256** minutes on average. // **8** urgent messages were opened too late.
> **2** were never reached. //
>
> Good sorting does not create more hours. // On a normal day, when the volume fits, the
> same design reaches **19** out of **19**. //
>
> Three commands from a clean clone give you these exact numbers. No key, no internet.
> // I'm **Sefa Demir**. Everything is on GitHub, under **demirsefa**. Thank you.

**EKRAN (kapanış)** — Komutu yaz, çalıştırma şart değil.

```bash
corepack enable && yarn install && yarn sim overload --replay
```

_Sahne 7 zorunlu: "Main failure mode" dört teslimattan birinin parçası._

---

# Kayıttan sonra

1. **YouTube → Unlisted.** Private **seçme** — jüri açamaz, submission değerlendirilmemiş
   sayılır. "Made for kids" → No. Processing bitmesini bekleme, link hemen çalışır.
2. **README `## Video`** — süre satırı, link ve geçen çekimin `normal-day` / `overload`
   düzeltme paragrafı güncellenir. Yeni çekimde o hata yoksa paragraf silinir.
3. **Push, sonra HackerEarth formu.** Sayfa revizyona izin veriyor: "Revisions are
   allowed until the deadline; only the latest complete submission is evaluated." Formu
   erken gönder, sonra güncelle.

Formda verilecek manşet: critical coverage under overload, **9 / 42 (21%) → 32 / 42
(76%)**, at **1.00 model calls per case**.
