#!/usr/bin/env python3
"""Simple QA harness for the FreightPower chatbot."""

from __future__ import annotations

import argparse
import json
import sys

import httpx


def run(api_url: str, qa_file: str) -> int:
    with open(qa_file, "r", encoding="utf-8") as fp:
        cases = json.load(fp)

    client = httpx.Client(timeout=30.0)
    failures = 0
    for case in cases:
        question = case["question"]
        expect_keywords = case.get("expect_keywords", [])
        resp = client.post(f"{api_url.rstrip('/')}/chat", json={"query": question})
        if resp.status_code != 200:
            print(f"[FAIL] HTTP {resp.status_code} for question: {question}")
            failures += 1
            continue
        answer = resp.json().get("answer", "")
        if not all(keyword.lower() in answer.lower() for keyword in expect_keywords):
            print(f"[WARN] Missing keywords for '{question}': expected {expect_keywords}, got '{answer}'")
            failures += 1
        else:
            print(f"[PASS] {question}")
    client.close()
    return failures


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run canned chatbot QA cases.")
    parser.add_argument("--api-url", default="http://localhost:8000", help="Base URL for the API (default: http://localhost:8000)")
    parser.add_argument("--qa-file", default="data/chatbot_qa.json", help="Path to QA cases JSON file.")
    args = parser.parse_args()
    failures = run(args.api_url, args.qa_file)
    if failures:
        sys.exit(1)
