# Submission videosu — çekim senaryosu

**~4:20 · 7 sahne · tek çekim · ekran kaydı + ses**

Konuşma dili **İngilizce, B2 seviye** — kısa cümle, basit kelime. Yönergeler Türkçe;
sadece `SÖYLE` bloklarını sesli oku. `//` işareti nefes molası: yarım saniye dur.
Sayıları rakam gördüğün gibi oku — `9 / 42` için "nine out of forty-two".

> ⚠️ **Geçen çekimin tek hatası buydu.** Sahne 2'de komut **`overload`** olacak.
> Ekranda `normal-day` çalışıp anlatımda `9 / 42` demek, README'nin `## Video`
> bölümüne bir düzeltme paragrafı yazdırdı. Bu sefer doğru koşarsa o paragraf silinir.

Kayıttan önce:

```bash
cd "$(git rev-parse --show-toplevel)" && clear
```

Terminal fontu 16–18pt, bildirimler kapalı. Takılırsan baştan başlama — "let me say
that again" de, cümleyi tekrar kur, devam et. Jüri akıcılığa değil içeriğe bakıyor.

## Çekim listesi

| #   | Sahne                | Süre | Zaman         | Ekranda                      |
| --- | -------------------- | ---- | ------------- | ---------------------------- |
| 1   | Problem              | 0:35 | `0:00 – 0:35` | Boş terminal                 |
| 2   | Koşu                 | 0:20 | `0:35 – 0:55` | `yarn sim overload --replay` |
| 3   | Baseline             | 0:35 | `0:55 – 1:30` | `9 / 42 (21%)`               |
| 4   | Advanced             | 0:30 | `1:30 – 2:00` | `32 / 42 (76%)`              |
| 5   | ⭐ Kayıt kapısı      | 0:55 | `2:00 – 2:55` | `auth-01` + `ORD-1060`       |
| 6   | Kaldırılan deney     | 0:40 | `2:55 – 3:35` | `8`                          |
| 7   | Kalan sorun, kapanış | 0:45 | `3:35 – 4:20` | `68`, `256`, repro komutu    |

**Sahne 5 ve 6 zorunlu** — biri tezin kendisi, diğeri briefin açıkça istediği
"kaldırdığın bir deney" satırı. Zaman daralırsa 1 ve 3'ten kırp.

---

# 1 · Problem — `0:00`

**EKRAN** — Boş terminal.

**SÖYLE**

> Hi, I'm Sefa. This is **Support Triage Agent**, for the micro1 Agentic Workflows
> Hackathon. //
>
> Merve runs a support desk alone. Her day is **420** minutes. One message takes her
> **10**. // So she can handle **42** a day. // **90** arrive. //
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

**SÖYLE** — çıktı akarken konuş, bitmesini bekleme; komut bir saniyeden kısa sürer.

> One command. // It replays real model answers committed inside the repository. //
> **No API key, no internet** — the same numbers every time.

---

# 3 · Baseline — `0:55`

**EKRAN** — `baseline — overload` bloğu. `CRITICAL COVERAGE 9 / 42 (21%)` satırını
imleçle göster.

**SÖYLE**

> First the baseline — what a good engineer builds on day one. // **One** model call
> gives the category, the urgency and the draft together, then one check: is this
> category sensitive? //
>
> **42** messages needed her eyes. She reached **9**. // **21 percent**. //
>
> It held back only **15** of **90**. The other **75** it answered on its own.

_"9" ve "21 percent" yavaş. Sonra bir saniye dur — sonraki sahne bunu üçe katlıyor._

---

# 4 · Advanced — `1:30`

**EKRAN** — Aynı çıktının `advanced — overload` bloğu.

**YAZ**

```bash
jq -c '.scorecard | {llmCalls, cases}' trajectories/baseline.json trajectories/advanced.json
```

**SÖYLE**

> Same command, same **90** messages, same recorded model — new design. // **32** out
> of **42**. **76 percent**, up from **21**. //
>
> And the cost: **28** model calls for **28** cases. **One** call per case — **exactly
> what the baseline spends**. //
>
> This is not a bigger budget. It is a better order.

_"Exactly what the baseline spends" cümlenin en güçlü yeri. Yavaş söyle._

---

# 5 · ⭐ Kayıt kapısı — `2:00`

**EKRAN** — İki komut arka arkaya. Önce nazik bir Türkçe cevap, hemen ardından tek
satırlık sipariş kaydı. **İkisi ekranda birlikte kalsın** — zıtlık görünsün.

**YAZ**

```bash
jq -r '.run.runs[] | select(.caseId=="auth-01") | "sender: \(.message.senderId)\n\n\(.decision.draft)"' trajectories/baseline.json
```

**SÖYLE**

> Where does that come from? One case. // A customer called **S-ARAS** asks when order
> **1060** will arrive. This is the reply the baseline sent. //
>
> It is polite, professional, well written. The model did its job.

_Kısa bir sessizlik bırak — jüri cevabı okusun._

**YAZ**

```bash
jq '.orders[] | select(.orderId == "ORD-1060")' fixtures/cases.json
```

**SÖYLE**

> Now the records. // Order **1060** belongs to **S-BEREN**. Not S-ARAS. // A stranger
> was just told about somebody else's package. //
>
> You cannot find this by reading the message — the message is perfect. // The fact was
> in the database the whole time, and the baseline never opened it. //
>
> The advanced line opens the records **first**, before any model call. All **6** of
> these cases are caught, at **zero** model calls.

_Bu sahnenin tezi: iyi yazılmış cevap, gönderilmesi gereken cevap demek değil._

---

# 6 · Kaldırılan deney — `2:55`

**EKRAN** — Komut `8` yazdırır.

**YAZ**

```bash
jq '[to_entries[] | select(.value.prompt | startswith("TASK: verify"))] | length' fixtures/llm-cache.json
```

**SÖYLE**

> Now something we **removed**. // We built a third call that asked the model: is your
> own draft safe? //
>
> It blocked **4** good replies and caught **0** real problems. Every case it touched,
> it made worse. // We took it out: wrong holds **4** to **0**, cost **1.29** down to
> **1.00** calls per case. //
>
> Its answers are still in the cache — **8** of them — so you can see the removal was
> **measured**, not guessed.

_"1.29" → "one point two nine", "1.00" → "one point zero"._

---

# 7 · Kalan sorun ve kapanış — `3:35`

**YAZ**

```bash
jq -c '.coverage | {queued, opened, averageWaitMinutes}' trajectories/advanced-overload.json
```

**SÖYLE**

> What is still broken? // Routing is **28** out of **28** — nothing is sent that
> should be held. // But the system holds **68** of **90**, and every one belongs
> there. Her day fits **42**. //
>
> Average wait: **256** minutes. **8** urgent messages opened too late, **2** never
> reached. // Good sorting does not create more hours. // On a normal day, the same
> design reaches **19** out of **19**. //
>
> Three commands from a clean clone reproduce all of this — no key, no internet. //
> I'm **Sefa Demir**, everything is on GitHub under **demirsefa**. Thank you.

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
