from __future__ import annotations

import re
import subprocess
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
RESEND_KEY_PATTERN = re.compile(rb"\bre" + rb"_[A-Za-z0-9_-]{30,}\b")


class SecretHygieneTests(unittest.TestCase):
    def test_resend_key_pattern_catches_scoped_key_shape(self) -> None:
        sample = b"re" + b"_" + b"A" * 30 + b"_b"
        self.assertIsNotNone(RESEND_KEY_PATTERN.search(sample))

    def test_tracked_files_do_not_contain_resend_keys(self) -> None:
        result = subprocess.run(
            ["git", "ls-files", "-z"],
            cwd=REPO_ROOT,
            capture_output=True,
            check=False,
        )
        if result.returncode != 0:
            self.skipTest("Git metadata is unavailable")

        exposed_paths = []
        for raw_path in result.stdout.split(b"\0"):
            if not raw_path:
                continue
            relative_path = raw_path.decode("utf-8", errors="surrogateescape")
            path = REPO_ROOT / relative_path
            if path.is_file() and RESEND_KEY_PATTERN.search(path.read_bytes()):
                exposed_paths.append(relative_path)

        self.assertEqual([], exposed_paths, f"Resend API key in: {exposed_paths}")


if __name__ == "__main__":
    unittest.main()
