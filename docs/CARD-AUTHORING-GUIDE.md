# Стандарт карты Манары (schema 0.3)

Эталоны: `knowledge/manara/cards/major/MANARA_MAJOR_09.json`, `MANARA_MAJOR_10.json`, `minor/fire/MANARA_FIRE_03.json`.

## Порядок работы над картой
1. **VISUAL_FACT по изображению.** Сначала смотришь на скан, потом читаешь тексты. Записываешь только видимое. Неоднозначное идёт в `uncertain`, неустановимое (мысли, чувства, намерения, согласие, предыстория) — в `NOT_ESTABLISHABLE_FROM_IMAGE`.
2. **Проверка по второму источнику:** кроп изображения на lunaro и/или описания сюжета в текстах. Если текст описывает деталь, которой на изображении нет, это фиксируется в `SOURCE_DISAGREEMENT`.
3. **SOURCE_INTERPRETATION:** по одному утверждению на запись, у каждой `source` и `about`. Пересказ своими словами, без копирования текста.
4. **TRADITIONAL_MEANING:** базовый русский текст (`src.text.ru_base`) и напечатанная на карте астрология.
5. **ARCANA_SYNTHESIS:** авторские гипотезы. У каждой `status: authorial_hypothesis`, `basis`, `applies_when`; если гипотеза не обязательна — `not_mandatory: true`.
6. **POSITIONAL_APPLICATION:** ключи (см. ниже), формулировки только вероятностные.
7. **Защитные поля:** `RECOGNITION`, `COMMON_MODEL_ERRORS` (первая ошибка — подмена сюжетом RWS), `WHAT_THIS_CARD_IS_NOT`, `tone_guards`.
8. `EDITORIAL_NOTE: []` — пусто, это поле для владельца.
9. **CONFIDENCE:** `visual` / `source` / `interpretive` — независимо друг от друга.

## Жёсткие правила
- Манара не реконструируется через RWS. RWS появляется **только** в `DIFFERENCE_FROM_RWS`.
- Не утверждать мысли, чувства, намерения или согласие персонажей, если это не видно и не сказано в источнике. Даже когда сказано в источнике, это идёт в `SOURCE_INTERPRETATION`, а не в `VISUAL_FACT`.
- Психологические гипотезы не превращаются в диагнозы или утверждения о человеке.
- Расхождения источников сохраняются, а не выбираются молча.
- **Подробность пропорциональна источникам.** Если источников мало, утверждений тоже мало. Пустое поле лучше выдуманного.
- Если интерпретация слабая или противоречивая, снижай `interpretive`.
- Сексуальное содержание описывается нейтрально и фактически, без эротизации. Сцены насилия и принуждения описываются только как видимые действия, без оценки «согласия», с `tone_guards`, запрещающими романтизацию.

## Ключи POSITIONAL_APPLICATION
| ключ | позиция |
|---|---|
| `present` | что происходит |
| `blind_spot` | что я не замечаю |
| `influence` | что влияет |
| `obstacle` | что мешает |
| `resource` | что помогает |
| `understand` | что стоит понять |
| `tendency` | возможное развитие |
| `advice` | совет |
| `shadow` | тень |

Формат: `{ "default": "…" }` и, при необходимости, варианты по теме (`relationships`, `work`, `self`). Формулировки вида «может указывать…», «можно прочитать как…», «в этой позиции карта может подсветить…». Никогда «это означает, что ты…».

## Скелет JSON
```jsonc
{
  "id": "MANARA_FIRE_05", "deck": "MANARA", "schema_version": "0.3",
  "identity": { "number": 5, "arcana": "minor", "suit": "FIRE", "rank": "5",
                "printed_titles": [...], "name_ru": "...", "aliases_ru": [...],
                "rws_slot_for_mapping_only": "...", "printed_astrology": "..." },
  "RECOGNITION": { "signature": "...", "unique_markers": [...], "if_you_see_this_it_is_NOT_this_card": [...] },
  "VISUAL_FACT": { "verification": {...}, "characters_count": ..., "...": "...",
                   "established": [...], "not_present": [...], "uncertain": [...],
                   "NOT_ESTABLISHABLE_FROM_IMAGE": [...] },
  "SOURCE_INTERPRETATION": [ { "source": "...", "about": "...", "claim": "..." } ],
  "TRADITIONAL_MEANING": { "lineage": "...", "summary": "...", "printed_astrology": "...", "source": "src.text.ru_base" },
  "SOURCE_DISAGREEMENT": [ { "topic": "...", "claims": {...}, "visual_verdict": "..." } ],
  "ARCANA_SYNTHESIS": { "_status": "Авторский синтез Arcana. НЕ традиционное значение.",
                        "core_reading": "...", "psychology": [ { "hypothesis": "...", "status": "authorial_hypothesis", "basis": "...", "applies_when": [...] } ],
                        "relationships": "...", "work_decision": "...", "shadow": "...",
                        "reversed_or_blocked": "...", "reflection_questions": [ { "q": "...", "status": "авторский", "applies_when": "..." } ],
                        "small_actions": [...] },
  "POSITIONAL_APPLICATION": { "_status": "ARCANA_SYNTHESIS, применённый к типам позиций", "present": {...}, "...": {} },
  "DIFFERENCE_FROM_RWS": { "rws_card": "...", "rws_core": "...", "manara_core": "...", "shared": "...", "transfer_risk": "..." },
  "COMMON_MODEL_ERRORS": [...], "WHAT_THIS_CARD_IS_NOT": [...], "tone_guards": [...],
  "EDITORIAL_NOTE": [],
  "SOURCE_NOTES": "...",
  "CONFIDENCE": { "visual": "...", "source": "...", "interpretive": "..." },
  "review": { "status": "draft_scaled", "date": "2026-10-02" }
}
```
