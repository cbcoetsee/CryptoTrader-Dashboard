#!/usr/bin/env python3
"""
Bar Replay Dashboard — local launcher.

Serves this folder over http://localhost so the dashboard can auto-detect
changes to the workbook in data/ and refresh itself live. No third-party
packages required — only the Python standard library.

Usage:
    python3 server.py            (Windows: double-click, or "py server.py")

Then keep this window open and use the dashboard in your browser. Edit and
save data/35A - Bar Replay.xlsx (keep the same file name) and the page will
pick up the change automatically within a few seconds.

Press Ctrl+C to stop the server.
"""
import http.server
import socketserver
import webbrowser
import os
import sys
import threading

PORT_RANGE = range(8420, 8440)
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Make sure the browser never serves a stale cached copy of the
        # workbook or the page while we're relying on live polling.
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("  " + (fmt % args) + "\n")


def find_free_port():
    for port in PORT_RANGE:
        try:
            with socketserver.TCPServer(("127.0.0.1", port), None):
                return port
        except OSError:
            continue
    raise SystemExit("Could not find a free port in range 8420-8439. Close other local servers and try again.")


def main():
    port = find_free_port()
    url = f"http://localhost:{port}/index.html"

    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), QuietHandler)
    httpd.daemon_threads = True

    print("=" * 60)
    print(" Bar Replay — Setup Research Dashboard")
    print("=" * 60)
    print(f" Serving:  {DIRECTORY}")
    print(f" URL:      {url}")
    print(" Live refresh: edit data/35A - Bar Replay.xlsx and save —")
    print("               the dashboard will pick it up automatically.")
    print(" Press Ctrl+C to stop.")
    print("=" * 60)

    threading.Timer(0.6, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.shutdown()


if __name__ == "__main__":
    main()
