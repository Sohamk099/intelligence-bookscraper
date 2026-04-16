"""
BookScraper
───────────
Scrapes book data from books.toscrape.com (or any compatible site) using
requests + BeautifulSoup with an optional Selenium fallback for JS-heavy pages.

Rating conversion map  (words → numbers):
  One → 1, Two → 2, Three → 3, Four → 4, Five → 5
"""

import logging
import time
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Word-to-number map for books.toscrape.com star ratings
RATING_MAP = {
    "one": 1.0, "two": 2.0, "three": 3.0,
    "four": 4.0, "five": 5.0,
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


class BookScraper:
    """
    Scrapes books from books.toscrape.com.

    Usage:
        scraper = BookScraper()
        books = scraper.scrape(max_pages=5)
    """

    def __init__(self, delay: float = 0.5):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.delay = delay  # polite delay between requests

    # ─── Public API ──────────────────────────────────────────────────────────

    def scrape(
        self,
        url: str = "https://books.toscrape.com",
        max_pages: int = 3,
    ) -> list[dict]:
        """
        Scrape up to `max_pages` catalogue pages and return a list of
        book-data dicts ready to be passed to Book.objects.update_or_create().
        """
        all_books: list[dict] = []
        base_url = url.rstrip("/")
        catalogue_url = f"{base_url}/catalogue/page-1.html"

        for page_num in range(1, max_pages + 1):
            page_url = f"{base_url}/catalogue/page-{page_num}.html"
            logger.info("Scraping page %d: %s", page_num, page_url)

            soup = self._get_soup(page_url)
            if soup is None:
                logger.warning("Failed to fetch page %d — stopping.", page_num)
                break

            book_cards = soup.select("article.product_pod")
            if not book_cards:
                logger.info("No books found on page %d — stopping.", page_num)
                break

            for card in book_cards:
                book_data = self._parse_card(card, base_url)
                if book_data:
                    # Fetch detail page for description
                    detail = self._scrape_detail(book_data["book_url"])
                    book_data.update(detail)
                    all_books.append(book_data)
                    time.sleep(self.delay)

        logger.info("Scraping complete. Total books collected: %d", len(all_books))
        return all_books

    # ─── Internal helpers ─────────────────────────────────────────────────────

    def _get_soup(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch URL and return BeautifulSoup, or None on failure."""
        try:
            resp = self.session.get(url, timeout=10)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as e:
            logger.error("Request failed for %s: %s", url, e)
            return None

    def _parse_card(self, card, base_url: str) -> Optional[dict]:
        """Parse a single book card <article> from a catalogue page."""
        try:
            # Title
            title_tag = card.select_one("h3 a")
            title = title_tag["title"] if title_tag else "Unknown"

            # Relative URL → absolute
            relative_href = title_tag["href"] if title_tag else ""
            book_url = urljoin(f"{base_url}/catalogue/", relative_href)

            # Rating (CSS class 'One', 'Two' … 'Five')
            rating_tag = card.select_one("p.star-rating")
            rating_class = rating_tag["class"][1].lower() if rating_tag else "zero"
            rating = RATING_MAP.get(rating_class, 0.0)

            # Price
            price_tag = card.select_one("p.price_color")
            price = price_tag.get_text(strip=True) if price_tag else ""

            # Cover image
            img_tag = card.select_one("img")
            cover_url = ""
            if img_tag:
                cover_relative = img_tag.get("src", "").replace("../../", "")
                cover_url = f"{base_url}/{cover_relative}"

            return {
                "title": title,
                "book_url": book_url,
                "rating": rating,
                "price": price,
                "cover_image_url": cover_url,
                "author": "Unknown",  # catalogue page doesn't show author
                "reviews": 0,
            }
        except Exception as e:
            logger.warning("Failed to parse card: %s", e)
            return None

    def _scrape_detail(self, book_url: str) -> dict:
        """Fetch the book detail page and extract description + metadata."""
        soup = self._get_soup(book_url)
        if soup is None:
            return {}

        result: dict = {}

        # Description
        desc_tag = soup.select_one("#product_description ~ p")
        result["description"] = desc_tag.get_text(strip=True) if desc_tag else ""

        # UPC / availability / author from product table
        table = soup.select("table.table-striped tr")
        for row in table:
            header = row.select_one("th")
            value = row.select_one("td")
            if not header or not value:
                continue
            key = header.get_text(strip=True).lower()
            val = value.get_text(strip=True)
            if key == "availability":
                result["availability"] = val
            if key == "number of reviews":
                try:
                    result["reviews"] = int(val)
                except ValueError:
                    pass

        # Genre / breadcrumb
        breadcrumb = soup.select("ul.breadcrumb li")
        if len(breadcrumb) >= 3:
            result["genre"] = breadcrumb[-2].get_text(strip=True)

        return result


# ─── Optional Selenium scraper ────────────────────────────────────────────────

class SeleniumBookScraper(BookScraper):
    """
    Subclass that uses Selenium for JavaScript-rendered pages.
    Falls back to requests for static pages.
    Requires: pip install selenium webdriver-manager
    """

    def _get_soup(self, url: str) -> Optional[BeautifulSoup]:
        """Try requests first; fall back to Selenium on failure or JS guard."""
        soup = super()._get_soup(url)
        if soup:
            return soup

        logger.info("Falling back to Selenium for %s", url)
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.chrome.service import Service
            from webdriver_manager.chrome import ChromeDriverManager

            options = Options()
            options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")

            driver = webdriver.Chrome(
                service=Service(ChromeDriverManager().install()),
                options=options,
            )
            driver.get(url)
            time.sleep(2)  # wait for JS to render
            html = driver.page_source
            driver.quit()
            return BeautifulSoup(html, "html.parser")
        except Exception as e:
            logger.error("Selenium scrape failed for %s: %s", url, e)
            return None
