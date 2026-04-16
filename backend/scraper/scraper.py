import logging
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


logger = logging.getLogger(__name__)

RATING_MAP = {"one": 1.0, "two": 2.0, "three": 3.0, "four": 4.0, "five": 5.0}
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


class BookScraper:
    def __init__(self, delay=0.3):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.delay = delay

    def scrape(self, url="https://books.toscrape.com", max_pages=3):
        all_books = []
        base_url = url.rstrip("/")

        for page_num in range(1, max_pages + 1):
            page_url = f"{base_url}/catalogue/page-{page_num}.html"
            soup = self._get_soup(page_url)
            if soup is None:
                break

            book_cards = soup.select("article.product_pod")
            if not book_cards:
                break

            for card in book_cards:
                book_data = self._parse_card(card, base_url)
                if not book_data:
                    continue
                detail = self._scrape_detail(book_data["book_url"])
                book_data.update(detail)
                all_books.append(book_data)
                time.sleep(self.delay)

        return all_books

    def _get_soup(self, url):
        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            return BeautifulSoup(response.text, "html.parser")
        except requests.RequestException as exc:
            logger.error("Request failed for %s: %s", url, exc)
            return None

    def _parse_card(self, card, base_url):
        try:
            title_tag = card.select_one("h3 a")
            title = title_tag["title"] if title_tag else "Unknown"
            relative_href = title_tag["href"] if title_tag else ""
            book_url = urljoin(f"{base_url}/catalogue/", relative_href)

            rating_tag = card.select_one("p.star-rating")
            rating_class = rating_tag["class"][1].lower() if rating_tag and len(rating_tag["class"]) > 1 else "zero"
            rating = RATING_MAP.get(rating_class, 0.0)

            price_tag = card.select_one("p.price_color")
            price = price_tag.get_text(strip=True) if price_tag else ""

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
                "author": "Unknown",
                "reviews": 0,
            }
        except Exception as exc:
            logger.warning("Failed to parse card: %s", exc)
            return None

    def _scrape_detail(self, book_url):
        soup = self._get_soup(book_url)
        if soup is None:
            return {}

        result = {}
        description_tag = soup.select_one("#product_description ~ p")
        result["description"] = description_tag.get_text(strip=True) if description_tag else ""

        for row in soup.select("table.table-striped tr"):
            header = row.select_one("th")
            value = row.select_one("td")
            if not header or not value:
                continue
            key = header.get_text(strip=True).lower()
            cell_value = value.get_text(strip=True)
            if key == "availability":
                result["availability"] = cell_value
            elif key == "number of reviews":
                try:
                    result["reviews"] = int(cell_value)
                except ValueError:
                    result["reviews"] = 0

        breadcrumb = soup.select("ul.breadcrumb li")
        if len(breadcrumb) >= 3:
            result["genre"] = breadcrumb[-2].get_text(strip=True)

        return result
