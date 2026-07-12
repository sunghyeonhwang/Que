# Que 쇼츠 합성 파이프라인 — 목차(full-deck-outline.md)의 왜/어떻게/효과 대본을
# 카드+화면 프레임+자막+TTS(Yuna)로 30~60초 mp4 한 편으로 만든다.
# 사용: pptenv/bin/python make_short.py <spec.json>
import json, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 800
BG = (14, 15, 18)
CARD = (22, 24, 29)
TEXT = (232, 234, 237)
SUB = (154, 160, 166)
BRAND = (116, 136, 234)
ACCENT = (52, 211, 153)
FONT_PATH = "/System/Library/Fonts/AppleSDGothicNeo.ttc"

def font(size, bold=False):
    # AppleSDGothicNeo.ttc: index 0=Regular, 5 근처=Bold — 이름으로 탐색
    for idx in range(12):
        try:
            f = ImageFont.truetype(FONT_PATH, size, index=idx)
            name = f.getname()[1].lower()
            if bold and "bold" in name and "extra" not in name and "semi" not in name:
                return f
            if not bold and name == "regular":
                return f
        except Exception:
            break
    return ImageFont.truetype(FONT_PATH, size, index=0)

F_TITLE = font(64, bold=True)
F_COPY = font(34)
F_BODY = font(40, bold=True)
F_BODY_S = font(30)
F_LABEL = font(26, bold=True)
F_SUB = font(28)
F_URL = font(30)

def wrap(draw, text, fnt, max_w):
    lines, line = [], ""
    for word in text.split(" "):
        cand = (line + " " + word).strip()
        if draw.textlength(cand, font=fnt) <= max_w:
            line = cand
        else:
            if line: lines.append(line)
            line = word
    if line: lines.append(line)
    return lines

def draw_center(img, blocks, y_start=None):
    """blocks: [(text, font, color, gap_after)] — 세로 중앙 정렬 텍스트 카드."""
    d = ImageDraw.Draw(img)
    rendered = []  # (lines, font, color, gap)
    total_h = 0
    for text, fnt, color, gap in blocks:
        lines = wrap(d, text, fnt, W - 240)
        lh = int(fnt.size * 1.45)
        rendered.append((lines, fnt, color, gap, lh))
        total_h += lh * len(lines) + gap
    y = y_start if y_start is not None else (H - total_h) // 2
    for lines, fnt, color, gap, lh in rendered:
        for line in lines:
            tw = d.textlength(line, font=fnt)
            d.text(((W - tw) / 2, y), line, font=fnt, fill=color)
            y += lh
        y += gap
    return img

def card_intro(no, title, copy_text):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 8], fill=BRAND)
    d.text((100, 90), "Que 하나씩 배우기", font=F_LABEL, fill=SUB)
    d.text((100, 130), f"#{no:02d}", font=font(120, bold=True), fill=(38, 42, 52))
    return draw_center(img, [
        (title, F_TITLE, TEXT, 28),
        (copy_text, F_COPY, BRAND, 0),
    ], y_start=340)

def card_section(label, label_color, text):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([80, 80, 80 + d.textlength(label, font=F_LABEL) + 48, 136], 12, fill=CARD)
    d.text((104, 94), label, font=F_LABEL, fill=label_color)
    return draw_center(img, [(text, F_BODY, TEXT, 0)])

def card_outro():
    img = Image.new("RGB", (W, H), BG)
    return draw_center(img, [
        ("Que", font(96, bold=True), TEXT, 20),
        ("감시하지 않고, 병목을 드러낸다", F_COPY, SUB, 36),
        ("que.griff.co.kr", F_URL, BRAND, 0),
    ])

def frame_with_subtitle(src_path, subtitle):
    img = Image.new("RGB", (W, H), BG)
    src = Image.open(src_path).convert("RGB")
    box_h = H - 130
    ratio = min(W / src.width, box_h / src.height)
    nw, nh = int(src.width * ratio), int(src.height * ratio)
    src = src.resize((nw, nh), Image.LANCZOS)
    img.paste(src, ((W - nw) // 2, (box_h - nh) // 2))
    d = ImageDraw.Draw(img)
    d.rectangle([0, H - 118, W, H], fill=(10, 11, 14))
    lines = wrap(d, subtitle, F_SUB, W - 200)[:2]
    y = H - 104 if len(lines) > 1 else H - 84
    for line in lines:
        tw = d.textlength(line, font=F_SUB)
        d.text(((W - tw) / 2, y), line, font=F_SUB, fill=TEXT)
        y += 42
    return img

GEMINI_KEY = None
for line in open("/Users/griff_hq/Desktop/que/data/.env"):
    if line.startswith("GEMINI_API_KEY="):
        GEMINI_KEY = line.strip().split("=", 1)[1]

def _tts_gemini(text, out_m4a):
    """Gemini 2.5 TTS(Aoede) → 24kHz PCM → m4a. 429는 백오프 재시도."""
    import base64, json as _json, time, urllib.request, urllib.error
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={GEMINI_KEY}"
    body = _json.dumps({
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {"responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Aoede"}}}},
    }).encode()
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as r:
                d = _json.load(r)
            part = d["candidates"][0]["content"]["parts"][0]
            if "inlineData" not in part:  # 간헐적 무오디오 응답 — 재시도 대상
                if attempt < 3:
                    time.sleep(3)
                    continue
                return False
            pcm = base64.b64decode(part["inlineData"]["data"])
            raw = out_m4a.replace(".m4a", ".pcm")
            open(raw, "wb").write(pcm)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1",
                            "-i", raw, "-ar", "44100", "-ac", "1", "-c:a", "aac", "-b:a", "128k", out_m4a], check=True)
            os.remove(raw)
            time.sleep(0.5)  # RPM 여유
            return True
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:
                time.sleep(15 * (attempt + 1))
                continue
            print(f"  gemini-tts HTTP {e.code} — Yuna 폴백")
            return False
        except KeyError:
            # candidates/parts 자체가 없는 간헐 응답(안전필터·빈 응답) — 재시도
            if attempt < 3:
                time.sleep(3)
                continue
            print("  gemini-tts 빈 응답 4회 — Yuna 폴백")
            return False
        except Exception as e:
            print(f"  gemini-tts {type(e).__name__} — Yuna 폴백")
            return False
    return False

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tts-cache")
os.makedirs(CACHE_DIR, exist_ok=True)

def tts(text, out_m4a):
    """내레이션 TTS → m4a. Gemini Aoede 우선(사용자 지정), 실패 시 macOS Yuna 폴백. 길이(초) 반환.
    텍스트 md5로 캐시해 재렌더 시 API 재호출(429)을 피한다."""
    import hashlib, shutil
    key = hashlib.md5(text.encode()).hexdigest()
    cached = os.path.join(CACHE_DIR, key + ".m4a")
    if os.path.exists(cached):
        shutil.copy(cached, out_m4a)
    elif GEMINI_KEY and _tts_gemini(text, out_m4a):
        shutil.copy(out_m4a, cached)
    else:
        aiff = out_m4a.replace(".m4a", ".aiff")
        subprocess.run(["say", "-v", "Yuna", "-o", aiff, text], check=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", aiff, "-ar", "44100", "-ac", "1", "-c:a", "aac", "-b:a", "128k", out_m4a], check=True)
        os.remove(aiff)
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=noprint_wrappers=1:nokey=1", out_m4a], capture_output=True, text=True)
    return float(out.stdout.strip())

def build(spec):
    slug = spec["slug"]
    work = tempfile.mkdtemp(prefix=f"short-{slug}-")
    segs = []  # (png_path, duration, narration_text|None)

    segs.append((os.path.join(work, "00-intro.png"), 2.8, f"{spec['title']}."))
    card_intro(spec["no"], spec["title"], spec["copy"]).save(segs[-1][0])

    segs.append((os.path.join(work, "01-why.png"), None, spec["why"]))
    card_section("왜 필요한가", (242, 109, 109), spec["why"]).save(segs[-1][0])

    for i, (frame, subtitle) in enumerate(spec["screens"]):
        p = os.path.join(work, f"10-scr-{i:02d}.png")
        frame_with_subtitle(frame, subtitle).save(p)
        segs.append((p, None, subtitle))

    segs.append((os.path.join(work, "90-effect.png"), None, spec["effect"]))
    card_section("잘 쓰면", ACCENT, spec["effect"]).save(segs[-1][0])

    segs.append((os.path.join(work, "99-outro.png"), 2.6, None))
    card_outro().save(segs[-1][0])

    # TTS — 섹션별 오디오. 이미지 duration = max(음성 + 0.5s, 기본)
    use_tts = spec.get("tts", True)
    audio_parts, final = [], []
    for i, (png, dur, narration) in enumerate(segs):
        if use_tts and narration:
            m4a = png.replace(".png", ".m4a")
            alen = tts(narration, m4a)
            d = max(alen + 0.5, dur or 0, 2.2)
            audio_parts.append((m4a, alen, d))
        else:
            d = dur or 3.0
            audio_parts.append((None, 0, d))
        final.append((png, d))

    total = sum(d for _, d in final)
    # concat 목록(이미지)
    concat_txt = os.path.join(work, "concat.txt")
    with open(concat_txt, "w") as f:
        for png, d in final:
            f.write(f"file '{png}'\nduration {d:.3f}\n")
        f.write(f"file '{final[-1][0]}'\n")

    out = spec["out"]
    if use_tts:
        # 오디오 트랙: 각 세그먼트 길이에 맞춰 무음 패딩 후 concat
        alist = os.path.join(work, "alist.txt")
        with open(alist, "w") as f:
            for i, (m4a, alen, d) in enumerate(audio_parts):
                padded = os.path.join(work, f"a{i:02d}.m4a")
                if m4a:
                    # apad 후 -t로 길이를 정확히 고정 — aac 인코딩 오차가 누적되면 아웃트로가 잘린다
                    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", m4a,
                                    "-af", "apad", "-t", f"{d:.3f}", "-ar", "44100", "-ac", "1",
                                    "-c:a", "aac", "-b:a", "128k", padded], check=True)
                else:
                    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi",
                                    "-i", "anullsrc=r=44100:cl=mono", "-t", f"{d:.3f}",
                                    "-c:a", "aac", "-b:a", "128k", padded], check=True)
                f.write(f"file '{padded}'\n")
        audio_all = os.path.join(work, "audio.m4a")
        # concat 시점에 total까지 무음 패딩을 확정한다(재인코딩) — mux 단계 apad는 신뢰 불가(실측 드리프트).
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                        "-i", alist, "-af", "apad", "-t", f"{total:.3f}",
                        "-c:a", "aac", "-b:a", "128k", audio_all], check=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                        "-i", concat_txt, "-i", audio_all,
                        "-c:v", "libx264", "-r", "30", "-pix_fmt", "yuv420p", "-c:a", "copy",
                        "-t", f"{total:.3f}", out], check=True)
    else:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                        "-i", concat_txt, "-c:v", "libx264", "-r", "30", "-pix_fmt", "yuv420p", out], check=True)
    print(f"{slug}: {out} ({total:.0f}s)")

if __name__ == "__main__":
    with open(sys.argv[1]) as f:
        spec = json.load(f)
    build(spec)
