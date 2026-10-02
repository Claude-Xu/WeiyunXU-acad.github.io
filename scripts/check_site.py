"""Check the built Pages site: python scripts/check_site.py [site-directory]."""
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "_site"
BASE = "/WeiyunXU-acad.github.io"
HOME = "https://claude-xu.github.io" + BASE + "/"


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags = []

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


errors = []


def check(condition, message):
    if not condition:
        errors.append(message)


def local_path(url, parent):
    parts = urlsplit(url)
    if parts.scheme or parts.netloc or not parts.path:
        return None
    path = unquote(parts.path)
    if path.startswith(BASE + "/"):
        return SITE / path[len(BASE) + 1:]
    if path.startswith("/"):
        check(False, f"URL misses the project base path: {url}")
        return SITE / path.lstrip("/")
    return parent / path


index = SITE / "index.html"
if not index.is_file():
    raise SystemExit(f"Build the site first; missing {index}")
source = index.read_text(encoding="utf-8")
page = Page()
page.feed(source)
check(sum(tag == "head" for tag, _ in page.tags) == 1, "Expected one HTML head")
check(any(tag == "link" and attrs.get("rel") == "canonical" and
          attrs.get("href") == HOME for tag, attrs in page.tags), "Incorrect canonical URL")
check(any(tag == "meta" and attrs.get("property") == "og:url" and
          attrs.get("content") == HOME for tag, attrs in page.tags), "Incorrect Open Graph URL")
check(any(tag == "meta" and attrs.get("name") == "description" and
          attrs.get("content", "").strip() for tag, attrs in page.tags), "Missing meta description")
slides = [attrs for tag, attrs in page.tags if tag == "figure" and
          "wx-carousel__slide" in attrs.get("class", "").split()]
check(len(slides) == 8, f"Expected 8 carousel slides, found {len(slides)}")
check("PhD1." not in source and "PhD2." not in source, "Removed slides returned")

resource_count = 0
for tag, attrs in page.tags:
    url = attrs.get("src") if tag in ("img", "script", "source") else attrs.get("href")
    if url:
        path = local_path(url, SITE)
        if path is not None:
            resource_count += 1
            check(path.exists(), f"Missing local resource/link: {url}")
    if tag == "img" and attrs.get("src", "").startswith(BASE):
        check(all(attrs.get(key, "").isdigit() and int(attrs[key]) > 0
                  for key in ("width", "height")), f"Missing image dimensions: {attrs.get('src')}")

# Fragments are source-only; include_relative still renders them into index.html.
for name in ("_pages", "docs", "README.md", "run_server.sh", "scripts", "tests",
             "google_scholar_crawler", "Gemfile", "Gemfile.lock", "assets/js/vendor",
             "assets/js/plugins", "assets/js/_main.js"):
    check(not (SITE / name).exists(), f"Development/template content published: {name}")

sitemap = SITE / "sitemap.xml"
check(sitemap.is_file(), "Missing sitemap")
if sitemap.is_file():
    urls = [node.text for node in ET.parse(sitemap).iter() if node.tag.endswith("}loc")]
    check(HOME in urls, "Homepage missing from sitemap")
    for url in urls:
        check(url.startswith(HOME), f"Sitemap URL outside project: {url}")
        check("_pages" not in url and "/includes/" not in url, f"Template indexed: {url}")

manifest_path = SITE / "images/site.webmanifest"
check(manifest_path.is_file(), "Missing icon manifest")
if manifest_path.is_file():
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for icon in manifest.get("icons", []):
        path = local_path(icon["src"], manifest_path.parent)
        check(path is not None and path.is_file(), f"Missing manifest icon: {icon['src']}")

for stylesheet in (SITE / "assets/css").glob("*.css"):
    for url in re.findall(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)", stylesheet.read_text(encoding="utf-8")):
        path = local_path(url.strip(), stylesheet.parent)
        if path is not None:
            check(path.is_file(), f"Missing CSS asset in {stylesheet.name}: {url}")

if errors:
    raise SystemExit("Site checks failed:\n- " + "\n- ".join(errors))
print(f"Site checks passed: 8 slides, {resource_count} local links/resources, metadata, sitemap and icons.")
