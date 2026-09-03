#!/usr/bin/env node
// usage-guard: Fable 5.1 の「週次上限の 50% まで」制約をハーネス側で検知する。
//
//   node usage-guard.js statusline   ステータスライン。モデル / 文脈使用率 / 5h・週の使用率を表示し、
//                                    週の使用率を .claude/usage-cache.json にキャッシュする。
//   node usage-guard.js prompt       UserPromptSubmit フック。キャッシュを読み、Fable 使用中かつ
//                                    週の使用率が閾値以上なら警告を stdout に出す（= Claude の文脈に載る）。
//
// 閾値は env FABLE_SWITCH_THRESHOLD（既定 45）。Fable の枠は 50% なので、少し手前で促す。
// 依存: Node.js のみ（jq 不要）。

"use strict";
const fs = require("fs");
const path = require("path");

const FABLE_LIMIT = 50;
const THRESHOLD = Number(process.env.FABLE_SWITCH_THRESHOLD) || 45;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function projectDir(input) {
  return (
    process.env.CLAUDE_PROJECT_DIR ||
    (input && input.workspace && input.workspace.project_dir) ||
    (input && input.cwd) ||
    process.cwd()
  );
}

function cachePath(input) {
  return path.join(projectDir(input), ".claude", "usage-cache.json");
}

function isFable(modelId) {
  return /fable/i.test(modelId || "");
}

function pct(v) {
  return typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : null;
}

function fmtReset(epochSec) {
  if (typeof epochSec !== "number") return "";
  const d = new Date(epochSec * 1000);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

function statusline() {
  const input = parseJson(readStdin()) || {};
  const model = input.model || {};
  const modelId = model.id || "";
  const modelName = model.display_name || modelId || "?";
  const ctx = pct(input.context_window && input.context_window.used_percentage);
  const rl = input.rate_limits || {};
  const fiveHour = pct(rl.five_hour && rl.five_hour.used_percentage);
  const sevenDay = pct(rl.seven_day && rl.seven_day.used_percentage);
  const sevenDayReset = rl.seven_day && rl.seven_day.resets_at;

  const parts = [`[${modelName}]`];
  if (ctx !== null) parts.push(`文脈 ${ctx}%`);
  if (fiveHour !== null) parts.push(`5h ${fiveHour}%`);
  if (sevenDay !== null) {
    let week = `週 ${sevenDay}%`;
    if (isFable(modelId)) {
      week += `/${FABLE_LIMIT}`;
      if (sevenDay >= FABLE_LIMIT) week += " ⛔ /model opus";
      else if (sevenDay >= THRESHOLD) week += " ⚠ /model opus";
    }
    const reset = fmtReset(sevenDayReset);
    if (reset) week += ` (→${reset})`;
    parts.push(week);
  }
  process.stdout.write(parts.join(" | "));

  // rate_limits が来ていない間（セッション最初の応答前など）はキャッシュを触らない
  if (sevenDay === null && fiveHour === null) return;
  try {
    const file = cachePath(input);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          model_id: modelId,
          seven_day: sevenDay,
          seven_day_resets_at: sevenDayReset || null,
          five_hour: fiveHour,
          updated_at: Date.now(),
        },
        null,
        2
      )
    );
  } catch {
    // キャッシュ書き込み失敗はステータスライン表示を妨げない
  }
}

function prompt() {
  const input = parseJson(readStdin()) || {};
  const cache = parseJson(safeRead(cachePath(input)));
  if (!cache) return;
  if (typeof cache.updated_at !== "number" || Date.now() - cache.updated_at > CACHE_MAX_AGE_MS) return;
  if (!isFable(cache.model_id)) return;
  const sevenDay = pct(cache.seven_day);
  if (sevenDay === null || sevenDay < THRESHOLD) return;

  const reset = fmtReset(cache.seven_day_resets_at);
  const resetNote = reset ? `（週次リセット ${reset}）` : "";
  if (sevenDay >= FABLE_LIMIT) {
    process.stdout.write(
      `[usage-guard] 週次使用率 ${sevenDay}% — Fable 5.1 の同梱枠（${FABLE_LIMIT}%）を超えています${resetNote}。` +
        `これ以上の Fable 利用は usage credits の課金対象になりえます。返答の冒頭で「/model opus に切り替えてください」と1行で促してください。作業自体は止めないでください。\n`
    );
  } else {
    process.stdout.write(
      `[usage-guard] 週次使用率 ${sevenDay}% — Fable 5.1 の同梱枠（${FABLE_LIMIT}%）が近づいています${resetNote}。` +
        `返答の冒頭で「そろそろ /model opus に切り替えを」と1行で促してください（この節目で未案内の場合のみ）。作業自体は止めないでください。\n`
    );
  }
}

function safeRead(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

const mode = process.argv[2];
if (mode === "statusline") statusline();
else if (mode === "prompt") prompt();
else {
  process.stderr.write("usage: usage-guard.js <statusline|prompt>\n");
  process.exit(1);
}
