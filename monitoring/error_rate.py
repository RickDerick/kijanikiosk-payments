#!/usr/bin/env python3
"""kk-payments log-based error-rate monitor (Track A, monitoring Option B).

Reads kk-payments structured JSON logs on stdin, counts /payments requests per
minute, and reports ALERT when the share of failed requests (HTTP status >= 400)
is above the threshold for N consecutive minutes. Writes a JSON summary so the
result can be archived as evidence or read by another tool.

  kubectl logs -n kijani-staging -l app=kk-payments --since=10m --tail=-1 \
    | python3 monitoring/error_rate.py --out monitoring/reports/staging-error-rate.json
"""
import argparse
import json
import sys
from datetime import datetime, timedelta, timezone


def parse_args():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--threshold", type=float, default=0.05, help="error-rate threshold (0.05 = 5%%)")
    p.add_argument("--consecutive", type=int, default=2, help="minutes in a row above threshold to alert")
    p.add_argument("--min-requests", type=int, default=5, help="ignore minutes with fewer requests")
    p.add_argument("--path-prefix", default="/payments", help="only count requests to this path")
    p.add_argument("--out", help="write the JSON summary to this file")
    p.add_argument("--fail-on-alert", action="store_true", help="exit 2 when the status is ALERT")
    return p.parse_args()


def read_buckets(stream, path_prefix):
    buckets, environment = {}, None
    for line in stream:
        line = line.strip()
        if not line.startswith("{"):
            continue  # kubectl notices or non-JSON lines
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if entry.get("msg") != "request" or not str(entry.get("path", "")).startswith(path_prefix):
            continue
        environment = environment or entry.get("env")
        minute = entry["ts"][:16]  # 2026-11-10T09:15
        bucket = buckets.setdefault(minute, {"total": 0, "failed": 0})
        bucket["total"] += 1
        if int(entry.get("status", 0)) >= 400:
            bucket["failed"] += 1
    return buckets, environment


def evaluate(buckets, threshold, consecutive, min_requests):
    rows, streak, previous, alert, alert_minutes = [], 0, None, False, []
    for minute in sorted(buckets):
        b = buckets[minute]
        rate = b["failed"] / b["total"]
        breach = b["total"] >= min_requests and rate > threshold
        current = datetime.strptime(minute, "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc)
        adjacent = previous is not None and current - previous == timedelta(minutes=1)
        streak = (streak + 1 if adjacent else 1) if breach else 0
        if streak >= consecutive:
            alert = True
            alert_minutes.append(minute)
        rows.append({"minute": minute, "total": b["total"], "failed": b["failed"],
                     "error_rate": round(rate, 4), "breach": breach})
        previous = current
    return rows, alert, alert_minutes


def main():
    args = parse_args()
    buckets, environment = read_buckets(sys.stdin, args.path_prefix)
    rows, alert, alert_minutes = evaluate(buckets, args.threshold, args.consecutive, args.min_requests)
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "service": "kk-payments",
        "environment": environment or "unknown",
        "rule": f"payment error rate > {args.threshold:.0%} for {args.consecutive} consecutive minutes",
        "status": "ALERT" if alert else "OK",
        "alert_minutes": alert_minutes,
        "minutes": rows,
    }

    print(f"kk-payments error rate ({summary['environment']}): {summary['rule']}")
    print(f"{'minute (UTC)':<18}{'requests':>9}{'failed':>8}{'rate':>8}  breach")
    for r in rows:
        print(f"{r['minute']:<18}{r['total']:>9}{r['failed']:>8}{r['error_rate']:>8.1%}  {'YES' if r['breach'] else '-'}")
    if not rows:
        print("(no /payments requests in this window)")
    print(f"STATUS: {summary['status']}" + (f" (minutes {', '.join(alert_minutes)})" if alert else ""))

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(summary, fh, indent=2)
            fh.write("\n")
    return 2 if (alert and args.fail_on_alert) else 0


if __name__ == "__main__":
    sys.exit(main())
