import copy
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import citation_data
import main


SCHOLAR_ID = "testAuthorID"
UPDATED = "2026-10-01T08:00:00+00:00"


def author_fixture():
    return {
        "scholar_id": SCHOLAR_ID,
        "name": "Test Author",
        "citedby": 12,
        "publications": [
            {
                "author_pub_id": SCHOLAR_ID + ":paper1",
                "num_citations": 12,
                "bib": {"title": "测试 publication", "pub_year": "2025"},
            },
            {
                "author_pub_id": SCHOLAR_ID + ":paper2",
                "num_citations": 0,
                "bib": {"title": "An uncited publication"},
            },
        ],
    }


class CitationDataTests(unittest.TestCase):
    def test_list_response_preserves_website_dictionary_contract(self):
        author = author_fixture()
        outputs = citation_data.build_outputs(author, SCHOLAR_ID, UPDATED)
        publications = outputs["gs_data.json"]["publications"]
        self.assertEqual(publications[SCHOLAR_ID + ":paper1"]["num_citations"], 12)
        self.assertEqual(outputs["gs_publications.json"]["total_citations"], 12)
        self.assertEqual(outputs["gs_data_shieldsio.json"]["message"], "12")
        self.assertIsInstance(author["publications"], list)

    def test_existing_id_dictionary_is_supported(self):
        author = author_fixture()
        author["publications"] = {paper["author_pub_id"]: paper for paper in author["publications"]}
        outputs = citation_data.build_outputs(author, SCHOLAR_ID, UPDATED)
        self.assertEqual(outputs["gs_data.json"]["publications"], author["publications"])

    def test_rejects_wrong_author_and_duplicate_paper_ids(self):
        author = author_fixture()
        author["scholar_id"] = "anotherAuthor"
        with self.assertRaises(ValueError):
            citation_data.build_outputs(author, SCHOLAR_ID, UPDATED)
        author = author_fixture()
        author["publications"].append(copy.deepcopy(author["publications"][0]))
        with self.assertRaises(ValueError):
            citation_data.build_outputs(author, SCHOLAR_ID, UPDATED)

    def test_rejects_missing_or_invalid_counts_instead_of_fabricating_zero(self):
        for value in (None, -1, True, "12"):
            with self.subTest(value=value):
                author = author_fixture()
                author["citedby"] = value
                with self.assertRaises(ValueError):
                    citation_data.build_outputs(author, SCHOLAR_ID, UPDATED)
        author = author_fixture()
        del author["publications"][0]["num_citations"]
        with self.assertRaises(ValueError):
            citation_data.build_outputs(author, SCHOLAR_ID, UPDATED)

    def test_rejects_empty_partial_fetch_for_cited_author(self):
        author = author_fixture()
        author["publications"] = []
        with self.assertRaises(ValueError):
            citation_data.build_outputs(author, SCHOLAR_ID, UPDATED)

    def test_round_trip_and_atomic_file_replacements(self):
        outputs = citation_data.build_outputs(author_fixture(), SCHOLAR_ID, UPDATED)
        with tempfile.TemporaryDirectory() as temporary:
            with mock.patch("citation_data.os.replace", wraps=os.replace) as replace:
                citation_data.write_outputs(temporary, outputs)
            self.assertEqual(replace.call_count, 3)
            self.assertEqual(citation_data.validate_output_files(temporary, SCHOLAR_ID), outputs)
            self.assertEqual(set(path.name for path in Path(temporary).iterdir()), set(citation_data.OUTPUT_NAMES))
            self.assertIn("测试", (Path(temporary) / "gs_data.json").read_text(encoding="utf-8"))

    def test_serialization_failure_preserves_previous_files(self):
        outputs = citation_data.build_outputs(author_fixture(), SCHOLAR_ID, UPDATED)
        with tempfile.TemporaryDirectory() as temporary:
            citation_data.write_outputs(temporary, outputs)
            before = {name: (Path(temporary) / name).read_bytes() for name in citation_data.OUTPUT_NAMES}
            outputs["gs_publications.json"]["unexpected"] = object()
            with self.assertRaises(TypeError):
                citation_data.write_outputs(temporary, outputs)
            after = {name: (Path(temporary) / name).read_bytes() for name in citation_data.OUTPUT_NAMES}
            self.assertEqual(after, before)

    def test_empty_and_inconsistent_outputs_fail_validation(self):
        outputs = citation_data.build_outputs(author_fixture(), SCHOLAR_ID, UPDATED)
        with tempfile.TemporaryDirectory() as temporary:
            citation_data.write_outputs(temporary, outputs)
            summary = Path(temporary) / "gs_publications.json"
            summary.write_text("", encoding="utf-8")
            with self.assertRaises(json.JSONDecodeError):
                citation_data.validate_output_files(temporary, SCHOLAR_ID)
            outputs["gs_publications.json"]["total_citations"] = 999
            citation_data.write_outputs(temporary, outputs)
            with self.assertRaises(ValueError):
                citation_data.validate_output_files(temporary, SCHOLAR_ID)


class CrawlerTests(unittest.TestCase):
    def test_failed_proxy_setup_falls_back_to_direct_success(self):
        client = mock.Mock()
        client.fill.return_value = author_fixture()
        proxy_factory = mock.Mock(side_effect=RuntimeError("No free proxy"))
        with tempfile.TemporaryDirectory() as temporary:
            main.run(client, proxy_factory, SCHOLAR_ID, 200, temporary)
            outputs = citation_data.validate_output_files(temporary, SCHOLAR_ID)
        client.use_proxy.assert_not_called()
        client.search_author_id.assert_called_once_with(SCHOLAR_ID)
        self.assertEqual(outputs["gs_data.json"]["citedby"], 12)

    def test_exhausted_fetch_retries_raise_and_preserve_previous_data(self):
        client = mock.Mock()
        client.search_author_id.side_effect = RuntimeError("Blocked")
        proxy_factory = mock.Mock()
        proxy_factory.return_value.FreeProxies.return_value = False
        outputs = citation_data.build_outputs(author_fixture(), SCHOLAR_ID, UPDATED)
        with tempfile.TemporaryDirectory() as temporary:
            citation_data.write_outputs(temporary, outputs)
            before = {name: (Path(temporary) / name).read_bytes() for name in citation_data.OUTPUT_NAMES}
            with mock.patch("main.time.sleep") as sleep:
                with self.assertRaises(RuntimeError):
                    main.run(client, proxy_factory, SCHOLAR_ID, 200, temporary)
            self.assertEqual(client.search_author_id.call_count, 5)
            self.assertEqual(sleep.call_count, 4)
            after = {name: (Path(temporary) / name).read_bytes() for name in citation_data.OUTPUT_NAMES}
            self.assertEqual(after, before)

    def test_invalid_author_response_cannot_replace_previous_results(self):
        client = mock.Mock()
        client.fill.return_value = {"scholar_id": SCHOLAR_ID}
        proxy_factory = mock.Mock()
        proxy_factory.return_value.FreeProxies.return_value = False
        with tempfile.TemporaryDirectory() as temporary:
            sentinel = Path(temporary) / "gs_data.json"
            sentinel.write_text("previous data", encoding="utf-8")
            with self.assertRaises(ValueError):
                main.run(client, proxy_factory, SCHOLAR_ID, 200, temporary)
            self.assertEqual(sentinel.read_text(encoding="utf-8"), "previous data")

    def test_missing_scholar_id_fails_before_network_dependency_is_loaded(self):
        with mock.patch.dict(os.environ, {"GOOGLE_SCHOLAR_ID": " "}):
            with self.assertRaisesRegex(ValueError, "GOOGLE_SCHOLAR_ID"):
                main.main()


if __name__ == "__main__":
    unittest.main()
