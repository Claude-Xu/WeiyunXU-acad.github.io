from scholarly import scholarly, ProxyGenerator
from scholarly._proxy_generator import MaxTriesExceededException
import os, json, time, random
from datetime import datetime

def setup_free_proxies():
    pg = ProxyGenerator()
    ok = pg.FreeProxies(timeout=3, wait_time=60)  # timeout 可调 2~5；wait_time 建议 60+
    print(f"[proxy] FreeProxies enabled: {ok}")
    if ok:
        scholarly.use_proxy(pg)
    return ok

def fetch_author_with_retry(scholar_id: str, pub_limit: int):
    last = None
    for attempt in range(1, 6):
        try:
            author = scholarly.search_author_id(scholar_id)
            author = scholarly.fill(
                author,
                sections=["basics", "indices", "counts", "publications"],
                publication_limit=pub_limit,
            )
            return author
        except MaxTriesExceededException as e:
            last = e
        except Exception as e:
            last = e

        sleep_s = min(90, 2 ** attempt) + random.uniform(0, 2)
        print(f"[retry] attempt {attempt} failed: {type(last).__name__}: {last}")
        print(f"[retry] sleep {sleep_s:.1f}s")
        time.sleep(sleep_s)

    raise last

def main():
    os.makedirs("results", exist_ok=True)
    setup_free_proxies()

    scholar_id = os.environ["GOOGLE_SCHOLAR_ID"]
    pub_limit = int(os.getenv("PUBLICATION_LIMIT", "1000"))

    author = fetch_author_with_retry(scholar_id, pub_limit)
    author["updated"] = str(datetime.now())

    # 输出：总引用 + 每篇引用（通常 publication 里有 num_citations / citedby）
    pubs_for_web = []
    for p in author.get("publications", []):
        cited = p.get("num_citations", p.get("citedby", 0))
        bib = p.get("bib", {}) or {}
        pubs_for_web.append({
            "title": bib.get("title"),
            "year": bib.get("pub_year") or bib.get("year"),
            "citations": cited,
            "author_pub_id": p.get("author_pub_id"),
        })

    with open("results/gs_data.json", "w", encoding="utf-8") as f:
        json.dump(author, f, ensure_ascii=False)

    with open("results/gs_publications.json", "w", encoding="utf-8") as f:
        json.dump({
            "updated": author["updated"],
            "total_citations": author.get("citedby", 0),
            "publications": pubs_for_web,
        }, f, ensure_ascii=False)

    with open("results/gs_data_shieldsio.json", "w", encoding="utf-8") as f:
        json.dump({
            "schemaVersion": 1,
            "label": "citations",
            "message": f"{author.get('citedby', 0)}",
        }, f, ensure_ascii=False)

if __name__ == "__main__":
    main()
