import os
import io
import logging
import PyPDF2
import docx
import speech_recognition as sr
from backend.ports.interfaces import InputExtractor

logger = logging.getLogger("jarvis.infra.input")


class FileInputExtractor(InputExtractor):
    _HANDLERS = {}

    @classmethod
    def _register(cls, ext: str):
        def decorator(func):
            cls._HANDLERS[ext] = func
            return func
        return decorator

    async def extract(self, content: bytes, filename: str) -> str:
        ext = os.path.splitext(filename)[1].lower()
        handler = self._HANDLERS.get(ext)
        if not handler:
            logger.error("  INPUT ▸ Unsupported format: %s (file: %s)", ext, filename)
            raise ValueError(f"Unsupported format: {ext}")
        logger.info(
            "\n╔══ INPUT ▸ FILE EXTRACT ══════════════════════════════════\n"
            "║  Filename : %s\n"
            "║  Format   : %s\n"
            "║  Size     : %d bytes\n"
            "╚══════════════════════════════════════════════════════════\n",
            filename, ext, len(content),
        )
        result = handler(content)
        logger.info("  INPUT ▸ Extracted %d chars from '%s'", len(result), filename)
        return result


class TextInputExtractor(InputExtractor):
    async def extract(self, content: bytes, filename: str) -> str:
        text = content.decode("utf-8").strip()
        logger.info(
            "\n╔══ INPUT ▸ TEXT EXTRACT ══════════════════════════════════\n"
            "║  Filename : %s\n"
            "║  Size     : %d bytes → %d chars\n"
            "╚══════════════════════════════════════════════════════════\n",
            filename, len(content), len(text),
        )
        return text


@FileInputExtractor._register(".txt")
def _txt(content: bytes) -> str:
    return content.decode("utf-8")


@FileInputExtractor._register(".pdf")
def _pdf(content: bytes) -> str:
    reader = PyPDF2.PdfReader(io.BytesIO(content))
    return "".join(page.extract_text() or "" for page in reader.pages)


@FileInputExtractor._register(".docx")
def _docx(content: bytes) -> str:
    doc = docx.Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs)


@FileInputExtractor._register(".wav")
def _wav(content: bytes) -> str:
    return _transcribe(content)


@FileInputExtractor._register(".mp3")
def _mp3(content: bytes) -> str:
    return _transcribe(content)


def _transcribe(content: bytes) -> str:
    logger.info("  INPUT ▸ Transcribing audio (%d bytes)…", len(content))
    recognizer = sr.Recognizer()
    with sr.AudioFile(io.BytesIO(content)) as source:
        audio = recognizer.record(source)
    text = recognizer.recognize_google(audio)
    logger.info("  INPUT ▸ Transcription complete: %d chars", len(text))
    return text
