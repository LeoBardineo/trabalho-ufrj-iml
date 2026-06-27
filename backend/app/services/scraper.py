import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

_SOCIAL_NETWORKS = {
    "facebook.com", "twitter.com", "x.com", "instagram.com",
    "linkedin.com", "youtube.com", "tiktok.com", "pinterest.com",
}

_FALLBACK: dict = {
    "LineOfCode": 0,
    "LargestLineLength": 0,
    "HasTitle": 0,
    "DomainTitleMatchScore": 0.0,
    "URLTitleMatchScore": 0.0,
    "HasFavicon": 0,
    "Robots": 0,
    "IsResponsive": 0,
    "NoOfURLRedirect": 0,
    "NoOfSelfRedirect": 0,
    "HasDescription": 0,
    "NoOfPopup": 0,
    "NoOfiFrame": 0,
    "HasExternalFormSubmit": 0,
    "HasSocialNet": 0,
    "HasSubmitButton": 0,
    "HasHiddenFields": 0,
    "HasPasswordField": 0,
    "HasCopyrightInfo": 0,
    "NoOfImage": 0,
    "NoOfCSS": 0,
    "NoOfJS": 0,
    "NoOfSelfRef": 0,
    "NoOfEmptyRef": 0,
    "NoOfExternalRef": 0,
}


def _jaccard(set_a: set, set_b: set) -> float:
    union = set_a | set_b
    return len(set_a & set_b) / len(union) if union else 0.0


def _tokenize(text: str) -> set:
    return set(re.split(r"[\W_]+", text.lower())) - {""}


def fetch_content_features(url: str) -> dict:
    """Faz requisição HTTP e extrai features baseadas no conteúdo da página."""
    parsed = urlparse(url)
    domain = parsed.netloc

    try:
        with httpx.Client(follow_redirects=True, timeout=10) as client:
            response = client.get(url, headers={"User-Agent": "Mozilla/5.0"})
    except Exception:
        return _FALLBACK.copy()

    html = response.text
    lines = html.splitlines()
    soup = BeautifulSoup(html, "html.parser")

    # Redirects
    no_of_url_redirect = len(response.history)
    no_of_self_redirect = sum(
        1 for r in response.history
        if urlparse(r.headers.get("location", "")).netloc == domain
    )

    # Estatísticas de linhas
    line_of_code = len(lines)
    largest_line_length = max((len(l) for l in lines), default=0)

    # Título
    title_tag = soup.find("title")
    has_title = int(title_tag is not None)
    title_text = title_tag.get_text() if title_tag else ""

    domain_words = _tokenize(domain) - {"www", "com", "net", "org"}
    url_words = _tokenize(url) - {"https", "http", "www"}
    title_words = _tokenize(title_text)

    domain_title_match_score = _jaccard(domain_words, title_words)
    url_title_match_score = _jaccard(url_words, title_words)

    # Favicon
    has_favicon = int(bool(
        soup.find("link", rel=lambda r: isinstance(r, list) and "icon" in r or r == "icon")
    ))

    # Meta description
    has_description = int(bool(soup.find("meta", attrs={"name": "description"})))

    # Responsividade
    is_responsive = int(bool(soup.find("meta", attrs={"name": "viewport"})))

    # Popups via window.open em scripts inline
    scripts = soup.find_all("script")
    no_of_popup = sum(
        1 for s in scripts if s.string and "window.open" in s.string
    )

    # iFrames
    no_of_iframe = len(soup.find_all("iframe"))

    # Formulários com action externo
    forms = soup.find_all("form")
    has_external_form_submit = int(any(
        f.get("action", "").startswith("http") and domain not in f.get("action", "")
        for f in forms
    ))

    # Botão de submit
    has_submit_button = int(bool(
        soup.find("input", {"type": "submit"}) or
        soup.find("button", {"type": "submit"})
    ))

    # Campos ocultos e de senha
    has_hidden_fields = int(bool(soup.find("input", {"type": "hidden"})))
    has_password_field = int(bool(soup.find("input", {"type": "password"})))

    # Links
    all_links = soup.find_all("a", href=True)
    has_social_net = int(any(
        any(sn in a["href"] for sn in _SOCIAL_NETWORKS)
        for a in all_links
    ))

    no_of_self_ref = no_of_empty_ref = no_of_external_ref = 0
    for a in all_links:
        href = a["href"].strip()
        if not href or href == "#":
            no_of_empty_ref += 1
        elif href.startswith("http") and domain not in href:
            no_of_external_ref += 1
        else:
            no_of_self_ref += 1

    # Copyright
    body_text = soup.get_text().lower()
    has_copyright_info = int("©" in body_text or "copyright" in body_text)

    # Recursos estáticos
    no_of_image = len(soup.find_all("img"))
    no_of_css = len(soup.find_all("link", rel=lambda r: isinstance(r, list) and "stylesheet" in r or r == "stylesheet"))
    no_of_js = len(soup.find_all("script"))

    # robots.txt
    try:
        robots_url = f"{parsed.scheme}://{domain}/robots.txt"
        robots_resp = httpx.get(robots_url, timeout=5)
        robots = int(robots_resp.status_code == 200)
    except Exception:
        robots = 0

    return {
        "LineOfCode": line_of_code,
        "LargestLineLength": largest_line_length,
        "HasTitle": has_title,
        "DomainTitleMatchScore": domain_title_match_score,
        "URLTitleMatchScore": url_title_match_score,
        "HasFavicon": has_favicon,
        "Robots": robots,
        "IsResponsive": is_responsive,
        "NoOfURLRedirect": no_of_url_redirect,
        "NoOfSelfRedirect": no_of_self_redirect,
        "HasDescription": has_description,
        "NoOfPopup": no_of_popup,
        "NoOfiFrame": no_of_iframe,
        "HasExternalFormSubmit": has_external_form_submit,
        "HasSocialNet": has_social_net,
        "HasSubmitButton": has_submit_button,
        "HasHiddenFields": has_hidden_fields,
        "HasPasswordField": has_password_field,
        "HasCopyrightInfo": has_copyright_info,
        "NoOfImage": no_of_image,
        "NoOfCSS": no_of_css,
        "NoOfJS": no_of_js,
        "NoOfSelfRef": no_of_self_ref,
        "NoOfEmptyRef": no_of_empty_ref,
        "NoOfExternalRef": no_of_external_ref,
    }
