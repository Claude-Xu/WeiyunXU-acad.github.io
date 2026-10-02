"""Validate the website's citation contract and replace JSON files atomically."""

import argparse
import copy
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile


OUTPUT_NAMES = ("gs_data.json", "gs_publications.json", "gs_data_shieldsio.json")


def citation_count(value, field):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{field} must be a nonnegative integer")
    return value


def normalize_publications(publications, scholar_id):
    if isinstance(publications, list):
        entries = ((None, publication) for publication in publications)
    elif isinstance(publications, dict):
        entries = publications.items()
    else:
        raise ValueError("publications must be a list or an ID dictionary")

    normalized = {}
    for key, publication in entries:
        if not isinstance(publication, dict):
            raise ValueError("Every publication must be an object")
        paper = copy.deepcopy(publication)
        paper_id = paper.get("author_pub_id", key)
        if not isinstance(paper_id, str) or not paper_id.startswith(scholar_id + ":"):
            raise ValueError("Every publication must have an ID belonging to this author")
        if not paper_id.partition(":")[2] or (key is not None and key != paper_id):
            raise ValueError("Publication ID and dictionary key must agree")
        if paper_id in normalized:
            raise ValueError("Duplicate publication IDs are not allowed")
        bib = paper.get("bib")
        if not isinstance(bib, dict) or not isinstance(bib.get("title"), str) or not bib["title"].strip():
            raise ValueError("Every publication must have a title")
        paper["author_pub_id"] = paper_id
        paper["num_citations"] = citation_count(
            paper.get("num_citations", paper.get("citedby")), "Publication citations"
        )
        normalized[paper_id] = paper
    return normalized


def build_outputs(author, scholar_id, updated=None):
    if not isinstance(author, dict):
        raise ValueError("Author response must be an object")
    if not isinstance(scholar_id, str) or not scholar_id.strip():
        raise ValueError("A Scholar author ID is required")
    if author.get("scholar_id") != scholar_id:
        raise ValueError("The fetched author does not match the requested Scholar ID")
    if not isinstance(author.get("name"), str) or not author["name"].strip():
        raise ValueError("Author response must contain a name")
    total = citation_count(author.get("citedby"), "Total citations")
    publications = normalize_publications(author.get("publications"), scholar_id)
    if total and not publications:
        raise ValueError("A cited author must have fetched publications")

    if updated is None:
        updated = datetime.now(timezone.utc).isoformat(timespec="seconds")
    timestamp = datetime.fromisoformat(updated)
    if timestamp.tzinfo is None:
        raise ValueError("The update timestamp must include its timezone")
    data = copy.deepcopy(author)
    data["updated"] = updated
    # The website looks up num_citations using each author_pub_id as a key.
    data["publications"] = publications
    summary = [
        {
            "title": paper["bib"]["title"],
            "year": paper["bib"].get("pub_year") or paper["bib"].get("year"),
            "citations": paper["num_citations"],
            "author_pub_id": paper_id,
        }
        for paper_id, paper in publications.items()
    ]
    return {
        "gs_data.json": data,
        "gs_publications.json": {
            "updated": updated,
            "total_citations": total,
            "publications": summary,
        },
        "gs_data_shieldsio.json": {
            "schemaVersion": 1,
            "label": "citations",
            "message": str(total),
        },
    }


def write_outputs(results_dir, outputs):
    if set(outputs) != set(OUTPUT_NAMES):
        raise ValueError("Exactly the three citation output files are required")
    # Serialize the whole batch first. A malformed result cannot overwrite old data.
    serialized = {
        name: json.dumps(outputs[name], ensure_ascii=False, allow_nan=False) + "\n"
        for name in OUTPUT_NAMES
    }
    directory = Path(results_dir)
    directory.mkdir(parents=True, exist_ok=True)
    pending = {}
    try:
        for name, content in serialized.items():
            with NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=directory, prefix=".citation-", delete=False
            ) as temporary:
                pending[name] = Path(temporary.name)
                temporary.write(content)
                temporary.flush()
                os.fsync(temporary.fileno())
        # Each replacement is atomic; the workflow publishes only after the entire
        # batch succeeds and all three files pass a separate consistency check.
        for name, temporary in pending.items():
            os.replace(temporary, directory / name)
    finally:
        for temporary in pending.values():
            temporary.unlink(missing_ok=True)


def validate_output_files(results_dir, scholar_id):
    directory = Path(results_dir)
    outputs = {
        name: json.loads((directory / name).read_text(encoding="utf-8"))
        for name in OUTPUT_NAMES
    }
    data = outputs["gs_data.json"]
    if not isinstance(data, dict) or not isinstance(data.get("publications"), dict):
        raise ValueError("gs_data.json must preserve the publication ID dictionary")
    if not isinstance(data.get("updated"), str):
        raise ValueError("Citation data must contain its update timestamp")
    expected = build_outputs(data, scholar_id, updated=data["updated"])
    if outputs != expected:
        raise ValueError("Citation output files are inconsistent")
    return outputs


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate generated citation JSON before publishing")
    parser.add_argument("results_dir", nargs="?", default="results")
    arguments = parser.parse_args()
    validate_output_files(arguments.results_dir, os.getenv("GOOGLE_SCHOLAR_ID", "").strip())
    print("Validated all three citation output files")
