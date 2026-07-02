import re
import math
import ipaddress
from urllib.parse import urlparse
import tldextract

from app.services.scraper import fetch_content_features


def _is_ip(hostname: str) -> bool:
    try:
        ipaddress.ip_address(hostname)
        return True
    except ValueError:
        return False


def _char_continuation_rate(text: str) -> float:
    """Maior sequência consecutiva do mesmo caractere dividida pelo tamanho da string."""
    if not text:
        return 0.0
    max_run = current_run = 1
    for i in range(1, len(text)):
        if text[i] == text[i - 1]:
            current_run += 1
            max_run = max(max_run, current_run)
        else:
            current_run = 1
    return max_run / len(text)


def _url_char_prob(url: str) -> float:
    """Entropia de Shannon dos caracteres da URL, normalizada para [0,1]."""
    if not url:
        return 0.0
    freq = {}
    for ch in url:
        freq[ch] = freq.get(ch, 0) + 1
    entropy = -sum((c / len(url)) * math.log2(c / len(url)) for c in freq.values())
    max_entropy = math.log2(len(url)) if len(url) > 1 else 1
    return entropy / max_entropy if max_entropy else 0.0


_OBFUSCATION_PATTERN = re.compile(r'%[0-9a-fA-F]{2}')


def extract_features(url: str) -> dict:
    """
    Extrai todas as features de uma URL seguindo o esquema do dataset PhiUSIIL.

    O processo ocorre em duas etapas:
    1. Features léxicas: calculadas diretamente da string da URL (tamanho, razão
       de dígitos/letras, obfuscação, entropia, contagem de caracteres especiais,
       presença de palavras-chave, etc.).
    2. Features de conteúdo: obtidas via requisição HTTP pela camada de scraping
       (scraper.py), que faz o fetch da página e extrai informações do HTML, como
       contagem de imagens/CSS/JS, presença de formulários, campos de senha,
       redirecionamentos, robots.txt, entre outros. Em caso de falha na requisição,
       essas features retornam 0 sem interromper o fluxo.

    O dicionário final é a união das duas etapas.
    """
    url = url.rstrip('/')
    parsed = urlparse(url)
    extracted = tldextract.extract(url)

    hostname = parsed.hostname or ""
    
    # Normalizar para http:// para calcular o comprimento e letras/dígitos
    normalized_url = url.replace("https://", "http://") if url.startswith("https://") else url

    # --- Features léxicas ---
    url_length = len(normalized_url)
    domain_length = len(hostname)
    is_domain_ip = int(_is_ip(hostname))
    is_https = int(url.startswith("https://"))

    subdomains = [s for s in extracted.subdomain.split(".") if s]
    no_of_subdomain = len(subdomains)

    total_letters = sum(c.isalpha() for c in normalized_url)
    if hostname.startswith("www."):
        no_of_letters_in_url = total_letters - 8
    else:
        no_of_letters_in_url = total_letters - 4

    no_of_degits_in_url = sum(c.isdigit() for c in normalized_url)
    degit_ratio_in_url = no_of_degits_in_url / url_length if url_length else 0.0
    letter_ratio_in_url = no_of_letters_in_url / url_length if url_length else 0.0

    non_alnum = sum(not c.isalnum() for c in normalized_url)
    no_of_other_special_chars_in_url = non_alnum - 3
    if hostname.startswith("www."):
        no_of_other_special_chars_in_url -= 1
    no_of_other_special_chars_in_url -= (normalized_url.count("=") + normalized_url.count("?") + normalized_url.count("&"))
    spacial_char_ratio_in_url = no_of_other_special_chars_in_url / url_length if url_length else 0.0

    obfuscated = _OBFUSCATION_PATTERN.findall(normalized_url)
    no_of_obfuscated_char = len(obfuscated)
    has_obfuscation = int(no_of_obfuscated_char > 0)
    obfuscation_ratio = no_of_obfuscated_char / url_length if url_length else 0.0

    char_continuation_rate = _char_continuation_rate(normalized_url)
    url_char_prob = _url_char_prob(normalized_url)

    no_of_dots = normalized_url.count(".")
    no_of_hyphens = normalized_url.count("-")
    no_of_underline = normalized_url.count("_")
    no_of_slash = normalized_url.count("/")
    no_of_question_mark = normalized_url.count("?")
    no_of_equal = normalized_url.count("=")
    no_of_at = normalized_url.count("@")
    no_of_dollar = normalized_url.count("$")
    no_of_exclamation = normalized_url.count("!")
    no_of_hash = normalized_url.count("#")
    no_of_percent = normalized_url.count("%")
    no_of_ampersand = normalized_url.count("&")

    # Presença de palavras-chave
    bank = int("bank" in normalized_url.lower())
    pay = int("pay" in normalized_url.lower())
    crypto = int(
        any(k in normalized_url.lower() for k in ("crypto", "bitcoin", "eth", "wallet"))
    )

    lexical = {
        # Léxicas
        "URLLength": url_length,
        "DomainLength": domain_length,
        "IsDomainIP": is_domain_ip,
        "IsHTTPS": is_https,
        "NoOfSubDomain": no_of_subdomain,
        "NoOfLettersInURL": no_of_letters_in_url,
        "LetterRatioInURL": letter_ratio_in_url,
        "NoOfDegitsInURL": no_of_degits_in_url,
        "DegitRatioInURL": degit_ratio_in_url,
        "NoOfOtherSpecialCharsInURL": no_of_other_special_chars_in_url,
        "SpacialCharRatioInURL": spacial_char_ratio_in_url,
        "HasObfuscation": has_obfuscation,
        "NoOfObfuscatedChar": no_of_obfuscated_char,
        "ObfuscationRatio": obfuscation_ratio,
        "CharContinuationRate": char_continuation_rate,
        "URLCharProb": url_char_prob,
        "NoOfDots": no_of_dots,
        "NoOfHyphens": no_of_hyphens,
        "NoOfUnderline": no_of_underline,
        "NoOfSlash": no_of_slash,
        "NoOfQMarkInURL": no_of_question_mark,
        "NoOfEqual": no_of_equal,
        "NoOfAtInURL": no_of_at,
        "NoOfDollarInURL": no_of_dollar,
        "NoOfExclamationInURL": no_of_exclamation,
        "NoOfHashInURL": no_of_hash,
        "NoOfPercentInURL": no_of_percent,
        "NoOfAmpersandInURL": no_of_ampersand,
        "Bank": bank,
        "Pay": pay,
        "Crypto": crypto,
    }

    content = fetch_content_features(url)

    return {**lexical, **content}

