import os
import random
import time

from citation_data import build_outputs, validate_output_files, write_outputs


def setup_free_proxies(scholar_client, proxy_factory):
    """Use direct requests when optional free-proxy setup is unavailable."""
    try:
        proxy = proxy_factory()
        if proxy.FreeProxies(timeout=3, wait_time=60):
            scholar_client.use_proxy(proxy)
            print("[proxy] Free proxies enabled")
            return True
    except Exception as error:
        print(f"[proxy] Setup failed ({type(error).__name__}); using direct requests")
        return False
    print("[proxy] No free proxies available; using direct requests")
    return False


def fetch_author_with_retry(scholar_client, scholar_id, pub_limit, attempts=5):
    for attempt in range(1, attempts + 1):
        try:
            author = scholar_client.search_author_id(scholar_id)
            return scholar_client.fill(
                author,
                sections=["basics", "indices", "counts", "publications"],
                publication_limit=pub_limit,
            )
        except Exception as error:
            print(f"[retry] Attempt {attempt}/{attempts} failed: {type(error).__name__}")
            if attempt == attempts:
                raise
            time.sleep(min(90, 2 ** attempt) + random.uniform(0, 2))


def run(scholar_client, proxy_factory, scholar_id, pub_limit, results_dir="results"):
    setup_free_proxies(scholar_client, proxy_factory)
    author = fetch_author_with_retry(scholar_client, scholar_id, pub_limit)
    outputs = build_outputs(author, scholar_id)
    write_outputs(results_dir, outputs)
    validate_output_files(results_dir, scholar_id)
    print(f"[results] Validated fresh citation data at {outputs['gs_data.json']['updated']}")


def main():
    scholar_id = os.getenv("GOOGLE_SCHOLAR_ID", "").strip()
    if not scholar_id:
        raise ValueError("GOOGLE_SCHOLAR_ID must be configured")
    pub_limit = int(os.getenv("PUBLICATION_LIMIT", "1000"))
    if pub_limit <= 0:
        raise ValueError("PUBLICATION_LIMIT must be positive")

    # Offline tests and output validation do not need the network dependency.
    from scholarly import ProxyGenerator, scholarly

    run(scholarly, ProxyGenerator, scholar_id, pub_limit)


if __name__ == "__main__":
    main()
