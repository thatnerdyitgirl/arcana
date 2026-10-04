# Arcana — веб-прототип

Без бэкенда. Все данные — из `knowledge/`, движок — из `engine/`.

## Открыть
Собранная версия — один файл: `build/arcana.html`. Его можно открыть двойным кликом в браузере.

## Пересобрать после изменений
```bash
node tools/build_app.mjs
```
Скрипт создаёт `app/data.json` (урезанная база карт) и `build/arcana.html` (стили, данные и код в одном файле).

## Разработка
`app/index.html` подключает модули из `engine/` напрямую. Её нужно открывать через локальный сервер из корня проекта:
```bash
python3 -m http.server 4173
```
Затем открыть http://localhost:4173/app/

## Тесты
```bash
node tests/parser.test.mjs
python3 tools/validate_manara.py
```

## Файлы
- `app/app.mjs` — экраны: вопрос, все расклады, результат
- `app/styles.css` — дизайн-токены и стили (тёмная и светлая темы)
- `engine/core.mjs` — движок без Node; `engine/arcana.mjs` — загрузка базы в Node
- `engine/parser.mjs` — распознавание карт из строки
- `engine/handoff.mjs` — текст для «Углубить в чате»
